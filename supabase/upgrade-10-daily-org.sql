-- Travis: The Game — upgrade 10: Daily Org pack, three characters and three action cards.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

insert into public.packs (id, name, blurb, sort, valid_until, open_with_any, win_weight) values
  ('daily-org', 'Daily Org', 'Three characters and three action cards straight off the daily organisation sheet.', 5, null, true, 20)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, sort = excluded.sort, win_weight = excluded.win_weight;

insert into public.pack_odds (pack_id, slot, weight) values
  ('daily-org', 'starter', 55), ('daily-org', 'common', 25), ('daily-org', 'rare', 15), ('daily-org', 'foil', 5)
on conflict (pack_id, slot) do update set weight = excluded.weight;

insert into public.cards (id, kind, rarity, pack_id) values
  ('sick-day-knox', 'character', 'rare', 'daily-org'),
  ('excursion-knox', 'character', 'rare', 'daily-org'),
  ('pd-knox', 'character', 'rare', 'daily-org'),
  ('classroom-change', 'action', 'common', 'daily-org'),
  ('compass-is-down', 'action', 'common', 'daily-org'),
  ('s1-4', 'action', 'common', 'daily-org')
on conflict (id) do nothing;
