-- Travis: The Game — upgrade 8: Spirit Week pack, four house-colour action cards.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
-- Spirit Week has no characters of its own (rare weight = 0): every non-starter, non-foil pull is
-- one of the four house cards. Their in-battle effect (stronger with more copies owned) lives
-- entirely client-side in play.js/ACT — nothing server-side needs to know about it.

insert into public.packs (id, name, blurb, sort, valid_until, open_with_any, win_weight) values
  ('spirit-week', 'Spirit Week', 'Four house-colour action cards, one per house. Collect copies of the same one to make it stronger.', 45, null, true, 20)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, sort = excluded.sort, win_weight = excluded.win_weight;

insert into public.pack_odds (pack_id, slot, weight) values
  ('spirit-week', 'starter', 40), ('spirit-week', 'common', 55), ('spirit-week', 'rare', 0), ('spirit-week', 'foil', 5)
on conflict (pack_id, slot) do update set weight = excluded.weight;

insert into public.cards (id, kind, rarity, pack_id) values
  ('waratah-spirit', 'action', 'common', 'spirit-week'),
  ('grevillea-spirit', 'action', 'common', 'spirit-week'),
  ('acacia-spirit', 'action', 'common', 'spirit-week'),
  ('banksia-spirit', 'action', 'common', 'spirit-week')
on conflict (id) do nothing;
