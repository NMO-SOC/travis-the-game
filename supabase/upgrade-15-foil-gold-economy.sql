-- Travis: The Game — upgrade 15: foils and gold become a generic finish any character can have,
-- instead of foil being base-characters-only and gold being five separate hand-authored cards.
-- Foils can no longer be bought — the only way to get one is a pack, and Holo now GUARANTEES at
-- least one foil per pack (was ~90% per slot, not a hard guarantee). Legendary does the same for gold.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once (guarded migration steps skip
-- themselves once already applied).

alter table public.collection add column if not exists gold boolean not null default false;
alter table public.decks add column if not exists golds text[] not null default '{}';

do $$ begin
  alter table public.collection drop constraint collection_pkey;
  alter table public.collection add constraint collection_pkey primary key (user_id, card_id, foil, gold);
exception when undefined_object then null; -- already migrated
end $$;
alter table public.collection drop constraint if exists collection_not_both;
alter table public.collection add constraint collection_not_both check (not (foil and gold));

alter table public.pack_odds drop constraint if exists pack_odds_slot_check;
alter table public.pack_odds add constraint pack_odds_slot_check check (slot in ('starter','common','rare','foil','gold'));

-- ---------------------------------------------------------------- retire the five hand-authored
-- golden-* characters: fold each into its original card as a gold-finish copy (merging quantities),
-- and rewrite any deck that used one to use the original with a golds entry instead. Running this
-- twice is harmless — by the second run the golden-* rows are gone from collection/decks already.
do $$
declare
  pairs text[][] := array[
    array['golden-doctor-knox','doctor-knox'], array['golden-beer-frog-knox','beer-frog-knox'],
    array['golden-elephant-seal-knox','elephant-seal-knox'], array['golden-leopard-seal-knox','leopard-seal-knox'],
    array['golden-emeritus-knox','emeritus-knox']
  ];
  p text[];
  d record;
  filler text;
  new_chars text[];
begin
  foreach p slice 1 in array pairs loop
    insert into collection (user_id, card_id, foil, gold, qty)
      select user_id, p[2], false, true, qty from collection where card_id = p[1]
    on conflict (user_id, card_id, foil, gold) do update set qty = collection.qty + excluded.qty;
    delete from collection where card_id = p[1];
    -- One row per affected deck, so the rare case where a deck already has both the golden card AND
    -- its original (array_replace would then create a duplicate, which check_deck rightly rejects)
    -- can be handled by filling that slot with a different base character instead of just erroring.
    for d in select * from decks where p[1] = any(characters) loop
      if p[2] = any(d.characters) then
        select c.id into filler from cards c
          where c.kind = 'character' and c.rarity = 'base' and c.id <> all(d.characters) limit 1;
        new_chars := array_replace(d.characters, p[1], filler);
        update decks set characters = new_chars where id = d.id; -- golds untouched: filler isn't gold
      else
        update decks set characters = array_replace(d.characters, p[1], p[2]), golds = array_append(d.golds, p[2]) where id = d.id;
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------- decks must own what they use
create or replace function public.check_deck() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text; n int; owned int; r text;
begin
  if (select count(distinct x) from unnest(new.characters) x) <> 6 then
    raise exception 'A deck needs six different characters';
  end if;
  foreach c in array new.characters loop
    select rarity into r from cards where id = c and kind = 'character';
    if r is null then raise exception 'Unknown character %', c; end if;
    if r <> 'base' and not exists (select 1 from collection where user_id = new.user_id and card_id = c and not foil and not gold and qty > 0) then
      raise exception 'You don''t own %', c;
    end if;
  end loop;
  for c, n in select x, count(*) from unnest(new.actions) x group by x loop
    select rarity into r from cards where id = c and kind = 'action';
    if r is null then raise exception 'Unknown action card %', c; end if;
    if n > 3 then raise exception 'At most three copies of each action card'; end if;
    if r <> 'base' then
      select coalesce(sum(qty), 0) into owned from collection where user_id = new.user_id and card_id = c and not foil and not gold;
      if n > owned then raise exception 'You only own % of %', owned, c; end if;
    end if;
  end loop;
  foreach c in array new.foils loop
    if not (c = any(new.characters)) or not exists (select 1 from collection where user_id = new.user_id and card_id = c and foil and qty > 0) then
      raise exception 'You don''t own a foil %', c;
    end if;
  end loop;
  foreach c in array new.golds loop
    if not (c = any(new.characters)) or not exists (select 1 from collection where user_id = new.user_id and card_id = c and gold and qty > 0) then
      raise exception 'You don''t own a gold %', c;
    end if;
    if c = any(new.foils) then raise exception '% can''t be shown as both foil and gold', c; end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- foils are pack-only now
