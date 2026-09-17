-- Travis: The Game — upgrade 17: buy packs directly with Grant Points.
-- Once a player owns every card, every pull is a duplicate — nothing but Grant Points ever comes
-- back, and once their last real pack token is spent, "Open" has nothing left to open. This lets
-- Grant Points buy a specific pack outright, priced by tier: guaranteed-foil/gold packs (Holo,
-- Legendary) cost more since that's what most players buying packs are actually chasing; everything
-- else is a flat lower price. Buying always grants a token of that EXACT pack (pack_stock), not a
-- generic any-type token — so buying Holo bypasses its "admin gift only" restriction on purpose,
-- same as any other admin-gifted pack_stock entry already does.
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

alter table public.packs add column if not exists gp_price int;
update public.packs set gp_price = 80 where id in ('holo', 'legendary');
update public.packs set gp_price = 30 where id not in ('holo', 'legendary', 'australiana') and gp_price is null;

create or replace function public.buy_pack(p_pack text) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pk packs; left_pts int;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into pk from packs where id = p_pack and active;
  if pk.id is null then raise exception 'That pack isn''t available'; end if;
  if pk.gp_price is null then raise exception '% can''t be bought with Grant Points', pk.name; end if;
  if pk.valid_until is not null and now() > pk.valid_until then raise exception '% is no longer available', pk.name; end if;
  update profiles set grant_points = grant_points - pk.gp_price where id = uid and grant_points >= pk.gp_price returning grant_points into left_pts;
  if left_pts is null then raise exception 'Not enough Grant Points'; end if;
  insert into pack_stock (user_id, pack_id, qty) values (uid, p_pack, 1)
    on conflict (user_id, pack_id) do update set qty = pack_stock.qty + 1;
  return left_pts;
end $$;

revoke all on function public.buy_pack(text) from public, anon;
grant execute on function public.buy_pack(text) to authenticated;
