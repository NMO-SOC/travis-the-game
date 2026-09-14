-- Travis: The Game — upgrade 14: Chairman Knox. A once-only free gift to every player (past and
-- future) the next time they sign in, and otherwise only a 1-in-100 chance on any pack won from an
-- online battle. Never purchasable, never sellable, never in a pack's normal odds. Alone it's the
-- weakest card in the game (1 HP/ATK/SPD); own three and every copy becomes 10 for everything —
-- see newUnit() in play.js for that swap.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

alter table public.profiles add column if not exists chairman_gifted boolean not null default false;

insert into public.cards (id, kind, rarity, pack_id) values
  ('chairman-knox', 'character', 'rare', null)
on conflict (id) do nothing;

create or replace function public.claim_chairman_gift() returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text; got boolean;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  update profiles set chairman_gifted = true where id = uid and chairman_gifted = false returning true into got;
  if got is distinct from true then return false; end if;
  insert into collection (user_id, card_id, foil, qty) values (uid, 'chairman-knox', false, 1)
    on conflict (user_id, card_id, foil) do update set qty = collection.qty + 1;
  select username into uname from profiles where id = uid;
  insert into activity (user_id, username, kind, detail) values (uid, uname, 'pack_won', jsonb_build_object('pack', 'chairman-knox', 'source', 'gift'));
  return true;
end $$;

create or replace function public.roll_chairman_win() returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if random() >= 0.01 then return false; end if;
  insert into collection (user_id, card_id, foil, qty) values (uid, 'chairman-knox', false, 1)
    on conflict (user_id, card_id, foil) do update set qty = collection.qty + 1;
  select username into uname from profiles where id = uid;
  insert into activity (user_id, username, kind, detail) values (uid, uname, 'pack_won', jsonb_build_object('pack', 'chairman-knox', 'source', 'online-chase'));
  return true;
end $$;

revoke all on function public.claim_chairman_gift() from public, anon;
revoke all on function public.roll_chairman_win() from public, anon;
grant execute on function public.claim_chairman_gift() to authenticated;
grant execute on function public.roll_chairman_win() to authenticated;
