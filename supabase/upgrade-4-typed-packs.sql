-- Travis: The Game — upgrade 4: packs of a specific type.
-- Run after upgrade 3. Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
-- Until now every pack was an "any type" pack: you pick Term One or SOC's Favourite when you open it.
-- Admins can now also give packs of one specific type. Those can only be opened as that pack.
-- Packs earned by winning stay "any type". Opening a pack uses a matching specific pack first.

-- How many packs of each specific type a player holds (any-type packs stay in profiles.packs).
create table if not exists public.pack_stock (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_id text not null references public.packs(id) on delete cascade,
  qty     int  not null default 0 check (qty >= 0),
  primary key (user_id, pack_id)
);
alter table public.pack_stock enable row level security;
drop policy if exists "read own pack stock" on public.pack_stock;
create policy "read own pack stock" on public.pack_stock for select to authenticated using (user_id = auth.uid());

-- Opening a pack now spends a matching specific-type pack first.
create or replace function public.open_pack(p_pack text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result jsonb := '[]'; i int; total int; roll int; pick text;
        cid text; is_foil boolean; cap int; pts int; owned int;
begin
  if not exists (select 1 from packs where id = p_pack and active) then raise exception 'That pack isn''t available'; end if;
  select coalesce(sum(weight), 0) into total from pack_odds where pack_id = p_pack;
  if total <= 0 then raise exception 'That pack has no odds set'; end if;
  -- Use a pack of this exact type if they have one (given by an admin), otherwise an any-type pack.
  update pack_stock set qty = qty - 1 where user_id = uid and pack_id = p_pack and qty > 0;
  if not found then
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

-- Give packs: p_pack null = any-type packs, otherwise packs of that type. p_username null = every player.
drop function if exists public.admin_give_packs(text, int);
create or replace function public.admin_give_packs(p_username text, p_count int, p_pack text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin) then raise exception 'Admins only'; end if;
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'Give between 1 and 100 packs at a time'; end if;
  if p_pack is not null and not exists (select 1 from packs where id = p_pack) then raise exception 'There''s no pack called %', p_pack; end if;
  if p_pack is null then
    update profiles set packs = packs + p_count
      where (p_username is null or username = lower(p_username)) and packs >= 0;
  else
    insert into pack_stock (user_id, pack_id, qty)
      select id, p_pack, p_count from profiles where p_username is null or username = lower(p_username)
      on conflict (user_id, pack_id) do update set qty = pack_stock.qty + excluded.qty;
  end if;
  get diagnostics n = row_count;
  if p_username is not null and n = 0 then raise exception 'No player called %', p_username; end if;
  return n;
end $$;

-- admin_player also reports the specific-type packs a player is holding.
create or replace function public.admin_player(p_username text) returns jsonb
language sql security definer set search_path = public stable as $$
  select case when not exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin) then null
  else jsonb_build_object(
    'collection', coalesce((select jsonb_agg(jsonb_build_object('card_id', c.card_id, 'foil', c.foil, 'qty', c.qty) order by c.card_id)
                            from collection c join profiles p on p.id = c.user_id where p.username = lower(p_username) and c.qty > 0), '[]'::jsonb),
    'games', coalesce((select jsonb_agg(x order by x.ended_at desc) from (
                         select g.mode, g.difficulty, g.size, g.result, g.rounds, g.seconds, g.opponent, g.deck_name, g.ended_at
                         from games g join profiles p on p.id = g.user_id
                         where p.username = lower(p_username) order by g.ended_at desc limit 30) x), '[]'::jsonb),
    'packs', coalesce((select jsonb_object_agg(s.pack_id, s.qty)
                       from pack_stock s join profiles p on p.id = s.user_id where p.username = lower(p_username) and s.qty > 0), '{}'::jsonb)
  ) end;
$$;

revoke all on function public.admin_give_packs(text, int, text) from public, anon;
grant execute on function public.admin_give_packs(text, int, text) to authenticated;
