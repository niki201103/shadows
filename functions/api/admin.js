const headersFor = key => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json"
});

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });

async function dbRequest(env, path, options = {}) {
  return fetch(
    `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        ...headersFor(env.SUPABASE_SERVICE_ROLE_KEY),
        ...(options.headers || {})
      }
    }
  );
}

async function insertLog(env, table, row) {
  const r = await dbRequest(env, table, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row)
  });

  if (!r.ok) throw Error(await r.text());
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return reply({ error: "Server nicht konfiguriert." }, 500);
    }

    const body = await request.json();
    const origin = request.headers.get("Origin");

    if (origin && origin !== new URL(request.url).origin) {
      return reply({ error: "Nicht erlaubt." }, 403);
    }

    const publicAction =
      body.action === "trackVisit" ||
      body.action === "submitMembership";

    if (body.action === "trackVisit") {
      const r = await dbRequest(env, "page_visits", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          visited_at: new Date().toISOString()
        })
      });

      return r.ok
        ? reply({ success: true })
        : reply({ error: "Besuch konnte nicht registriert werden." }, 500);
    }

    if (body.action === "submitMembership") {
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      const reason = String(body.reason || "").trim();

      if (
        !name ||
        name.length > 100 ||
        !phone ||
        phone.length > 40 ||
        !reason ||
        reason.length > 2000
      ) {
        return reply({ error: "Bitte gültige Angaben eintragen." }, 400);
      }

      const r = await dbRequest(env, "membership_requests", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name,
          phone,
          reason,
          status: "pending"
        })
      });

      if (!r.ok) {
        return reply({
          error: "Anfrage konnte nicht gespeichert werden."
        }, 500);
      }

      if (env.RESEND_API_KEY && env.ADMIN_NOTIFICATION_EMAIL) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from:
                env.EMAIL_FROM ||
                "Ordo Noctis <onboarding@resend.dev>",
              to: [env.ADMIN_NOTIFICATION_EMAIL],
              subject: "Neue Beitrittsanfrage",
              text: `Neue Anfrage von ${name}
Telefon: ${phone}
Begründung:
${reason}`
            })
          });
        } catch (e) {
          console.error(
            "E-Mail-Benachrichtigung fehlgeschlagen",
            e
          );
        }
      }

      return reply({ success: true });
    }

    const pin = request.headers.get("X-Admin-Pin") || "";

    if (
      !env.ADMIN_PIN ||
      pin.length > 200 ||
      pin !== env.ADMIN_PIN
    ) {
      return reply({ error: "Falscher Admin-PIN." }, 401);
    }

    if (body.action === "verify") {
      await insertLog(env, "admin_login_logs", {
        event: "login_success",
        details: "Admin-Anmeldung erfolgreich"
      });

      return reply({ success: true });
    }

    if (body.action === "saveArticle") {
      const a = body.article;

      if (
        !a ||
        typeof a.id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(a.id) ||
        !String(a.title_de || "").trim() ||
        !String(a.title_en || "").trim()
      ) {
        return reply({
          error: "Beide Artikeltitel sind erforderlich."
        }, 400);
      }

      const prior = await dbRequest(
        env,
        `wiki_articles?id=eq.${encodeURIComponent(a.id)}&select=id`
      );

      const existed =
        prior.ok && (await prior.json()).length > 0;

      const r = await dbRequest(
        env,
        "wiki_articles?on_conflict=id",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify({
            id: a.id,
            category: String(a.category || "Allgemein").slice(0, 80),
            title_de: String(a.title_de).slice(0, 120),
            title_en: String(a.title_en).slice(0, 120),
            description_de: String(a.description_de || "").slice(0, 500),
            description_en: String(a.description_en || "").slice(0, 500),
            content_de: String(a.content_de || "").slice(0, 20000),
            content_en: String(a.content_en || "").slice(0, 20000),
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!r.ok) {
        return reply({
          error: "Artikel konnte nicht gespeichert werden."
        }, 500);
      }

      await insertLog(env, "admin_activity_logs", {
        event: existed ? "article_updated" : "article_created",
        details: `Artikel ${a.id}`
      });

      return reply({ success: true });
    }

    if (body.action === "deleteArticle") {
      const r = await dbRequest(
        env,
        `wiki_articles?id=eq.${encodeURIComponent(body.id)}`,
        { method: "DELETE" }
      );

      if (!r.ok) {
        return reply({ error: "Löschen fehlgeschlagen." }, 500);
      }

      await insertLog(env, "admin_activity_logs", {
        event: "article_deleted",
        details: `Artikel ${body.id}`
      });

      return reply({ success: true });
    }

    if (body.action === "getMembershipRequests") {
      const r = await dbRequest(
        env,
        "membership_requests?select=*&order=created_at.desc&limit=300"
      );

      return reply({ requests: await r.json() });
    }

    if (body.action === "decideMembership") {
      if (!["accepted", "rejected"].includes(body.status)) {
        return reply({ error: "Ungültiger Status." }, 400);
      }

      const r = await dbRequest(
        env,
        `membership_requests?id=eq.${encodeURIComponent(body.id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: body.status,
            reviewed_at: new Date().toISOString()
          })
        }
      );

      if (!r.ok) {
        return reply({
          error: "Status konnte nicht geändert werden."
        }, 500);
      }

      await insertLog(env, "admin_activity_logs", {
        event: `membership_${body.status}`,
        details: `Anfrage ${body.id}`
      });

      return reply({ success: true });
    }

    if (
      body.action === "getActivityLogs" ||
      body.action === "getLoginLogs"
    ) {
      const table =
        body.action === "getActivityLogs"
          ? "admin_activity_logs"
          : "admin_login_logs";

      const r = await dbRequest(
        env,
        `${table}?select=*&order=created_at.desc&limit=300`
      );

      return reply({ logs: await r.json() });
    }

    if (body.action === "saveWhatsapp") {
      const url = String(body.url || "");

      if (
        url &&
        !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+(?:\?[A-Za-z0-9_=&%-]+)?$/.test(url)
      ) {
        return reply({ error: "Ungültiger WhatsApp-Link." }, 400);
      }

      const r = await dbRequest(
        env,
        "wiki_settings?on_conflict=id",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify({
            id: 1,
            whatsapp_url: url
          })
        }
      );

      return r.ok
        ? reply({ success: true })
        : reply({ error: "Speichern fehlgeschlagen." }, 500);
    }

    if (body.action === "getStats") {
      const d = new Date();

      const monthStart = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
      ).toISOString();

      const r = await dbRequest(
        env,
        `page_visits?select=visited_at&visited_at=gte.${encodeURIComponent(monthStart)}&order=visited_at.asc&limit=10000`
      );

      if (!r.ok) {
        return reply({ error: "Statistik nicht verfügbar." }, 500);
      }

      const rows = await r.json();
      const today = new Date().toISOString().slice(0, 10);
      const daily = {};

      for (const row of rows) {
        const day = row.visited_at.slice(0, 10);
        daily[day] = (daily[day] || 0) + 1;
      }

      return reply({
        today: rows.filter(
          x => x.visited_at.slice(0, 10) === today
        ).length,
        month: rows.length,
        daily
      });
    }

    return reply({ error: "Unbekannte Aktion." }, 400);

  } catch (e) {
    return reply({
      error: "Serverfehler.",
      details: String(e)
    }, 500);
  }
}
