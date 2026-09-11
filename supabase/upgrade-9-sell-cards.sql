-- Travis: The Game — upgrade 9: sell an owned pack card for Grant Points.
-- Run after upgrade 2 (packs). Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
-- Sell price is half the buy price (buy_card): foil 7, common action 4, rare character 10. Starter
-- (base) cards can't be sold — everyone already owns them for free, there's nothing to convert.
-- Selling never removes a card you'd need to keep — it just can't take you below zero; if a saved
-- deck used your last copy, that deck will need a new card next time you edit it, the same as if a
-- pack dupe conversion or a trade had done it.

create or replace function public.sell_card(card text, is_foil boolean) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r text; price int; owned int; left_pts int;
begin
  select rarity into r from cards where id = card;
  if r is null then raise exception 'Unknown card'; end if;
  if r = 'base' and not is_foil then raise exception 'Starter cards can''t be sold: everyone already owns them.'; end if;
  select qty into owned from collection where user_id = uid and card_id = card and foil = is_foil;
  if owned is null or owned < 1 then raise exception 'You don''t own that card.'; end if;
  if is_foil then price := 7;
  elsif r = 'common' then price := 4;
  elsif r = 'rare' then price := 10;
  else raise exception 'That card can''t be sold.';
  end if;
  update collection set qty = qty - 1 where user_id = uid and card_id = card and foil = is_foil;
  delete from collection where user_id = uid and card_id = card and foil = is_foil and qty <= 0;
  update profiles set grant_points = grant_points + price where id = uid returning grant_points into left_pts;
  return left_pts;
end $$;

revoke all on function public.sell_card(text, boolean) from public, anon;
grant execute on function public.sell_card(text, boolean) to authenticated;
