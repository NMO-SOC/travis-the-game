-- Travis: The Game — upgrade 2: named packs with published odds, and the "SOC's Favourite" pack.
-- For a database that already ran schema.sql (and upgrade-1). Paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. (A fresh project doesn't need this: schema.sql already includes it.)
--
-- What it changes:
--   * Admins can give packs to a player, or to everyone, from the Admin screen.
--   * Two packs: "Term One" (the original pack) and "SOC's Favourite".
--   * Blue Suit, Fire Drill and Parent-Teacher Knox stop being starter cards and join Yard Duty Knox
--     in SOC's Favourite. Players who signed up before this upgrade keep those three (they had them
--     as starters), so nobody loses a card.
--   * Every card in a pack is rolled from that pack's odds (the pack_odds table): usually a starter
--     card, with a chance of a new card from that pack. To change the odds later, just edit the weights:
--       update public.pack_odds set weight = 30 where pack_id = 'socs-favourite' and slot = 'rare';

-- ---------------------------------------------------------------- packs and their odds
create table if not exists public.packs (
  id     text primary key,
  name   text not null,
  blurb  text not null default '',
  sort   int  not null default 0,
  active boolean not null default true
);
-- Each of the 3 cards in a pack is rolled separately. A slot's chance = its weight / the pack's total.
--   starter = a starter card (everyone already owns these, so it becomes 1 Grant Point)
--   common  = a new action card from this pack      rare = a new character from this pack
--   foil    = a foil of a starter character
create table if not exists public.pack_odds (
  pack_id text not null references public.packs(id) on delete cascade,
  slot    text not null check (slot in ('starter','common','rare','foil')),
  weight  int  not null check (weight >= 0),
  primary key (pack_id, slot)
);
alter table public.packs     enable row level security;
alter table public.pack_odds enable row level security;
drop policy if exists "packs are public" on public.packs;
drop policy if exists "pack odds are public" on public.pack_odds;
create policy "packs are public"     on public.packs     for select using (true);
create policy "pack odds are public" on public.pack_odds for select using (true);

insert into public.packs (id, name, blurb, sort) values
  ('term-one',       'Term One',         'Harbour Seal and Conference Knox, plus five new action cards.', 1),
  ('socs-favourite', 'SOC’s Favourite', 'Seven fan-favourite Knoxes, from carnivals to talent shows. No new action cards, better odds of a new character.', 2)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, sort = excluded.sort;

insert into public.pack_odds (pack_id, slot, weight) values
  ('term-one', 'starter', 60), ('term-one', 'common', 25), ('term-one', 'rare', 12), ('term-one', 'foil', 3),
  ('socs-favourite', 'starter', 55), ('socs-favourite', 'common', 0), ('socs-favourite', 'rare', 40), ('socs-favourite', 'foil', 5)
on conflict (pack_id, slot) do nothing;   -- keeps any odds you've already tuned

-- ---------------------------------------------------------------- which pack each new card comes from
alter table public.cards add column if not exists pack_id text references public.packs(id);

-- Existing players had these three as starter cards: give them real copies before they stop being free.
insert into public.collection (user_id, card_id, foil, qty)
select p.id, c.id, false, 1
from public.profiles p
cross join (values ('blue-suit-knox'), ('fire-drill-knox'), ('parent-teacher-knox')) as c(id)
where exists (select 1 from public.cards k where k.id = c.id and k.rarity = 'base')   -- only the first time this runs
on conflict (user_id, card_id, foil) do update set qty = greatest(public.collection.qty, 1);

update public.cards set rarity = 'rare', pack_id = 'socs-favourite'
  where id in ('blue-suit-knox', 'fire-drill-knox', 'parent-teacher-knox', 'yard-duty-knox');
update public.cards set pack_id = 'term-one'
  where pack_id is null and rarity in ('common', 'rare');

-- ---------------------------------------------------------------- opening a pack
drop function if exists public.open_pack();
create or replace function public.open_pack(p_pack text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result jsonb := '[]'; i int; total int; roll int; pick text;
        cid text; is_foil boolean; cap int; pts int; owned int;
begin
  if not exists (select 1 from packs where id = p_pack and active) then raise exception 'That pack isn''t available'; end if;
  select coalesce(sum(weight), 0) into total from pack_odds where pack_id = p_pack;
  if total <= 0 then raise exception 'That pack has no odds set'; end if;
  update profiles set packs = packs - 1 where id = uid and packs > 0;
  if not found then raise exception 'No packs to open'; end if;
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

revoke all on function public.open_pack(text) from public, anon;
grant execute on function public.open_pack(text) to authenticated;

-- ---------------------------------------------------------------- admin: give packs
-- Adds packs to one player (by username), or to every player when p_username is null. Admins only.
create or replace function public.admin_give_packs(p_username text, p_count int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin) then raise exception 'Admins only'; end if;
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'Give between 1 and 100 packs at a time'; end if;
  if p_username is null then
    update profiles set packs = packs + p_count where packs >= 0;   -- every player (Supabase's API rejects an UPDATE with no WHERE)
    get diagnostics n = row_count;
  else
    update profiles set packs = packs + p_count where username = lower(p_username);
    get diagnostics n = row_count;
    if n = 0 then raise exception 'No player called %', p_username; end if;
  end if;
  return n;
end $$;
revoke all on function public.admin_give_packs(text, int) from public, anon;
grant execute on function public.admin_give_packs(text, int) to authenticated;
