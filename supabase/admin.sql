-- Travis: The Game — admin snippets. Run in Supabase → SQL Editor. Edit the values in quotes first.

-- Reset someone's password (they message you their username; you pick a temporary password and tell them).
update auth.users
set encrypted_password = extensions.crypt('NewPassword123', extensions.gen_salt('bf'))
where id = (select id from public.profiles where username = lower('their_username'));

-- Give someone extra packs.
-- update public.profiles set packs = packs + 3 where username = lower('their_username');

-- See every player.
-- select username, packs, grant_points, created_at from public.profiles order by created_at;

-- Delete a player completely (their login, collection and decks).
-- delete from auth.users where id = (select id from public.profiles where username = lower('their_username'));
