Gemeinschafts-Wiki – Funktionserweiterung
Das ursprüngliche Seitenlayout und die vorhandenen Gestaltungselemente bleiben erhalten: Kopfzeile mit Suche und Admin-Schaltfläche, linke Navigation, Inhaltsbereich, Artikelkarten, Infoboxen, Editor und Fußzeile. Die vorhandenen CSS-Regeln und Farben wurden nicht neu gestaltet.
Ergänzte Funktionen
- Beitrittsformular mit Name, Kontakt und Begründung
- Speicherung der Beitrittsanfragen und E-Mail-Benachrichtigung über Resend
- Anfragen im Adminbereich ansehen und annehmen oder ablehnen
- Protokoll erfolgreicher Admin-Anmeldungen und Admin-Aktivitäten
- Deutsche und englische Artikeltexte mit Sprachumschalter
- Impressum- und Datenschutzseiten als auszufüllende Platzhalter
- Bestehende Besucherzählung, Besucherstatistik und WhatsApp-Verwaltung
Einrichtung
1. Im Supabase SQL Editor supabase-schema.sql ausführen. Das Skript ergänzt die Artikeltabelle und legt die benötigten Tabellen an.
2. In index.html SUPABASE_URL und SUPABASE_KEY prüfen. Im Browser darf nur der Publishable-/anon-Key stehen.
3. Folgende Dateien in das Cloudflare-Pages-Projekt übernehmen: index.html, supabase-schema.sql und functions/api/admin.js.
4. Cloudflare Pages mit dem Repository verbinden. Build command leer lassen; Ausgabeordner /.
5. Unter Cloudflare Pages → Settings → Variables and Secrets → Production setzen:
   - ADMIN_PIN: lange, zufällige Passphrase
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY: geheim halten, niemals im Browser oder Repository veröffentlichen
   - RESEND_API_KEY: optional, für E-Mail-Benachrichtigungen
   - ADMIN_NOTIFICATION_EMAIL: optionale Empfängeradresse
   - EMAIL_FROM: optional, verifizierte Absenderadresse
6. Neu deployen.
Hinweise vor Veröffentlichung
- Impressum und Datenschutzhinweise sind Platzhalter und müssen mit korrekten Angaben ergänzt werden.
- Beitrittsanfragen enthalten personenbezogene Daten. Lege eine angemessene Löschfrist fest und beschränke den Zugriff auf berechtigte Personen.
- E-Mail-Hinweise werden nur versendet, wenn RESEND_API_KEY und ADMIN_NOTIFICATION_EMAIL gesetzt sind. Für produktiven Versand muss die Absenderdomain bei Resend verifiziert sein.
- Aktiviere Cloudflare Rate Limiting für /api/admin. Die PIN-Lösung ist für ein kleines Admin-Team gedacht; langfristig sind individuelle Benutzerkonten mit Rollen und Mehr-Faktor-Authentifizierung vorzuziehen.
- Die Besucherstatistik speichert Zeitstempel von Aufrufen, aber keine persönlichen Besucherdaten.
