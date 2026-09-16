-- Travis: The Game — upgrade 16: Australiana pack. Six new characters (Bunnings BBQ Knox, Bushman
-- Knox, First Fleet Knox, Outback Knox, Surf Lifesaver Knox, Oakleigh Knox), openable with a normal
-- any-type pack token like Field Season or End of Year — but ONLY until Sunday 20 Sep 2026 11:59pm.
-- After that, opening the pack raises an error (same mechanism as End of Year), and — unlike End of
-- Year — these six are also excluded from the Holo/Legendary foil-gold pool forever, so they can
-- never be pulled as a foil or gold outside this pack, before or after it closes.
--
-- Three (Bushman, First Fleet, Oakleigh — the ones with their own unique battle theme) are 'rare',
-- the other three (Bunnings BBQ, Outback, Surf Lifesaver — sharing the generic Down Under theme) are
-- 'common', so the named-theme cards are meaningfully harder to pull.
--
-- Every Australiana pack is also guaranteed at least one Australiana card (common or rare) — if the
-- first two of the pack's three slots both land on starter/foil, the third is forced into the
-- common/rare pool instead of also risking a starter. (Genuinely "no packs to open" or a malformed
-- odds table still errors as before — this only forces a re-roll of the slot choice, not a card.)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

alter table public.packs add column if not exists guarantee_own boolean not null default false;

insert into public.packs (id, name, blurb, sort, valid_until, open_with_any, guarantee_own) values
  ('australiana', 'Australiana', 'Six true-blue Knoxes. Guaranteed one every pack. Available until Sunday 11:59pm — gone after that.', 7, '2026-09-20 23:59:59+10', true, true)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, sort = excluded.sort,
  valid_until = excluded.valid_until, open_with_any = excluded.open_with_any, guarantee_own = excluded.guarantee_own;

insert into public.pack_odds (pack_id, slot, weight) values
  ('australiana', 'starter', 30), ('australiana', 'common', 35), ('australiana', 'rare', 25), ('australiana', 'foil', 10)
on conflict (pack_id, slot) do update set weight = excluded.weight;

insert into public.cards (id, kind, rarity, pack_id) values
  ('bunnings-bbq-knox','character','common','australiana'), ('outback-knox','character','common','australiana'),
  ('surf-lifesaver-knox','character','common','australiana'),
  ('bushman-knox','character','rare','australiana'), ('first-fleet-knox','character','rare','australiana'),
  ('oakleigh-knox','character','rare','australiana')
on conflict (id) do update set rarity = excluded.rarity, pack_id = excluded.pack_id;

-- open_pack: the foil/gold pulls (kind = 'character', no pack_id filter — any character in the game
-- is a candidate) exclude 'australiana' so those six never surface as a foil or gold anywhere but
-- their own pack. New: guarantee_own forces the last slot into common/rare for a pack flagged that
-- way (Australiana) if neither of the first two slots already landed there.
create or replace function public.open_pack(p_pack text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text; result jsonb := '[]'; i int; total int; roll int; pick text;
        cid text; is_foil boolean; is_gold boolean; cap int; pts int; owned int; pk packs;
        got_foil boolean := false; got_gold boolean := false; got_own boolean := false;
        guarantee_foil boolean; guarantee_gold boolean; own_total int;
begin
  select username into uname from profiles where id = uid;
  select * into pk from packs where id = p_pack and active;
  if pk.id is null then raise exception 'That pack isn''t available'; end if;
  if pk.valid_until is not null and now() > pk.valid_until then raise exception '% is no longer available', pk.name; end if;
  select coalesce(sum(weight), 0) into total from pack_odds where pack_id = p_pack;
  if total <= 0 then raise exception 'That pack has no odds set'; end if;
  select coalesce((select weight from pack_odds where pack_id = p_pack and slot = 'foil'), 0) >= total * 0.5 into guarantee_foil;
  select coalesce((select weight from pack_odds where pack_id = p_pack and slot = 'gold'), 0) >= total * 0.5 into guarantee_gold;
  select coalesce((select sum(weight) from pack_odds where pack_id = p_pack and slot in ('common','rare')), 0) into own_total;
  update pack_stock set qty = qty - 1 where user_id = uid and pack_id = p_pack and qty > 0;
  if not found then
    if not pk.open_with_any then raise exception '% can only be opened with a pack of that exact type', pk.name; end if;
    update profiles set packs = packs - 1 where id = uid and packs > 0;
    if not found then raise exception 'No packs to open'; end if;
  end if;
  for i in 1..3 loop
    roll := floor(random() * total)::int;
    select o.slot into pick from (
      select slot, sum(weight) over (order by case slot when 'starter' then 1 when 'common' then 2 when 'rare' then 3 when 'foil' then 4 else 5 end) as upto
      from pack_odds where pack_id = p_pack and weight > 0) o
    where roll < o.upto order by o.upto limit 1;
    -- The last slot forces a guaranteed finish/own-card pull if none of the first two already gave one.
    if i = 3 then
      if guarantee_foil and not got_foil then pick := 'foil'; end if;
      if guarantee_gold and not got_gold then pick := 'gold'; end if;
      if pk.guarantee_own and not got_own and own_total > 0 then
        roll := floor(random() * own_total)::int;
        select case when roll < coalesce((select weight from pack_odds where pack_id = p_pack and slot = 'common'), 0) then 'common' else 'rare' end into pick;
      end if;
    end if;
    cid := null; is_foil := false; is_gold := false;
    if pick = 'common' then
      select id into cid from cards where pack_id = p_pack and rarity = 'common' order by random() limit 1; cap := 3; pts := 2; got_own := true;
    elsif pick = 'rare' then
      select id into cid from cards where pack_id = p_pack and rarity = 'rare' order by random() limit 1; cap := 1; pts := 5; got_own := true;
    elsif pick = 'foil' then
      select id into cid from cards where kind = 'character' and pack_id <> 'australiana' order by random() limit 1; is_foil := true; got_foil := true; cap := 1; pts := 5;
    elsif pick = 'gold' then
      select id into cid from cards where kind = 'character' and pack_id <> 'australiana' order by random() limit 1; is_gold := true; got_gold := true; cap := 1; pts := 5;
    end if;
    if cid is null then
      select id into cid from cards where rarity = 'base' order by random() limit 1;
      update profiles set grant_points = grant_points + 1 where id = uid;
      result := result || jsonb_build_object('id', cid, 'foil', false, 'gold', false, 'dupe', true, 'starter', true, 'points', 1);
      continue;
    end if;
    select coalesce(sum(qty), 0) into owned from collection where user_id = uid and card_id = cid and foil = is_foil and gold = is_gold;
    if owned >= cap then
      update profiles set grant_points = grant_points + pts where id = uid;
      result := result || jsonb_build_object('id', cid, 'foil', is_foil, 'gold', is_gold, 'dupe', true, 'starter', false, 'points', pts);
    else
      insert into collection (user_id, card_id, foil, gold, qty) values (uid, cid, is_foil, is_gold, 1)
        on conflict (user_id, card_id, foil, gold) do update set qty = collection.qty + 1;
      result := result || jsonb_build_object('id', cid, 'foil', is_foil, 'gold', is_gold, 'dupe', false, 'starter', false, 'points', 0);
    end if;
  end loop;
  insert into activity (user_id, username, kind, detail) values (uid, uname, 'pack_opened', jsonb_build_object('pack', pk.name, 'cards', result));
  return result;
end $$;
