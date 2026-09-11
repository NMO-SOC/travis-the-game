-- Travis: The Game — upgrade 1: play history and admin stats.
-- For a database that already ran schema.sql. Paste into Supabase → SQL Editor → New query, then Run.
-- Only adds things; no player, collection or deck is touched. Safe to run more than once.
-- (A fresh project doesn't need this: schema.sql already includes it.)

-- When a player last had the game open. Supabase keeps people signed in for weeks, so the
-- sign-in time alone says little about whether someone still plays.
alter table public.profiles add column if not exists last_seen timestamptz;

-- One row per finished or abandoned game by a signed-in player (CPU and online games).
create table if not exists public.games (
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
  ended_at   timestamptz not null default now()
);
create index if not exists games_user_ended on public.games (user_id, ended_at desc);
create index if not exists games_ended on public.games (ended_at desc);
alter table public.games enable row level security;
drop policy if exists "read own games" on public.games;
create policy "read own games" on public.games for select to authenticated using (user_id = auth.uid());
-- No insert policy: rows only arrive through log_game().

create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen = now() where id = auth.uid();
$$;

create or replace function public.log_game(p_mode text, p_difficulty text, p_size int, p_result text,
  p_rounds int, p_seconds int, p_opponent text, p_deck text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into games (user_id, mode, difficulty, size, result, rounds, seconds, opponent, deck_name)
  values (auth.uid(), p_mode, case when p_mode = 'cpu' then p_difficulty end, p_size, p_result,
          least(greatest(coalesce(p_rounds, 0), 0), 999), least(greatest(coalesce(p_seconds, 0), 0), 86400),
          left(p_opponent, 30), left(p_deck, 30));
  update profiles set last_seen = now() where id = auth.uid();
end $$;

-- Admin views. The return shape of admin_overview changes, so it has to be dropped first.
drop function if exists public.admin_overview();
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

create or replace function public.admin_games(p_limit int default 40) returns table(
  username text, mode text, difficulty text, size int, result text, rounds int, seconds int,
  opponent text, deck_name text, ended_at timestamptz
) language sql security definer set search_path = public stable as $$
  select p.username, g.mode, g.difficulty, g.size, g.result, g.rounds, g.seconds, g.opponent, g.deck_name, g.ended_at
  from games g join profiles p on p.id = g.user_id
  where exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin)
  order by g.ended_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- Everything about one player: the pack cards they own and their last 30 games.
create or replace function public.admin_player(p_username text) returns jsonb
language sql security definer set search_path = public stable as $$
  select case when not exists (select 1 from profiles me where me.id = auth.uid() and me.is_admin) then null
  else jsonb_build_object(
    'collection', coalesce((select jsonb_agg(jsonb_build_object('card_id', c.card_id, 'foil', c.foil, 'qty', c.qty) order by c.card_id)
                            from collection c join profiles p on p.id = c.user_id where p.username = lower(p_username) and c.qty > 0), '[]'::jsonb),
    'games', coalesce((select jsonb_agg(x order by x.ended_at desc) from (
                         select g.mode, g.difficulty, g.size, g.result, g.rounds, g.seconds, g.opponent, g.deck_name, g.ended_at
                         from games g join profiles p on p.id = g.user_id
                         where p.username = lower(p_username) order by g.ended_at desc limit 30) x), '[]'::jsonb)
  ) end;
$$;

revoke all on function public.touch_seen()                                          from public, anon;
revoke all on function public.log_game(text, text, int, text, int, int, text, text) from public, anon;
revoke all on function public.admin_overview()                                      from public, anon;
revoke all on function public.admin_games(int)                                      from public, anon;
revoke all on function public.admin_player(text)                                    from public, anon;
grant execute on function public.touch_seen()                                          to authenticated;
grant execute on function public.log_game(text, text, int, text, int, int, text, text) to authenticated;
grant execute on function public.admin_overview()                                      to authenticated;
grant execute on function public.admin_games(int)                                      to authenticated;
grant execute on function public.admin_player(text)                                    to authenticated;
