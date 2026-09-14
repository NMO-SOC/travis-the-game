-- Travis: The Game — upgrade 11: Knox of History pack, fourteen historical-figure characters.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

insert into public.packs (id, name, blurb, sort, valid_until, open_with_any, win_weight) values
  ('knox-of-history', 'Knox of History', 'Fourteen Travis Knoxes pulled from across history, from the Bronze Age to Wall Street.', 6, null, true, 20)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, sort = excluded.sort, win_weight = excluded.win_weight;

insert into public.pack_odds (pack_id, slot, weight) values
  ('knox-of-history', 'starter', 50), ('knox-of-history', 'rare', 45), ('knox-of-history', 'foil', 5)
on conflict (pack_id, slot) do update set weight = excluded.weight;

insert into public.cards (id, kind, rarity, pack_id) values
  ('barbarian-knox', 'character', 'rare', 'knox-of-history'),
  ('caesar-knox', 'character', 'rare', 'knox-of-history'),
  ('crusader-knox', 'character', 'rare', 'knox-of-history'),
  ('great-depression-knox', 'character', 'rare', 'knox-of-history'),
  ('napoleon-knox', 'character', 'rare', 'knox-of-history'),
  ('pharaoh-knox', 'character', 'rare', 'knox-of-history'),
  ('pirate-knox', 'character', 'rare', 'knox-of-history'),
  ('samurai-knox', 'character', 'rare', 'knox-of-history'),
  ('spartan-knox', 'character', 'rare', 'knox-of-history'),
  ('tech-bro-knox', 'character', 'rare', 'knox-of-history'),
  ('washington-knox', 'character', 'rare', 'knox-of-history'),
  ('woodstock-knox', 'character', 'rare', 'knox-of-history'),
  ('ww1-knox', 'character', 'rare', 'knox-of-history'),
  ('ww2-knox', 'character', 'rare', 'knox-of-history')
on conflict (id) do nothing;
