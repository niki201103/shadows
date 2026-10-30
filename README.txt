# Gemeinschafts-Wiki

## Dateien
- `index.html`: öffentliche Wiki-Webseite
- `functions/api/admin.js`: Cloudflare Pages Function für Admin-Aktionen
- `supabase-schema.sql`: Datenbanktabellen und Leserechte

## 1. Supabase
1. Öffne dein Supabase-Projekt → SQL Editor.
2. Führe den Inhalt von `supabase-schema.sql` aus.
3. Öffne Project Settings → API.
4. Kopiere die Project URL und den öffentlichen Publishable-/anon-Key.

Trage URL und öffentlichen Key oben in `index.html` bei `SUPABASE_URL` und `SUPABASE_KEY` ein.
Dort niemals den `service_role`-Key eintragen.

## 2. GitHub
Lege die Dateien exakt so ab:

```text
/
├── index.html
├── supabase-schema.sql
└── functions/
    └── api/
        └── admin.js
```

Committe und pushe die Änderungen.

## 3. Cloudflare Pages
Das GitHub-Repository muss als Cloudflare Pages-Projekt verbunden sein.
Für ein einfaches statisches Projekt:
- Build command: leer lassen
- Build output directory: `/` (bzw. das Repository-Wurzelverzeichnis, je nach Cloudflare-Einrichtung)

Pages Functions werden automatisch aus dem Ordner `functions/` erkannt.

Unter Settings → Variables and Secrets → Production füge hinzu:
- `ADMIN_PIN`: dein geheimer Admin-PIN (besser eine lange, nicht erratbare Passphrase)
- `SUPABASE_URL`: deine Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: der geheime service_role-Key aus Supabase

Den `service_role`-Key niemals in GitHub, HTML oder clientseitigem JavaScript veröffentlichen.
Danach neu deployen.

## 4. Test
1. Öffne die öffentliche Webseite.
2. Prüfe, ob die Seite lädt.
3. Klicke auf Admin und melde dich mit deinem PIN an.
4. Erstelle einen Testartikel, bearbeite ihn und lösche ihn wieder.
5. Teste den WhatsApp-Link.

## Sicherheitshinweise
- Diese einfache PIN-Lösung ist für ein kleines privates Admin-Team gedacht, nicht für sensible oder hochkritische Inhalte.
- Aktiviere bei Cloudflare Rate Limiting für `/api/admin`, um PIN-Versuche zu begrenzen.
- Ein PIN wird im Browser für die Dauer der geöffneten Sitzung im JavaScript-Speicher gehalten. Beim Abmelden wird er verworfen.
- Inhalte sind öffentlich lesbar. Veröffentliche keine privaten Daten oder Informationen über andere Personen ohne deren Einwilligung.
- Der WhatsApp-Einladungslink ist öffentlich sichtbar, sobald er eingetragen wurde.
