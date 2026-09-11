-- Travis: The Game — database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then Run.
-- Run it ONCE on a fresh project. Re-running drops and recreates the game tables, which wipes every
-- player's profile, collection and decks (their logins survive but would need profiles again).

-- ---------------------------------------------------------------- cleanup
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.username_available(text) cascade;
drop function if exists public.claim_daily() cascade;
drop function if exists public.record_win() cascade;
drop function if exists public.open_pack() cascade;
drop function if exists public.open_pack(text) cascade;
drop function if exists public.buy_card(text, boolean) cascade;
drop function if exists public.check_deck() cascade;
drop function if exists public.admin_overview() cascade;
drop function if exists public.admin_decks() cascade;
drop function if exists public.admin_games(int) cascade;
drop function if exists public.admin_player(text) cascade;
drop function if exists public.log_game(text, text, int, text, int, int, text, text) cascade;
drop function if exists public.touch_seen() cascade;
drop function if exists public.admin_give_packs(text, int) cascade;
drop function if exists public.admin_give_packs(text, int, text) cascade;
drop function if exists public.leaderboard() cascade;
drop table if exists public.games cascade;
drop table if exists public.pack_stock cascade;
drop table if exists public.decks cascade;
drop table if exists public.collection cascade;
drop table if exists public.profiles cascade;
drop table if exists public.cards cascade;
drop table if exists public.pack_odds cascade;
drop table if exists public.packs cascade;

-- ---------------------------------------------------------------- packs and their odds
create table public.packs (
  id            text primary key,
  name          text not null,
  blurb         text not null default '',
  sort          int  not null default 0,
  active        boolean not null default true,
  valid_until   timestamptz,             -- null = no expiry; past this, the pack can no longer be opened
  open_with_any boolean not null default true,  -- false = only openable with a pack of this exact type (admin-gift only)
  win_weight    int  not null default 0 check (win_weight >= 0)  -- 0 = never given for winning a battle
);
-- Each of the 3 cards in a pack is rolled separately. A slot's chance = its weight / the pack's total.
--   starter = a starter card (everyone already owns these, so it becomes 1 Grant Point)
--   common  = a new action card from this pack      rare = a new character from this pack
--   foil    = a foil of a starter character
-- Tune later with e.g.: update public.pack_odds set weight = 30 where pack_id = 'socs-favourite' and slot = 'rare';
create table public.pack_odds (
  pack_id text not null references public.packs(id) on delete cascade,
  slot    text not null check (slot in ('starter','common','rare','foil')),
  weight  int  not null check (weight >= 0),
  primary key (pack_id, slot)
);
insert into public.packs (id, name, blurb, sort, valid_until, open_with_any, win_weight) values
  ('term-one',       'Term One',        'Harbour Seal and Conference Knox, plus five new action cards.', 1, null, true, 40),
  ('socs-favourite', 'SOC’s Favourite', 'Seven fan-favourite Knoxes, from carnivals to talent shows. No new action cards, better odds of a new character.', 2, null, true, 20),
  ('field-season',   'Field Season',    'Four new specimens from the sub-Antarctic, plus two new action cards.', 3, null, true, 20),
  ('end-of-year',    'End of Year',     'Three characters for the end of the school year. Available until 31 December.', 4, '2026-12-31 23:59:59+11', true, 20),
  ('holo',           'Holo',            'Every card is a foil of a starter character. Only ever given, never pulled from an ordinary pack.', 5, null, false, 0),
  ('legendary',      'Legendary',       'Gold editions of fan-favourite Knoxes. Only ever given, never pulled from an ordinary pack.', 6, null, false, 0);
insert into public.pack_odds (pack_id, slot, weight) values
  ('term-one', 'starter', 60), ('term-one', 'common', 25), ('term-one', 'rare', 12), ('term-one', 'foil', 3),
  ('socs-favourite', 'starter', 55), ('socs-favourite', 'common', 0), ('socs-favourite', 'rare', 40), ('socs-favourite', 'foil', 5),
  ('field-season', 'starter', 55), ('field-season', 'common', 25), ('field-season', 'rare', 15), ('field-season', 'foil', 5),
  ('end-of-year', 'starter', 60), ('end-of-year', 'common', 0), ('end-of-year', 'rare', 35), ('end-of-year', 'foil', 5),
  ('holo', 'starter', 10), ('holo', 'common', 0), ('holo', 'rare', 0), ('holo', 'foil', 90),
  -- 'rare' here means "one of the five golden characters" (pack_id = 'legendary', rarity = 'rare' —
  -- the gold finish is the card itself, not a foil of something else).
  ('legendary', 'starter', 15), ('legendary', 'common', 0), ('legendary', 'rare', 85), ('legendary', 'foil', 0);

