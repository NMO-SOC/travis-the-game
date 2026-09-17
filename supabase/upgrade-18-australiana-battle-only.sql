-- Travis: The Game — upgrade 18: Australiana packs are battle-only, not purchasable.
-- upgrade-17 defaulted every pack (including australiana) to gp_price = 30. Australiana is meant
-- to be earned from wins only (see the in-game banner copy), so null its price back out; buy_pack
-- already rejects a null gp_price.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

update public.packs set gp_price = null where id = 'australiana';
