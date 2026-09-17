-- Travis: The Game — upgrade 19: an Insane CPU difficulty, above Hard.
-- The CPU itself is entirely client-side (see DIFF.insane in play.js — zero noise, zero fumble,
-- most eager to play cards); this migration only widens what the server accepts for that
-- difficulty and makes it pay out better, to match "almost impossible, much better rewards":
--   - XP: a bigger multiplier than Hard's 1.4.
--   - Free win (record_win) and High Stakes (wager_battle) both get the same 1-in-3 Holo/Legendary
--     shot that was previously online-only-strength odds, so a signed-in win on Insane is worth
--     chasing the same way an online win is.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

alter table public.games drop constraint if exists games_difficulty_check;
alter table public.games add constraint games_difficulty_check
  check (difficulty in ('easy','medium','hard','insane'));

create or replace function public.log_game(p_mode text, p_difficulty text, p_size int, p_result text,
  p_rounds int, p_seconds int, p_opponent text, p_deck text) returns void
language plpgsql security definer set search_path = public as $$
declare v_xp int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  v_xp := case when p_result = 'quit' then 0 else
    round((8 + case when p_result = 'win' then 12 else 0 end) *
      case when p_mode = 'online' then 1.2
           when p_difficulty = 'insane' then 1.8
           when p_difficulty = 'hard' then 1.4
           when p_difficulty = 'easy' then 0.75
           else 1 end)::int
  end;
  insert into games (user_id, mode, difficulty, size, result, rounds, seconds, opponent, deck_name, xp)
  values (auth.uid(), p_mode, case when p_mode = 'cpu' then p_difficulty end, p_size, p_result,
          least(greatest(coalesce(p_rounds, 0), 0), 999), least(greatest(coalesce(p_seconds, 0), 0), 86400),
          left(p_opponent, 30), left(p_deck, 30), v_xp);
  update profiles set last_seen = now(), xp = profiles.xp + v_xp where id = auth.uid();
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
    return won_pack;
  end if;
  select coalesce(sum(win_weight), 0) into total from packs
    where win_weight > 0 and active and (valid_until is null or now() <= valid_until);
  if total <= 0 then
    update profiles set packs = packs + 1, wins_day = today, wins_today = p.wins_today + 1 where id = p.id;
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
  return won_pack;
end $$;

revoke all on function public.record_win(text) from public, anon;
grant execute on function public.record_win(text) to authenticated;

create or replace function public.wager_battle(p_stake int, p_won boolean, p_mode text, p_difficulty text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pts int; total int; roll int; won_pack text;
begin
  if p_stake < 10 or p_stake > 100 then raise exception 'Stakes run 10 to 100 Grant Points.'; end if;
  if not (p_mode = 'online' or (p_mode = 'cpu' and p_difficulty in ('hard', 'insane'))) then
    raise exception 'High Stakes is only for Hard/Insane CPU or Online games.';
  end if;
  if not p_won then
    update profiles set grant_points = greatest(0, grant_points - p_stake) where id = uid
      returning grant_points into pts;
    if not found then raise exception 'Not signed in'; end if;
    return jsonb_build_object('won', false, 'lost', p_stake, 'grant_points', pts);
  end if;
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