-- ---------------------------------------------------------------- card catalogue
-- rarity: base = a starter card everyone owns; common/rare = found in the pack named by pack_id.
-- Foils exist for every starter character.
create table public.cards (
  id      text primary key,
  kind    text not null check (kind in ('character','action')),
  rarity  text not null check (rarity in ('base','common','rare')),
  pack_id text references public.packs(id)
);
insert into public.cards (id, kind, rarity, pack_id) values
  ('doctor-knox','character','base',null), ('director-knox','character','base',null), ('beer-frog-knox','character','base',null),
  ('family-man-knox','character','base',null), ('seal-whisperer-knox','character','base',null), ('mixtape-knox','character','base',null),
  ('chaperone-knox','character','base',null), ('field-researcher-knox','character','base',null), ('elephant-seal-knox','character','base',null),
  ('leopard-seal-knox','character','base',null), ('staff-meeting-knox','character','base',null), ('tadpole-knox','character','base',null),
  ('emeritus-knox','character','base',null),
  ('harbour-seal-knox','character','rare','term-one'), ('sports-carnival-knox','character','rare','socs-favourite'),
  ('conference-knox','character','rare','term-one'), ('swimming-carnival-knox','character','rare','socs-favourite'),
  ('socs-got-talent-knox','character','rare','socs-favourite'),
  ('yard-duty-knox','character','rare','socs-favourite'), ('parent-teacher-knox','character','rare','socs-favourite'),
  ('fire-drill-knox','character','rare','socs-favourite'), ('blue-suit-knox','character','rare','socs-favourite'),
  ('cat','action','base',null), ('canteen','action','base',null), ('excursion','action','base',null), ('dlc','action','base',null),
  ('detention','action','base',null),
  ('reports','action','common','term-one'), ('photo-day','action','common','term-one'), ('uniform-check','action','common','term-one'),
  ('assembly','action','common','term-one'), ('low-tide','action','common','term-one'),
  ('fur-seal-knox','character','rare','field-season'), ('weddell-seal-knox','character','rare','field-season'),
  ('sea-lion-knox','character','rare','field-season'), ('research-vessel-knox','character','rare','field-season'),
  ('tagging-dart','action','common','field-season'), ('fog-bank','action','common','field-season'),
  ('graduation-knox','character','rare','end-of-year'), ('yearbook-knox','character','rare','end-of-year'),
  ('staff-party-knox','character','rare','end-of-year'),
  ('golden-doctor-knox','character','rare','legendary'), ('golden-beer-frog-knox','character','rare','legendary'),
  ('golden-elephant-seal-knox','character','rare','legendary'), ('golden-leopard-seal-knox','character','rare','legendary'),
  ('golden-emeritus-knox','character','rare','legendary');

-- ---------------------------------------------------------------- players
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  packs        int  not null default 1 check (packs >= 0),          -- unopened packs; starts with the welcome pack
  grant_points int  not null default 0 check (grant_points >= 0),
  wins_day     date,
  wins_today   int  not null default 0,
  is_admin     boolean not null default false,
  last_seen    timestamptz,                                          -- last time they had the game open
  xp           int  not null default 0 check (xp >= 0),
  created_at   timestamptz not null default now()
);

-- Packs of one specific type (given by an admin). Any-type packs stay in profiles.packs.
create table public.pack_stock (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_id text not null references public.packs(id) on delete cascade,
  qty     int  not null default 0 check (qty >= 0),
  primary key (user_id, pack_id)
);

-- Cards found in packs. Base cards are owned by everyone and are not stored here.
create table public.collection (
  user_id uuid    not null references public.profiles(id) on delete cascade,
  card_id text    not null references public.cards(id),
  foil    boolean not null default false,
  qty     int     not null default 0 check (qty >= 0),
  primary key (user_id, card_id, foil)
);

create table public.decks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  characters text[] not null check (cardinality(characters) = 6),
  actions    text[] not null check (cardinality(actions) = 12),
  foils      text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- row-level security
alter table public.cards      enable row level security;
alter table public.packs      enable row level security;
alter table public.pack_odds  enable row level security;
alter table public.profiles   enable row level security;
alter table public.collection enable row level security;
alter table public.decks      enable row level security;
alter table public.pack_stock enable row level security;

create policy "cards are public"       on public.cards      for select using (true);
create policy "packs are public"       on public.packs      for select using (true);
create policy "pack odds are public"   on public.pack_odds  for select using (true);
create policy "read own profile"       on public.profiles   for select to authenticated using (id = auth.uid());
create policy "read own collection"    on public.collection for select to authenticated using (user_id = auth.uid());
create policy "read own decks"         on public.decks      for select to authenticated using (user_id = auth.uid());
create policy "create own decks"       on public.decks      for insert to authenticated with check (user_id = auth.uid());
create policy "edit own decks"         on public.decks      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read own pack stock"   on public.pack_stock for select to authenticated using (user_id = auth.uid());
create policy "delete own decks"       on public.decks      for delete to authenticated using (user_id = auth.uid());
-- profiles and collection have no insert/update policies: they only change through the functions below.

