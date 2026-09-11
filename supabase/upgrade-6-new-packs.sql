-- Travis: The Game — upgrade 6: four new packs (Field Season, End of Year, Holo, Legendary).
-- Run after upgrade 4 (packs of a specific type). Paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. Only adds packs, odds and cards; no player is touched.
--
-- What it adds:
--   * Field Season: 4 new seal characters, 2 new action cards. Openable like any other pack.
--   * End of Year: 3 new characters. Limited — stops being openable after valid_until (31 Dec this
--     year). Anyone who already pulled a card keeps it; it just can't be pulled again after that date.
--   * Holo: no new cards — every card is a foil of a starter character. Admin-gift only.
--   * Legendary: gold editions of five fan-favourites, same stats as the original — just rarer and
--     shinier. Admin-gift only.
-- Holo and Legendary never appear as a choice for an any-type pack (open_with_any = false), so the
-- only way to get one is an admin giving that specific pack from the Admin screen.

alter table public.packs add column if not exists valid_until timestamptz;
alter table public.packs add column if not exists open_with_any boolean not null default true;

insert into public.packs (id, name, blurb, sort, valid_until, open_with_any) values
  ('field-season', 'Field Season', 'Four new specimens from the sub-Antarctic, plus two new action cards.', 3, null, true),
  ('end-of-year',  'End of Year',  'Three characters for the end of the school year. Available until 31 December.', 4, '2026-12-31 23:59:59+11', true),
  ('holo',         'Holo',         'Every card is a foil of a starter character. Only ever given, never pulled from an ordinary pack.', 5, null, false),
  ('legendary',    'Legendary',    'Gold editions of fan-favourite Knoxes. Only ever given, never pulled from an ordinary pack.', 6, null, false)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, sort = excluded.sort,
  valid_until = excluded.valid_until, open_with_any = excluded.open_with_any;

insert into public.pack_odds (pack_id, slot, weight) values
  ('field-season', 'starter', 55), ('field-season', 'common', 25), ('field-season', 'rare', 15), ('field-season', 'foil', 5),
  ('end-of-year',  'starter', 60), ('end-of-year',  'common', 0),  ('end-of-year',  'rare', 35), ('end-of-year',  'foil', 5),
  -- Holo: every card a foil (a small starter chance covers the case where every foil is already owned).
  ('holo',         'starter', 10), ('holo',         'common', 0),  ('holo',         'rare', 0),  ('holo',         'foil', 90),
  -- 'rare' here means "one of the five golden characters" (they're stored as pack_id = 'legendary',
  -- rarity = 'rare' — the gold finish is the card itself, not a foil of something else).
  ('legendary',    'starter', 15), ('legendary',    'common', 0),  ('legendary',    'rare', 85), ('legendary',    'foil', 0)
on conflict (pack_id, slot) do nothing;

insert into public.cards (id, kind, rarity, pack_id) values
  ('fur-seal-knox','character','rare','field-season'), ('weddell-seal-knox','character','rare','field-season'),
  ('sea-lion-knox','character','rare','field-season'), ('research-vessel-knox','character','rare','field-season'),
  ('tagging-dart','action','common','field-season'), ('fog-bank','action','common','field-season'),
  ('graduation-knox','character','rare','end-of-year'), ('yearbook-knox','character','rare','end-of-year'),
  ('staff-party-knox','character','rare','end-of-year'),
  ('golden-doctor-knox','character','rare','legendary'), ('golden-beer-frog-knox','character','rare','legendary'),
  ('golden-elephant-seal-knox','character','rare','legendary'), ('golden-leopard-seal-knox','character','rare','legendary'),
  ('golden-emeritus-knox','character','rare','legendary')
on conflict (id) do update set rarity = excluded.rarity, pack_id = excluded.pack_id;

-- open_pack: respects a pack's valid_until, and only lets an any-type (profile.packs) token open a
-- pack that allows it — a specific-type pack in pack_stock always works regardless of open_with_any.
create or replace function public.open_pack(p_pack text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result jsonb := '[]'; i int; total int; roll int; pick text;
        cid text; is_foil boolean; cap int; pts int; owned int; pk packs;
begin
  select * into pk from packs where id = p_pack and active;
  if pk.id is null then raise exception 'That pack isn''t available'; end if;
  if pk.valid_until is not null and now() > pk.valid_until then raise exception '% is no longer available', pk.name; end if;
  select coalesce(sum(weight), 0) into total from pack_odds where pack_id = p_pack;
  if total <= 0 then raise exception 'That pack has no odds set'; end if;
  -- Use a pack of this exact type if they have one (given by an admin), otherwise an any-type pack.
  update pack_stock set qty = qty - 1 where user_id = uid and pack_id = p_pack and qty > 0;
  if not found then
    if not pk.open_with_any then raise exception '% can only be opened with a pack of that exact type', pk.name; end if;
    update profiles set packs = packs - 1 where id = uid and packs > 0;
    if not found then raise exception 'No packs to open'; end if;
  end if;
  for i in 1..3 loop
    roll := floor(random() * total)::int;
    select o.slot into pick from (
      select slot, sum(weight) over (order by case slot when 'starter' then 1 when 'common' then 2 when 'rare' then 3 else 4 end) as upto
      from pack_odds where pack_id = p_pack and weight > 0) o
    where roll < o.upto order by o.upto limit 1;
    cid := null; is_foil := false;
    if pick = 'common' then
      select id into cid from cards where pack_id = p_pack and rarity = 'common' order by random() limit 1; cap := 3; pts := 2;
    elsif pick = 'rare' then
      select id into cid from cards where pack_id = p_pack and rarity = 'rare' order by random() limit 1; cap := 1; pts := 5;
    elsif pick = 'foil' then
      select id into cid from cards where rarity = 'base' and kind = 'character' order by random() limit 1; is_foil := true; cap := 1; pts := 5;
    end if;
    if cid is null then
      -- A starter card (or a pack with nothing in the rolled slot): everyone owns these, so it's worth 1 Grant Point.
      select id into cid from cards where rarity = 'base' order by random() limit 1;
      update profiles set grant_points = grant_points + 1 where id = uid;
      result := result || jsonb_build_object('id', cid, 'foil', false, 'dupe', true, 'starter', true, 'points', 1);
      continue;
    end if;
    select coalesce(sum(qty), 0) into owned from collection where user_id = uid and card_id = cid and foil = is_foil;
    if owned >= cap then
      update profiles set grant_points = grant_points + pts where id = uid;
      result := result || jsonb_build_object('id', cid, 'foil', is_foil, 'dupe', true, 'starter', false, 'points', pts);
    else
      insert into collection (user_id, card_id, foil, qty) values (uid, cid, is_foil, 1)
        on conflict (user_id, card_id, foil) do update set qty = collection.qty + 1;
      result := result || jsonb_build_object('id', cid, 'foil', is_foil, 'dupe', false, 'starter', false, 'points', 0);
    end if;
  end loop;
  return result;
end $$;
