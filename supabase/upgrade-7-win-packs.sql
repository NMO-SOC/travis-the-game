-- Travis: The Game — upgrade 7: winning a battle gives a specific pack, not a choice of any.
-- Run after upgrade 6. Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
-- Each pack gets a win_weight (0 = never given for a win). A win rolls one pack from the weighted
-- pool of active, non-expired, win_weight > 0 packs, and adds it to that player's stock of that exact
-- pack (pack_stock) — the same mechanism admin-given packs use. Tune later with e.g.:
--   update public.packs set win_weight = 30 where id = 'field-season';

alter table public.packs add column if not exists win_weight int not null default 0 check (win_weight >= 0);
update public.packs set win_weight = case id
  when 'term-one' then 40
  when 'socs-favourite' then 20
  when 'field-season' then 20
  when 'end-of-year' then 20
  else 0
end where id in ('term-one','socs-favourite','field-season','end-of-year','holo','legendary');

create or replace function public.record_win() returns text
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
