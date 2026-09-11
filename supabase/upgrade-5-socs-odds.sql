-- Travis: The Game — upgrade 5: better odds for SOC's Favourite now that it holds seven characters.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
-- Per card: starter 55%, one of the seven characters 40% (about 5.7% each), starter foil 5%.

update public.pack_odds set weight = 55 where pack_id = 'socs-favourite' and slot = 'starter';
update public.pack_odds set weight = 40 where pack_id = 'socs-favourite' and slot = 'rare';
update public.pack_odds set weight = 5  where pack_id = 'socs-favourite' and slot = 'foil';
