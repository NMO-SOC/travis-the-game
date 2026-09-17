-- Travis: The Game — upgrade 22: fixes from the 17 Sep 2026 code review of main.
--   #16 open_pack: the foil/gold pool filter `pack_id <> 'australiana'` also dropped every card with a
--       null pack_id (all starter characters, Chairman Knox), because null <> x is null, not true.
--       Now `is distinct from`, and story cards (upgrade 21, also null pack_id) are kept out explicitly.
--   #17 record_win / wager_battle: upgrade 19 redefined both from pre-activity-feed copies, so pack wins
--       and wager losses stopped showing in the home-screen feed. Activity inserts restored.
--   #18 wager_battle: the stake is now checked against the player's Grant Points up front, instead of a
--       loss quietly clamping to 0 (which let a player stake more than they had).
-- Needs upgrades 13 (activity), 16 (australiana), 19 (insane) and 21 (story rarity; harmless without it).
-- Function bodies are otherwise copied unchanged from upgrade 16 / upgrade 19.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

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
      select id into cid from cards where kind = 'character' and pack_id is distinct from 'australiana' and rarity <> 'story' order by random() limit 1; is_foil := true; got_foil := true; cap := 1; pts := 5;
    elsif pick = 'gold' then
      select id into cid from cards where kind = 'character' and pack_id is distinct from 'australiana' and rarity <> 'story' order by random() limit 1; is_gold := true; got_gold := true; cap := 1; pts := 5;
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

create or replace function public.record_win(p_difficulty text default null) returns text
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Australia/Sydney')::date; p profiles;
        total int; roll int; won_pack text;
begin
  select * into p from profiles where id = auth.uid() for update;
  if not found then raise exception 'Not signed in'; end if;
  if p.wins_day is distinct from today then p.wins_today := 0; end if;
  if p.wins_today >= 5 then
    update profiles set wins_day = today, wins_today = p.wins_today where id = p.id;
    return null;
  end if;
  if p_difficulty = 'insane' and random() < 1.0/3 then
    won_pack := case when random() < 0.5 then 'holo' else 'legendary' end;
    insert into pack_stock (user_id, pack_id, qty) values (p.id, won_pack, 1)
      on conflict (user_id, pack_id) do update set qty = pack_stock.qty + 1;
    update profiles set wins_day = today, wins_today = p.wins_today + 1 where id = p.id;
    insert into activity (user_id, username, kind, detail) values (p.id, p.username, 'pack_won', jsonb_build_object('pack', won_pack, 'source', 'win'));
    return won_pack;
  end if;
  select coalesce(sum(win_weight), 0) into total from packs
    where win_weight > 0 and active and (valid_until is null or now() <= valid_until);
  if total <= 0 then
    update profiles set packs = packs + 1, wins_day = today, wins_today = p.wins_today + 1 where id = p.id;
    insert into activity (user_id, username, kind, detail) values (p.id, p.username, 'pack_won', jsonb_build_object('pack', 'any', 'source', 'win'));
    return 'any';
  end if;
  roll := floor(random() * total)::int;
  select x.id into won_pack from (
    select id, sum(win_weight) over (order by id) as upto from packs
    where win_weight > 0 and active and (valid_until is null or now() <= valid_until)
  ) x where roll < x.upto order by x.upto limit 1;
  insert into pack_stock (user_id, pack_id, qty) values (p.id, won_pack, 1)
    on conflict (user_id, pack_id) do update set qty = pack_stock.qty + 1;
  update profiles set wins_day = today, wins_today = p.wins_today + 1 where id = p.id;
  insert into activity (user_id, username, kind, detail) values (p.id, p.username, 'pack_won', jsonb_build_object('pack', won_pack, 'source', 'win'));
  return won_pack;
end $$;

revoke all on function public.record_win(text) from public, anon;
grant execute on function public.record_win(text) to authenticated;

create or replace function public.wager_battle(p_stake int, p_won boolean, p_mode text, p_difficulty text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text; pts int; total int; roll int; won_pack text;
begin
  if p_stake < 10 or p_stake > 100 then raise exception 'Stakes run 10 to 100 Grant Points.'; end if;
  if not (p_mode = 'online' or (p_mode = 'cpu' and p_difficulty in ('hard', 'insane'))) then
    raise exception 'High Stakes is only for Hard/Insane CPU or Online games.';
  end if;
  -- #18: the stake must actually be affordable, checked here rather than trusted from the menu.
  select username, grant_points into uname, pts from profiles where id = uid for update;
  if uname is null then raise exception 'Not signed in'; end if;
  if pts < p_stake then raise exception 'Not enough Grant Points for that stake.'; end if;
  if not p_won then
    update profiles set grant_points = grant_points - p_stake where id = uid
      returning grant_points into pts;
    insert into activity (user_id, username, kind, detail) values (uid, uname, 'wager_lost', jsonb_build_object('stake', p_stake));
    return jsonb_build_object('won', false, 'lost', p_stake, 'grant_points', pts);
  end if;
  if random() < 1.0/3 then
    won_pack := case when random() < 0.5 then 'holo' else 'legendary' end;
    insert into pack_stock (user_id, pack_id, qty) values (uid, won_pack, 1)
      on conflict (user_id, pack_id) do update set qty = pack_stock.qty + 1;
    insert into activity (user_id, username, kind, detail) values (uid, uname, 'pack_won', jsonb_build_object('pack', won_pack, 'source', 'wager'));
    return jsonb_build_object('won', true, 'pack', won_pack);
  end if;
  select coalesce(sum(win_weight), 0) into total from packs
    where win_weight > 0 and active and (valid_until is null or now() <= valid_until);
  if total <= 0 then
    update profiles set packs = packs + 1 where id = uid;
    insert into activity (user_id, username, kind, detail) values (uid, uname, 'pack_won', jsonb_build_object('pack', 'any', 'source', 'wager'));
    return jsonb_build_object('won', true, 'pack', 'any');
  end if;
  roll := floor(random() * total)::int;
  select x.id into won_pack from (
    select id, sum(win_weight) over (order by id) as upto from packs
    where win_weight > 0 and active and (valid_until is null or now() <= valid_until)
  ) x where roll < x.upto order by x.upto limit 1;
  insert into pack_stock (user_id, pack_id, qty) values (uid, won_pack, 1)
    on conflict (user_id, pack_id) do update set qty = pack_stock.qty + 1;
  insert into activity (user_id, username, kind, detail) values (uid, uname, 'pack_won', jsonb_build_object('pack', won_pack, 'source', 'wager'));
  return jsonb_build_object('won', true, 'pack', won_pack);
end $$;

revoke all on function public.wager_battle(int, boolean, text, text) from public, anon;
grant execute on function public.wager_battle(int, boolean, text, text) to authenticated;
