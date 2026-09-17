# Merging `special-events`

Pull request: https://github.com/NMO-SOC/travis-the-game/pull/14

## 1. Update the database first

Merge **after** this step. The game reads the `events` table as soon as it deploys.

1. Open Supabase → **SQL Editor** → New query.
2. Paste in `supabase/upgrade-18-special-events.sql` and **Run**. You can run it more than once safely.
3. Check that `upgrade-16-australiana.sql` and `upgrade-17-buy-packs.sql` have already been run. Upgrade 18 needs them.

If the game goes live before this step, the Special Event option stays hidden and saving an event on the Admin screen shows an error. Nothing else breaks.

## 2. Merge

On GitHub: open the pull request → **Merge pull request**.

Or from a terminal:

```bash
git fetch origin
git switch main
git pull
git merge --no-ff origin/special-events
git push origin main
```

If `main` has moved on and the merge conflicts, it's almost certainly in `play.js`. Keep both sides. This branch only adds `event` to `CFG`, `event` to the lobby `L` object and the `hello` message, and new `event*` functions.

## 3. Check it's working

1. Sign in as an admin → **Admin** → *Special events* → **New event**.
2. Pick the allowed packs (or **Foils only**), add exactly 12 action cards, and save.
3. Press **Go live**.
4. As a player, go to the menu (reload if it was already open). A *Special Event* choice appears for Versus CPU and Online. Choose it and start a game.
5. You should see a team picker showing only your own cards that fit the event. The game uses the event's action cards.
6. Press **End** on the Admin screen. The event disappears from the menu after a reload.

## Rolling back

Revert the merge commit on `main`. You can leave the `events` table in place, because nothing else uses it.
