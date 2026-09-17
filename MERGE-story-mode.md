# Merging `story-mode`

Pull request: https://github.com/NMO-SOC/travis-the-game/pull/8

Story mode is a single-player campaign played on a campus map:
- Four faculties (Science, Maths, English, Humanities), each with three quick 3 v 3 chapters.
- Beating a faculty's Head of Faculty boss adds that Head's card to your collection.
- The finale is the Principal Class. Winning it unlocks Principal Travis Knox.

`STORYLINE.md` has the full story.

## Status right now

- `main` was merged into this branch on 17 Sep 2026 (commit `4ee39f4`). **It merges into `main` with no conflicts.**
- The story migration is numbered **upgrade 21**, because 16–20 are already used on `main`.

## 1. Update the database first

Merge **after** this step. Otherwise the Story screen shows 0 chapters cleared and a win can't be saved ("function story_clear does not exist").

1. Open Supabase → **SQL Editor** → New query.
2. Paste in `supabase/upgrade-21-story-mode.sql` and **Run**. You can run it more than once safely.
3. It needs `upgrade-15-foil-gold-economy.sql` (the `gold` column on `collection`), which is already live.

What it does:
- Adds a `story` rarity and the 12 story cards (8 characters, 4 action cards).
- Adds `profiles.story_chapter`.
- Adds `story_clear(chapter)`. It gives each chapter's reward once, in order, and the database picks the card.

Story cards can't be bought, sold or pulled from packs: `buy_card` and `sell_card` reject the `story` rarity, and the foil/gold pull skips cards with no `pack_id`.

## 2. Merge

On GitHub: open the pull request → **Merge pull request**.

Or from a terminal:

```bash
git fetch origin
git switch main
git pull
git merge --no-ff origin/story-mode
git push origin main
```

## If `main` moves on and the merge conflicts

The conflicts will almost certainly be in the files below, because both branches add things in the same spots. **Keep both sides** in every case.

| File | Where | Fix |
|---|---|---|
| `cards.js` | the end of `chars`, `PACKS`, `SIG_FX` | Keep both sides' new cards, packs and signature effects. The line before a pasted block needs a trailing comma. |
| `account.js` | the `A.canBuy` guard, and near `A.recordWin` | Keep every `c.set===...` check in the guard. Keep `A.storyClear` next to whatever `A.recordWin` is on `main`. |
| `play.js` | the `onClick` switch, `gameEnded`, `teamPick` | Keep the `storyplay`/`storysel` cases. The `if(CFG.story!=null){ ... return; }` block in `gameEnded` must stay **before** the `ACC.recordWin(...)` call, so story wins don't also earn daily packs. |
| `play.html`, `index.html` | the `?v=` numbers on the script tags | Use a new version newer than both sides. |
| `supabase/` | migration number | If `main` has added an `upgrade-21-*.sql`, rename this file to the next free number, and update the mentions in `cards.js` and `STORYLINE.md`. |

After resolving, run a syntax check (`node --check cards.js account.js play.js`) and open `play.html` once to check that the Story screen loads.

**Also check:** if a new migration on `main` redefines `buy_card` or `sell_card`, make sure the new version still rejects any rarity it doesn't price. If one redefines the `cards_rarity_check` constraint, make sure the list still includes `'story'`.

## 3. Check it's working

1. Sign in → **Story** (in the account bar). The campus map loads with Science glowing and everything else locked.
2. Tap Science → **Play** on *Prac Report Due*. A 3 v 3 starts against 3 opponents drawn from that chapter's pool. Win it.
3. The results screen says *Harbour Seal Knox joins your collection!* and **Next chapter** appears. Collection shows the card.
4. Replay that chapter and win again. No second reward is given.
5. Beat *Head of Science Knox*. The card is in Collection with no Buy/Sell buttons, and you can put it in a saved deck.
6. A normal Versus CPU win still gives the daily win pack.

## Proposed fix found while merging (already on `main`, not caused by this branch)

The foil/gold pull in `open_pack` (`upgrade-16-australiana.sql`) filters with `pack_id <> 'australiana'`. In SQL, a missing `pack_id` never passes a `<>` comparison, so **base characters and Chairman Knox can no longer come up as foils or golds**. Holo and Legendary packs only ever give foil or gold versions of pack characters.

This branch relies on that filter to keep story cards (which have no `pack_id`) out of the foil pool. So if you fix it, keep story cards out explicitly. In a new migration, redefine `open_pack` with both pulls changed to:

```sql
select id into cid from cards
  where kind = 'character' and pack_id is distinct from 'australiana' and rarity <> 'story'
  order by random() limit 1;
```

## Known limits

- The win itself is reported by the browser, the same as the normal daily win packs, so the server can't check the battle happened. It only makes sure each reward goes out once, in order.
- The map pin positions are in `STORY_MAP` in `cards.js`, as percentages of the image width and height. To use a new map, replace `images/story/campus-map.jpg` and adjust those numbers.

## Rolling back

Revert the merge commit on `main`. You can leave the database changes in place: nothing outside Story mode reads `story_chapter` or `story_clear`, and players keep any story cards they've already earned.
