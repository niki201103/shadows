
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

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ADMIN_PIN || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return reply({ error: "Server nicht konfiguriert." }, 500);
    }

    const suppliedPin = request.headers.get("X-Admin-Pin") || "";

    if (suppliedPin.length > 200 || suppliedPin !== env.ADMIN_PIN) {
      return reply({ error: "Falscher Admin-PIN." }, 401);
    }

    const body = await request.json();
    const base = env.SUPABASE_URL.replace(/\/$/, "");
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    };

    if (body.action === "verify") {
      return reply({ success: true });
    }

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
        const details = await result.text();

        return reply({
          error: "Artikel konnte nicht gespeichert werden.",
          details: details
        }, 500);
      }

      return reply({ success: true });
    }

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
        const details = await result.text();

        return reply({
          error: "Löschen fehlgeschlagen.",
          details: details
        }, 500);
      }

      return reply({ success: true });
    }

    if (body.action === "saveWhatsapp") {
      const url = body.url ?? "";

      if (
        typeof url !== "string" ||
        (url !== "" &&
          !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(url))
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
        const details = await result.text();

        return reply({
          error: "Link konnte nicht gespeichert werden.",
          details: details
        }, 500);
      }

      return reply({ success: true });
    }

    return reply({ error: "Unbekannte Aktion." }, 400);

  } catch (error) {
    return reply({
      error: "Serverfehler.",
      details: String(error)
    }, 500);
  }
}
