-- Travis: The Game — upgrade 3: move three Knoxes from Term One into SOC's Favourite.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
-- Players who already own these cards keep them; only the pack they're found in changes.

update public.cards set pack_id = 'socs-favourite'
  where id in ('sports-carnival-knox', 'swimming-carnival-knox', 'socs-got-talent-knox');

update public.packs set blurb = 'Harbour Seal and Conference Knox, plus five new action cards.' where id = 'term-one';
update public.packs set blurb = 'Seven fan-favourite Knoxes, from carnivals to talent shows. No new action cards, better odds of a new character.' where id = 'socs-favourite';
