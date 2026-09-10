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
drop function if exists public.buy_card(text, boolean) cascade;
drop function if exists public.check_deck() cascade;
drop function if exists public.admin_overview() cascade;
drop function if exists public.admin_decks() cascade;
drop table if exists public.decks cascade;
drop table if exists public.collection cascade;
drop table if exists public.profiles cascade;
drop table if exists public.cards cascade;

-- ---------------------------------------------------------------- card catalogue
-- rarity: base = everyone owns it; common/rare = found in packs. Foils exist for every base character.
create table public.cards (
  id     text primary key,
  kind   text not null check (kind in ('character','action')),
  rarity text not null check (rarity in ('base','common','rare'))
);
insert into public.cards (id, kind, rarity) values
  ('doctor-knox','character','base'), ('director-knox','character','base'), ('blue-suit-knox','character','base'),
  ('beer-frog-knox','character','base'), ('family-man-knox','character','base'), ('seal-whisperer-knox','character','base'),
  ('mixtape-knox','character','base'), ('chaperone-knox','character','base'), ('field-researcher-knox','character','base'),
  ('fire-drill-knox','character','base'), ('elephant-seal-knox','character','base'), ('leopard-seal-knox','character','base'),
  ('staff-meeting-knox','character','base'), ('parent-teacher-knox','character','base'), ('tadpole-knox','character','base'),
  ('emeritus-knox','character','base'),
  ('harbour-seal-knox','character','rare'), ('sports-carnival-knox','character','rare'), ('conference-knox','character','rare'),
  ('yard-duty-knox','character','rare'), ('swimming-carnival-knox','character','rare'), ('socs-got-talent-knox','character','rare'),
  ('cat','action','base'), ('canteen','action','base'), ('excursion','action','base'), ('dlc','action','base'), ('detention','action','base'),
  ('reports','action','common'), ('photo-day','action','common'), ('uniform-check','action','common'),
  ('assembly','action','common'), ('low-tide','action','common');

-- ---------------------------------------------------------------- players
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  packs        int  not null default 1 check (packs >= 0),          -- unopened packs; starts with the welcome pack
  grant_points int  not null default 0 check (grant_points >= 0),
  wins_day     date,
  wins_today   int  not null default 0,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
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
alter table public.profiles   enable row level security;
alter table public.collection enable row level security;
alter table public.decks      enable row level security;

create policy "cards are public"       on public.cards      for select using (true);
create policy "read own profile"       on public.profiles   for select to authenticated using (id = auth.uid());
create policy "read own collection"    on public.collection for select to authenticated using (user_id = auth.uid());
create policy "read own decks"         on public.decks      for select to authenticated using (user_id = auth.uid());
create policy "create own decks"       on public.decks      for insert to authenticated with check (user_id = auth.uid());
create policy "edit own decks"         on public.decks      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
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
create function public.record_win() returns boolean
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Australia/Sydney')::date; p profiles;
begin
  select * into p from profiles where id = auth.uid() for update;
  if not found then raise exception 'Not signed in'; end if;
  if p.wins_day is distinct from today then p.wins_today := 0; end if;
  if p.wins_today >= 5 then
    update profiles set wins_day = today, wins_today = p.wins_today where id = p.id;
    return false;
  end if;
  update profiles set packs = packs + 1, wins_day = today, wins_today = p.wins_today + 1 where id = p.id;
  return true;
end $$;

-- Three cards: two commons (new action cards), then a rare character (65%) or a foil base character (35%).
-- Anything beyond what a deck can use (3 of an action, 1 of a character or foil) becomes Grant Points.
create function public.open_pack() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result jsonb := '[]'; i int; cid text; is_foil boolean; cap int; pts int; owned int;
begin
  update profiles set packs = packs - 1 where id = uid and packs > 0;
  if not found then raise exception 'No packs to open'; end if;
  for i in 1..3 loop
    if i < 3 then
      select id into cid from cards where rarity = 'common' order by random() limit 1; is_foil := false; cap := 3; pts := 2;
    elsif random() < 0.65 then
      select id into cid from cards where rarity = 'rare' order by random() limit 1; is_foil := false; cap := 1; pts := 5;
    else
      select id into cid from cards where rarity = 'base' and kind = 'character' order by random() limit 1; is_foil := true; cap := 1; pts := 5;
    end if;
    select coalesce(sum(qty), 0) into owned from collection where user_id = uid and card_id = cid and foil = is_foil;
    if owned >= cap then
      update profiles set grant_points = grant_points + pts where id = uid;
      result := result || jsonb_build_object('id', cid, 'foil', is_foil, 'dupe', true, 'points', pts);
    else
      insert into collection (user_id, card_id, foil, qty) values (uid, cid, is_foil, 1)
        on conflict (user_id, card_id, foil) do update set qty = collection.qty + 1;
      result := result || jsonb_build_object('id', cid, 'foil', is_foil, 'dupe', false, 'points', 0);
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

-- ---------------------------------------------------------------- admin
-- Everyone else's usernames, sign-in activity and decks, for players with profiles.is_admin = true.
-- Promote someone with: update public.profiles set is_admin = true where username = 'their_username';
create function public.admin_overview() returns table(
  username text, created_at timestamptz, last_login timestamptz, packs int, grant_points int, deck_count int
) language sql security definer set search_path = public stable as $$
  select p.username, p.created_at, u.last_sign_in_at, p.packs, p.grant_points,
    (select count(*) from decks d where d.user_id = p.id)::int
  from profiles p join auth.users u on u.id = p.id
  where exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin)
  order by u.last_sign_in_at desc nulls last;
$$;

create function public.admin_decks() returns table(
  username text, deck_name text, characters text[], actions text[], foils text[], updated_at timestamptz
) language sql security definer set search_path = public stable as $$
  select p.username, d.name, d.characters, d.actions, d.foils, d.updated_at
  from decks d join profiles p on p.id = d.user_id
  where exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin)
  order by p.username, d.updated_at desc;
$$;

-- ---------------------------------------------------------------- who may call what
revoke all on function public.handle_new_user()           from public, anon, authenticated;
revoke all on function public.check_deck()                from public, anon, authenticated;
revoke all on function public.record_win()                from public, anon;
revoke all on function public.open_pack()                 from public, anon;
revoke all on function public.buy_card(text, boolean)     from public, anon;
revoke all on function public.admin_overview()             from public, anon;
revoke all on function public.admin_decks()                from public, anon;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.record_win()              to authenticated;
grant execute on function public.open_pack()               to authenticated;
grant execute on function public.buy_card(text, boolean)   to authenticated;
grant execute on function public.admin_overview()          to authenticated;
grant execute on function public.admin_decks()             to authenticated;