-- ---------------------------------------------------------------- sign-up
-- The game signs people up with a made-up email built from their username; the real username rides in metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username) values (new.id, lower(new.raw_user_meta_data->>'username'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.username_available(u text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where username = lower(u));
$$;

-- ---------------------------------------------------------------- decks must only use cards you own
create function public.check_deck() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text; n int; owned int; r text;
begin
  if (select count(distinct x) from unnest(new.characters) x) <> 6 then
    raise exception 'A deck needs six different characters';
  end if;
  foreach c in array new.characters loop
    select rarity into r from cards where id = c and kind = 'character';
    if r is null then raise exception 'Unknown character %', c; end if;
    if r <> 'base' and not exists (select 1 from collection where user_id = new.user_id and card_id = c and not foil and qty > 0) then
      raise exception 'You don''t own %', c;
    end if;
  end loop;
  for c, n in select x, count(*) from unnest(new.actions) x group by x loop
    select rarity into r from cards where id = c and kind = 'action';
    if r is null then raise exception 'Unknown action card %', c; end if;
    if n > 3 then raise exception 'At most three copies of each action card'; end if;
    if r <> 'base' then
      select coalesce(sum(qty), 0) into owned from collection where user_id = new.user_id and card_id = c and not foil;
      if n > owned then raise exception 'You only own % of %', owned, c; end if;
    end if;
  end loop;
  foreach c in array new.foils loop
    if not (c = any(new.characters)) or not exists (select 1 from collection where user_id = new.user_id and card_id = c and foil and qty > 0) then
      raise exception 'You don''t own a foil %', c;
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;
create trigger check_deck before insert or update on public.decks
  for each row execute function public.check_deck();

-- ---------------------------------------------------------------- packs
-- School days run on Sydney time. Packs come only from wins, up to five a day.
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

-- Each of the 3 cards is rolled from the pack's odds (pack_odds). Anything beyond what a deck can use
-- (3 of an action, 1 of a character or foil) becomes Grant Points; a starter card is worth 1.
create function public.open_pack(p_pack text) returns jsonb
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

-- Spend Grant Points on a specific card: common 8, rare 20, foil 15.
create function public.buy_card(card text, want_foil boolean) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r text; k text; price int; cap int; owned int; left_pts int;
begin
  select rarity, kind into r, k from cards where id = card;
  if r is null then raise exception 'Unknown card'; end if;
  if want_foil then
    if not (r = 'base' and k = 'character') then raise exception 'That card has no foil'; end if;
    price := 15; cap := 1;
  elsif r = 'common' then price := 8; cap := 3;
  elsif r = 'rare' then price := 20; cap := 1;
  else raise exception 'You already own every base card';
  end if;
  select coalesce(sum(qty), 0) into owned from collection where user_id = uid and card_id = card and foil = want_foil;
  if owned >= cap then raise exception 'You already have as many as a deck can use'; end if;
  update profiles set grant_points = grant_points - price where id = uid and grant_points >= price returning grant_points into left_pts;
  if left_pts is null then raise exception 'Not enough Grant Points'; end if;
  insert into collection (user_id, card_id, foil, qty) values (uid, card, want_foil, 1)
    on conflict (user_id, card_id, foil) do update set qty = collection.qty + 1;
  return left_pts;
end $$;

-- ---------------------------------------------------------------- play history
-- One row per finished or abandoned game by a signed-in player (CPU and online games).
create table public.games (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  mode       text not null check (mode in ('cpu','online')),
  difficulty text check (difficulty in ('easy','medium','hard')),
  size       int  not null check (size in (3,4,6)),
  result     text not null check (result in ('win','loss','draw','quit')),
  rounds     int  not null default 0 check (rounds between 0 and 999),
  seconds    int  not null default 0 check (seconds between 0 and 86400),
  opponent   text check (char_length(opponent) <= 30),
  deck_name  text check (char_length(deck_name) <= 30),
  xp         int  not null default 0 check (xp >= 0),
  ended_at   timestamptz not null default now()
);
create index games_user_ended on public.games (user_id, ended_at desc);
create index games_ended on public.games (ended_at desc);
alter table public.games enable row level security;
create policy "read own games" on public.games for select to authenticated using (user_id = auth.uid());

create function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen = now() where id = auth.uid();
$$;

create function public.log_game(p_mode text, p_difficulty text, p_size int, p_result text,
  p_rounds int, p_seconds int, p_opponent text, p_deck text) returns void
language plpgsql security definer set search_path = public as $$
declare v_xp int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  v_xp := case when p_result = 'quit' then 0 else
    round((8 + case when p_result = 'win' then 12 else 0 end) *
      case when p_mode = 'online' then 1.2
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

-- ---------------------------------------------------------------- admin
-- Everyone's activity, play history, collections and decks, for players with profiles.is_admin = true.
-- Promote someone with: update public.profiles set is_admin = true where username = 'their_username';
create function public.admin_overview() returns table(
  username text, is_admin boolean, created_at timestamptz, last_login timestamptz, last_seen timestamptz,
  packs int, grant_points int, deck_count int, cards_owned int,
  games int, wins int, losses int, quits int, play_seconds int, games_week int, last_played timestamptz
) language sql security definer set search_path = public stable as $$
  select p.username, p.is_admin, p.created_at, u.last_sign_in_at, p.last_seen, p.packs, p.grant_points,
    (select count(*) from decks d where d.user_id = p.id)::int,
    (select coalesce(sum(c.qty), 0) from collection c where c.user_id = p.id)::int,
    count(g.id)::int,
    (count(g.id) filter (where g.result = 'win'))::int,
    (count(g.id) filter (where g.result = 'loss'))::int,
    (count(g.id) filter (where g.result = 'quit'))::int,
    coalesce(sum(g.seconds), 0)::int,
    (count(g.id) filter (where g.ended_at > now() - interval '7 days'))::int,
    max(g.ended_at)
  from profiles p
  join auth.users u on u.id = p.id
  left join games g on g.user_id = p.id
  where exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin)
  group by p.id, u.last_sign_in_at
  order by greatest(p.last_seen, u.last_sign_in_at) desc nulls last;
$$;

create function public.admin_games(p_limit int default 40) returns table(
  username text, mode text, difficulty text, size int, result text, rounds int, seconds int,
  opponent text, deck_name text, ended_at timestamptz
) language sql security definer set search_path = public stable as $$
  select p.username, g.mode, g.difficulty, g.size, g.result, g.rounds, g.seconds, g.opponent, g.deck_name, g.ended_at
  from games g join profiles p on p.id = g.user_id
  where exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin)
  order by g.ended_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

create function public.admin_player(p_username text) returns jsonb
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

create function public.admin_decks() returns table(
  username text, deck_name text, characters text[], actions text[], foils text[], updated_at timestamptz
) language sql security definer set search_path = public stable as $$
  select p.username, d.name, d.characters, d.actions, d.foils, d.updated_at
  from decks d join profiles p on p.id = d.user_id
  where exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin)
  order by p.username, d.updated_at desc;