create or replace function public.buy_card(card text, want_foil boolean) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r text; k text; price int; cap int; owned int; left_pts int;
begin
  if want_foil then raise exception 'Foils only come from packs now — Holo guarantees one.'; end if;
  select rarity, kind into r, k from cards where id = card;
  if r is null then raise exception 'Unknown card'; end if;
  if r = 'common' then price := 8; cap := 3;
  elsif r = 'rare' then price := 20; cap := 1;
  else raise exception 'You already own every base card';
  end if;
  select coalesce(sum(qty), 0) into owned from collection where user_id = uid and card_id = card and not foil and not gold;
  if owned >= cap then raise exception 'You already have as many as a deck can use'; end if;
  update profiles set grant_points = grant_points - price where id = uid and grant_points >= price returning grant_points into left_pts;
  if left_pts is null then raise exception 'Not enough Grant Points'; end if;
  insert into collection (user_id, card_id, foil, gold, qty) values (uid, card, false, false, 1)
    on conflict (user_id, card_id, foil, gold) do update set qty = collection.qty + 1;
  return left_pts;
end $$;

-- The 2-arg sell_card(text, boolean) is a different signature to Postgres, so create-or-replace below
-- would leave it behind as a stale overload rather than replace it — drop it explicitly.
drop function if exists public.sell_card(text, boolean);
create or replace function public.sell_card(card text, is_foil boolean, is_gold boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r text; price int; owned int; left_pts int;
begin
  if is_foil and is_gold then raise exception 'A card can''t be both foil and gold.'; end if;
  select rarity into r from cards where id = card;
  if r is null then raise exception 'Unknown card'; end if;
  if r = 'base' and not is_foil and not is_gold then raise exception 'Starter cards can''t be sold: everyone already owns them.'; end if;
  select qty into owned from collection where user_id = uid and card_id = card and foil = is_foil and gold = is_gold;
  if owned is null or owned < 1 then raise exception 'You don''t own that card.'; end if;
  if is_foil or is_gold then price := 7;
  elsif r = 'common' then price := 4;
  elsif r = 'rare' then price := 10;
  else raise exception 'That card can''t be sold.';
  end if;
  update collection set qty = qty - 1 where user_id = uid and card_id = card and foil = is_foil and gold = is_gold;
  delete from collection where user_id = uid and card_id = card and foil = is_foil and gold = is_gold and qty <= 0;
  update profiles set grant_points = grant_points + price where id = uid returning grant_points into left_pts;
  return left_pts;
end $$;

-- ---------------------------------------------------------------- open_pack: any character can be
-- the foil or gold pull now (not just base characters / five specific golds), and a pack whose odds
-- are foil- or gold-heavy (Holo, Legendary) guarantees at least one of that finish per pack instead
-- of leaving it to chance on every slot.
create or replace function public.open_pack(p_pack text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text; result jsonb := '[]'; i int; total int; roll int; pick text;
        cid text; is_foil boolean; is_gold boolean; cap int; pts int; owned int; pk packs;
        got_foil boolean := false; got_gold boolean := false;
        guarantee_foil boolean; guarantee_gold boolean;
begin
  select username into uname from profiles where id = uid;
  select * into pk from packs where id = p_pack and active;
  if pk.id is null then raise exception 'That pack isn''t available'; end if;
  if pk.valid_until is not null and now() > pk.valid_until then raise exception '% is no longer available', pk.name; end if;
  select coalesce(sum(weight), 0) into total from pack_odds where pack_id = p_pack;
  if total <= 0 then raise exception 'That pack has no odds set'; end if;
  select coalesce((select weight from pack_odds where pack_id = p_pack and slot = 'foil'), 0) >= total * 0.5 into guarantee_foil;
  select coalesce((select weight from pack_odds where pack_id = p_pack and slot = 'gold'), 0) >= total * 0.5 into guarantee_gold;
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
    -- The last slot forces the guaranteed finish if none of the first two already gave one.
    if i = 3 then
      if guarantee_foil and not got_foil then pick := 'foil'; end if;
      if guarantee_gold and not got_gold then pick := 'gold'; end if;
    end if;
    cid := null; is_foil := false; is_gold := false;
    if pick = 'common' then
      select id into cid from cards where pack_id = p_pack and rarity = 'common' order by random() limit 1; cap := 3; pts := 2;
    elsif pick = 'rare' then
      select id into cid from cards where pack_id = p_pack and rarity = 'rare' order by random() limit 1; cap := 1; pts := 5;
    elsif pick = 'foil' then
      select id into cid from cards where kind = 'character' order by random() limit 1; is_foil := true; got_foil := true; cap := 1; pts := 5;
    elsif pick = 'gold' then
      select id into cid from cards where kind = 'character' order by random() limit 1; is_gold := true; got_gold := true; cap := 1; pts := 5;
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

-- Legendary used to pull one of five specific golden-* cards via its 'rare' slot; those cards are
-- retired above, so switch it to the new generic 'gold' slot (any character, guaranteed by the same
-- >=50%-of-total rule as Holo's foil slot).
insert into public.pack_odds (pack_id, slot, weight) values ('legendary', 'gold', 85)
  on conflict (pack_id, slot) do update set weight = excluded.weight;
update public.pack_odds set weight = 0 where pack_id = 'legendary' and slot = 'rare';

update public.packs set blurb = 'Every character is a candidate. Guaranteed at least one foil per pack.' where id = 'holo';
update public.packs set blurb = 'Every character is a candidate. Guaranteed at least one gold per pack.' where id = 'legendary';

revoke all on function public.sell_card(text, boolean, boolean) from public, anon;
grant execute on function public.sell_card(text, boolean, boolean) to authenticated;
