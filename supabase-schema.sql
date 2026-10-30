-- Gemeinschafts-Wiki: Datenbank einrichten
-- Im Supabase SQL Editor vollständig ausführen.

create table if not exists public.wiki_articles (
  id uuid primary key,
  title text not null,
  category text default 'Allgemein',
  description text default '',
  content text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.wiki_settings (
  id integer primary key check (id = 1),
  whatsapp_url text default ''
);

insert into public.wiki_settings (id, whatsapp_url)
values (1, '')
on conflict (id) do nothing;

alter table public.wiki_articles enable row level security;
alter table public.wiki_settings enable row level security;

drop policy if exists "Public can read articles" on public.wiki_articles;
create policy "Public can read articles"
on public.wiki_articles for select to anon, authenticated
using (true);

drop policy if exists "Public can read settings" on public.wiki_settings;
create policy "Public can read settings"
on public.wiki_settings for select to anon, authenticated
using (true);

-- Absichtlich keine öffentlichen INSERT-, UPDATE- oder DELETE-Rechte.
-- Schreibzugriffe laufen ausschließlich über die Cloudflare Function.
