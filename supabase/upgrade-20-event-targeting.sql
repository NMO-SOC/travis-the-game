-- Travis: The Game — upgrade 20: target a special event at specific players.
-- allowed_usernames empty (the default) means everyone, same convention as events.char_sets already
-- uses for "any character". Non-empty restricts the event to just those usernames (case-insensitive —
-- always stored lowercase, matching how usernames are cleaned everywhere else in this app).
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

alter table public.events add column if not exists allowed_usernames text[] not null default '{}';
