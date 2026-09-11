-- Travis: The Game — upgrade 8: XP and a leaderboard.
-- Run after upgrade 7. Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
-- Every finished or quit battle now earns XP, win or lose (quitting mid-game earns none). XP scales
-- with difficulty and mode:
--   base 8 XP, +12 more for a win, then multiplied by:
--     Easy x0.75, Medium x1, Hard x1.4, Online x1.2 (online has no difficulty setting of its own)
-- Tune the numbers by editing the case expression inside log_game() below and re-running this file.
--
-- The leaderboard (username, XP, wins, losses, draws, games) is visible to any signed-in player, not
-- just admins — it's meant for the main menu, not the Admin screen.

alter table public.profiles add column if not exists xp int not null default 0 check (xp >= 0);
alter table public.games add column if not exists xp int not null default 0 check (xp >= 0);

create or replace function public.log_game(p_mode text, p_difficulty text, p_size int, p_result text,
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

create or replace function public.leaderboard() returns table(
  username text, xp int, wins int, losses int, draws int, games int
) language sql security definer set search_path = public stable as $$
  select p.username, p.xp,
    count(g.id) filter (where g.result = 'win')::int as wins,
    count(g.id) filter (where g.result = 'loss')::int as losses,
    count(g.id) filter (where g.result = 'draw')::int as draws,
    count(g.id) filter (where g.result in ('win','loss','draw'))::int as games
  from profiles p
  left join games g on g.user_id = p.id
  group by p.id
  order by p.xp desc, wins desc;
$$;

revoke all on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
