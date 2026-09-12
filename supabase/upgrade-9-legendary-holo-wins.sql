-- Travis: The Game — upgrade 9: Holo and Legendary are no longer admin-gift only, and every battle
-- win has a 1-in-3 chance of being upgraded to one of them instead of a normal pack.
-- Run after upgrade 8. Paste into Supabase → SQL Editor → Run. Safe to run more than once.

update public.packs set open_with_any = true,
  blurb = 'Every card is a foil of a starter character. A rare 1-in-3 bonus on any battle-win pack.'
  where id = 'holo';
update public.packs set open_with_any = true,
  blurb = 'Gold editions of fan-favourite Knoxes. A rare 1-in-3 bonus on any battle-win pack.'
  where id = 'legendary';

drop function if exists public.record_win();
create function public.record_win() returns text
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
  -- 1 in 3 chance any win is upgraded to a Holo or Legendary pack instead of a normal one.
  if random() < 1.0/3 then
    won_pack := case when random() < 0.5 then 'holo' else 'legendary' end;
    insert into pack_stock (user_id, pack_id, qty) values (p.id, won_pack, 1)
      on conflict (user_id, pack_id) do update set qty = pack_stock.qty + 1;
    update profiles set wins_day = today, wins_today = p.wins_today + 1 where id = p.id;
    return won_pack;
  end if;
  select coalesce(sum(win_weight), 0) into total from packs
    where win_weight > 0 and active and (valid_until is null or now() <= valid_until);
  if total <= 0 then
    -- No eligible pack configured (or all expired): fall back to the old any-type pack rather than error.
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

-- Dropping the function above reset its permissions; put them back (same as schema.sql).
revoke all on function public.record_win() from public, anon;
grant execute on function public.record_win() to authenticated;
