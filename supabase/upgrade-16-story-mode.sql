-- Travis: The Game — upgrade 16: Story mode (see STORYLINE.md). Four faculties of three chapters (the
-- last a Head of Faculty boss), then the Principal Class. Clearing a chapter, in order, grants its reward
-- card into the real collection. Story characters and action cards get a new 'story' rarity: never in a
-- pack's odds, never for sale (buy_card and sell_card already reject any rarity they don't price), and
-- check_deck already requires owning them.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

alter table public.cards drop constraint if exists cards_rarity_check;
alter table public.cards add constraint cards_rarity_check check (rarity in ('base','common','rare','story'));

insert into public.cards (id, kind, rarity, pack_id) values
  ('head-of-science-knox','character','story',null), ('head-of-maths-knox','character','story',null),
  ('head-of-english-knox','character','story',null), ('head-of-humanities-knox','character','story',null),
  ('wellbeing-ap-knox','character','story',null), ('curriculum-ap-knox','character','story',null),
  ('principal-knox','character','story',null), ('principal-travis-knox','character','story',null),
  ('hall-pass','action','story',null), ('staffroom-coffee','action','story',null),
  ('relief-teacher','action','story',null), ('long-weekend','action','story',null)
on conflict (id) do nothing;

-- Bosses from the first draft of Story mode, if an earlier run of this file added them and nobody owns one.
delete from public.cards c where c.id in ('regional-director-knox','department-secretary-knox','minister-knox')
  and not exists (select 1 from public.collection where card_id = c.id);

alter table public.profiles add column if not exists story_chapter int not null default 0;  -- chapters cleared

-- The win itself is client-reported, same as record_win; what's enforced here is that each chapter's
-- reward is granted once, in order, and that the client can't choose which card it gets.
-- Keep this list in the same order as STORY in cards.js (null = chapter with no card reward).
create or replace function public.story_clear(p_chapter int) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); advanced boolean; reward text;
        rewards text[] := array[
          'harbour-seal-knox','hall-pass','head-of-science-knox',
          'conference-knox','staffroom-coffee','head-of-maths-knox',
          'yearbook-knox','relief-teacher','head-of-english-knox',
          'washington-knox','long-weekend','head-of-humanities-knox',
          null,'principal-travis-knox'];
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_chapter < 0 or p_chapter >= cardinality(rewards) then raise exception 'Unknown chapter'; end if;
  update profiles set story_chapter = story_chapter + 1 where id = uid and story_chapter = p_chapter returning true into advanced;
  if advanced is distinct from true then return null; end if;
  reward := rewards[p_chapter + 1];
  if reward is null then return null; end if;
  insert into collection (user_id, card_id, foil, gold, qty) values (uid, reward, false, false, 1)
    on conflict (user_id, card_id, foil, gold) do update set qty = least(collection.qty + 1, 3);
  return reward;
end $$;

revoke all on function public.story_clear(int) from public, anon;
grant execute on function public.story_clear(int) to authenticated;
