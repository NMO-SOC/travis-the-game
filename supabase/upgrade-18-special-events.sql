-- Travis: The Game — upgrade 18: special events. An admin saves an event once (which cards are allowed,
-- plus a fixed action deck) and switches it live whenever they want to run it. While live, players can
-- choose it on the menu and field a team from their own cards that fit it.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 40),
  blurb      text not null default '',
  char_sets  text[] not null default '{}',   -- pack ids ('base' = starters) whose characters may play; empty = any
  foil_only  boolean not null default false, -- only characters you own a foil of
  actions    text[] not null check (cardinality(actions) = 12), -- the action deck everyone plays, card ids with repeats
  live       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
drop policy if exists "events are public" on public.events;
drop policy if exists "admins manage events" on public.events;
create policy "events are public" on public.events for select using (true);
create policy "admins manage events" on public.events for all to authenticated
  using (exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin))
  with check (exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin));
