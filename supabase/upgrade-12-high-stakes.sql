-- Travis: The Game — upgrade 12: High Stakes, a second way to earn packs alongside the five free
-- daily wins. Only on Hard CPU or Online games, a player can stake Grant Points before the match:
-- win and get a bonus pack (doesn't touch the daily cap), lose and forfeit the stake.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

create function public.wager_battle(p_stake int, p_won boolean, p_mode text, p_difficulty text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pts int; total int; roll int; won_pack text;
begin
  if p_stake < 10 or p_stake > 100 then raise exception 'Stakes run 10 to 100 Grant Points.'; end if;
  if not (p_mode = 'online' or (p_mode = 'cpu' and p_difficulty = 'hard')) then
    raise exception 'High Stakes is only for Hard CPU or Online games.';
  end if;
  if not p_won then
    update profiles set grant_points = greatest(0, grant_points - p_stake) where id = uid
      returning grant_points into pts;
    if not found then raise exception 'Not signed in'; end if;
    return jsonb_build_object('won', false, 'lost', p_stake, 'grant_points', pts);
  end if;
  -- Same odds shape as a free win: a 1-in-3 chance of a Holo or Legendary pack instead of a normal one.
  if random() < 1.0/3 then
    won_pack := case when random() < 0.5 then 'holo' else 'legendary' end;
    insert into pack_stock (user_id, pack_id, qty) values (uid, won_pack, 1)
      on conflict (user_id, pack_id) do update set qty = pack_stock.qty + 1;
    return jsonb_build_object('won', true, 'pack', won_pack);
  end if;
  select coalesce(sum(win_weight), 0) into total from packs
    where win_weight > 0 and active and (valid_until is null or now() <= valid_until);
  if total <= 0 then
    update profiles set packs = packs + 1 where id = uid;
    return jsonb_build_object('won', true, 'pack', 'any');
  end if;
  roll := floor(random() * total)::int;
  select x.id into won_pack from (
    select id, sum(win_weight) over (order by id) as upto from packs
    where win_weight > 0 and active and (valid_until is null or now() <= valid_until)
  ) x where roll < x.upto order by x.upto limit 1;
  insert into pack_stock (user_id, pack_id, qty) values (uid, won_pack, 1)
    on conflict (user_id, pack_id) do update set qty = pack_stock.qty + 1;
  return jsonb_build_object('won', true, 'pack', won_pack);
end $$;

revoke all on function public.wager_battle(int, boolean, text, text) from public, anon;
grant execute on function public.wager_battle(int, boolean, text, text) to authenticated;