$$;

-- ---------------------------------------------------------------- admin: give packs
-- Adds packs to one player (by username), or to every player when p_username is null. Admins only.
create function public.admin_give_packs(p_username text, p_count int, p_pack text default null) returns int
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

create function public.leaderboard() returns table(
  username text, xp int, wins int, losses int, draws int, games int
) language sql security definer set search_path = public stable as $$
  select p.username, p.xp,
    count(g.id) filter (where g.result = 'win')::int,
    count(g.id) filter (where g.result = 'loss')::int,
    count(g.id) filter (where g.result = 'draw')::int,
    count(g.id) filter (where g.result in ('win','loss','draw'))::int
  from profiles p
  left join games g on g.user_id = p.id
  group by p.id
  order by p.xp desc, wins desc;
$$;

-- ---------------------------------------------------------------- who may call what
revoke all on function public.handle_new_user()           from public, anon, authenticated;
revoke all on function public.check_deck()                from public, anon, authenticated;
revoke all on function public.record_win()                from public, anon;
revoke all on function public.open_pack(text)             from public, anon;
revoke all on function public.buy_card(text, boolean)     from public, anon;
revoke all on function public.admin_overview()             from public, anon;
revoke all on function public.admin_decks()                from public, anon;
revoke all on function public.admin_games(int)             from public, anon;
revoke all on function public.admin_player(text)           from public, anon;
revoke all on function public.touch_seen()                 from public, anon;
revoke all on function public.log_game(text, text, int, text, int, int, text, text) from public, anon;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.record_win()              to authenticated;
grant execute on function public.open_pack(text)           to authenticated;
grant execute on function public.buy_card(text, boolean)   to authenticated;
grant execute on function public.admin_overview()          to authenticated;
grant execute on function public.admin_decks()             to authenticated;
grant execute on function public.admin_games(int)          to authenticated;
grant execute on function public.admin_player(text)        to authenticated;
grant execute on function public.touch_seen()              to authenticated;
grant execute on function public.log_game(text, text, int, text, int, int, text, text) to authenticated;
revoke all on function public.admin_give_packs(text, int, text) from public, anon;
grant execute on function public.admin_give_packs(text, int, text) to authenticated;
revoke all on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
