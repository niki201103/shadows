const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

// Deutsche Ortszeit in UTC umrechnen
function berlinMidnightUtc(year, month, day) {
  const guess = Date.UTC(year, month - 1, day);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(guess));

  const values = {};
  parts.forEach(p => values[p.type] = p.value);

  const represented = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return new Date(guess - (represented - guess));
}

export async function onRequestPost({ request, env }) {
  try {
    if (
      !env.SUPABASE_URL ||
      !env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return reply({ error: "Server nicht konfiguriert." }, 500);
    }

    const body = await request.json();

    const base = env.SUPABASE_URL.replace(/\/$/, "");
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    };

    // Öffentliche Besucherzählung
    // Es werden keine persönlichen Besucherdaten gespeichert.
    if (body.action === "trackVisit") {
      const origin = request.headers.get("Origin");

      if (
        origin &&
        origin !== new URL(request.url).origin
      ) {
        return reply({ error: "Nicht erlaubt." }, 403);
      }

      const result = await fetch(
        `${base}/rest/v1/page_visits`,
        {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            visited_at: new Date().toISOString()
          })
        }
      );

      if (!result.ok) {
        return reply({
          error: "Besuch konnte nicht registriert werden."
        }, 500);
      }

      return reply({ success: true });
    }

    // Ab hier sind alle Aktionen PIN-geschützt.
    if (
      !env.ADMIN_PIN ||
      !env.SUPABASE_URL ||
      !env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return reply({ error: "Server nicht konfiguriert." }, 500);
    }

    const suppliedPin = request.headers.get("X-Admin-Pin") || "";

    if (
      suppliedPin.length > 200 ||
      suppliedPin !== env.ADMIN_PIN
    ) {
      return reply({ error: "Falscher Admin-PIN." }, 401);
    }

    // Admin-Anmeldung überprüfen
    if (body.action === "verify") {
      return reply({ success: true });
    }

    // Artikel speichern
    if (body.action === "saveArticle") {
      const a = body.article;

      if (
        !a ||
        typeof a.id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(a.id) ||
        typeof a.title !== "string" ||
        !a.title.trim() ||
        a.title.length > 120 ||
        typeof a.category !== "string" ||
        a.category.length > 80 ||
        typeof a.description !== "string" ||
        a.description.length > 500 ||
        typeof a.content !== "string" ||
        a.content.length > 20000
      ) {
        return reply({ error: "Ungültige Artikeldaten." }, 400);
      }

      const result = await fetch(
        `${base}/rest/v1/wiki_articles?on_conflict=id`,
        {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify({
            id: a.id,
            title: a.title.trim(),
            category: a.category.trim() || "Allgemein",
            description: a.description,
            content: a.content,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!result.ok) {
        return reply({
          error: "Artikel konnte nicht gespeichert werden.",
          details: await result.text()
        }, 500);
      }

      return reply({ success: true });
    }

    // Artikel löschen
    if (body.action === "deleteArticle") {
      if (
        typeof body.id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(body.id)
      ) {
        return reply({ error: "Ungültige Artikel-ID." }, 400);
      }

      const result = await fetch(
        `${base}/rest/v1/wiki_articles?id=eq.${encodeURIComponent(body.id)}`,
        {
          method: "DELETE",
          headers
        }
      );

      if (!result.ok) {
        return reply({
          error: "Löschen fehlgeschlagen.",
          details: await result.text()
        }, 500);
      }

      return reply({ success: true });
    }

    // WhatsApp-Link speichern
    if (body.action === "saveWhatsapp") {
      const url = body.url ?? "";

      if (
        typeof url !== "string" ||
        (url !== "" &&
          !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+(?:\?[A-Za-z0-9_=&%-]+)?$/.test(url))
      ) {
        return reply({ error: "Ungültiger WhatsApp-Link." }, 400);
      }

      const result = await fetch(
        `${base}/rest/v1/wiki_settings?on_conflict=id`,
        {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify({
            id: 1,
            whatsapp_url: url
          })
        }
      );

      if (!result.ok) {
        return reply({
          error: "Link konnte nicht gespeichert werden.",
          details: await result.text()
        }, 500);
      }

      return reply({ success: true });
    }

    // Besucherstatistik abrufen
    if (body.action === "getStats") {
      const now = new Date();

      const berlinDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(now);

      const [year, month, day] = berlinDate
        .split("-")
        .map(Number);

      const startMonth = berlinMidnightUtc(year, month, 1);

      const result = await fetch(
        `${base}/rest/v1/page_visits?select=visited_at&visited_at=gte.${encodeURIComponent(startMonth.toISOString())}&order=visited_at.asc&limit=1000`,
        { headers }
      );

      if (!result.ok) {
        return reply({
          error: "Statistik konnte nicht geladen werden.",
          details: await result.text()
        }, 500);
      }

      let visits = await result.json();

      // Weitere Seiten laden, falls mehr als 1000 Aufrufe vorliegen.
      let offset = 1000;

      while (visits.length === offset) {
        const next = await fetch(
          `${base}/rest/v1/page_visits?select=visited_at&visited_at=gte.${encodeURIComponent(startMonth.toISOString())}&order=visited_at.asc&limit=1000&offset=${offset}`,
          { headers }
        );

        if (!next.ok) {
          return reply({
            error: "Weitere Statistikdaten konnten nicht geladen werden."
          }, 500);
        }

        const batch = await next.json();

        visits.push(...batch);

        if (batch.length < 1000) break;

        offset += 1000;
      }

      const daily = {};

      visits.forEach(visit => {
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Berlin",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(new Date(visit.visited_at));

        daily[date] = (daily[date] || 0) + 1;
      });

      return reply({
        success: true,
        today: daily[berlinDate] || 0,
        month: visits.length,
        daily
      });
    }

    return reply({ error: "Unbekannte Aktion." }, 400);

  } catch (error) {
    return reply({
      error: "Serverfehler.",
      details: String(error)
    }, 500);
  }
}
