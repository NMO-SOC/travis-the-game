-- Travis: The Game — upgrade 23: one-time login notice announcing Travis: Arena.
-- The original game is being referred to as "SmalLab mode" from here on (unchanged, still fully
-- playable); Arena (tcg.html) is a separate new mode. Every signed-in player gets told about it once,
-- the next time they sign in after this ships — same server-enforced, run-as-many-times-as-you-like
-- pattern as claim_chairman_gift (upgrade-14) and claim_australiana_gift (upgrade-16).
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.

alter table public.profiles add column if not exists smallab_notice_seen boolean not null default false;

create or replace function public.claim_smallab_notice() returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); got boolean;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  update profiles set smallab_notice_seen = true where id = uid and smallab_notice_seen = false returning true into got;
  return coalesce(got, false);
end $$;
revoke all on function public.claim_smallab_notice() from public, anon;
grant execute on function public.claim_smallab_notice() to authenticated;
