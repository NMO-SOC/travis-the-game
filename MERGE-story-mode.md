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
- This branch also fixes the bugs from the 17 Sep code review of `main`: **#15, #16, #17 and #18**. Merging closes them. See *Bug fixes included* below.

## 1. Update the database first

Merge **after** this step. Otherwise the Story screen shows 0 chapters cleared and a win can't be saved ("function story_clear does not exist").

Run these two files **in order**. Each can be run more than once safely.

1. Open Supabase → **SQL Editor** → New query.
2. Paste in `supabase/upgrade-21-story-mode.sql` and **Run**.
3. New query → paste in `supabase/upgrade-22-review-fixes.sql` and **Run**.

Upgrade 21 needs `upgrade-15-foil-gold-economy.sql`. Upgrade 22 needs upgrades 13, 16 and 19. All of those are already live.

Upgrade 22 replaces three live functions: `open_pack`, `record_win` and `wager_battle`. No SQL syntax checker was available when it was written. Each function is replaced by its own statement, so if Supabase reports an error, the functions before it may already be updated. Fix the error and rerun the whole file; rerunning is safe.

What upgrade 21 does:
- Adds a `story` rarity and the 12 story cards (8 characters, 4 action cards).
- Adds `profiles.story_chapter`.
- Adds `story_clear(chapter)`. It gives each chapter's reward once, in order, and the database picks the card.

Story cards can't be bought, sold or pulled from packs: `buy_card` and `sell_card` reject the `story` rarity, and upgrade 22's foil/gold pull filters out `rarity = 'story'`.

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
| `supabase/` | migration numbers | If `main` has added an `upgrade-21-*.sql` or `upgrade-22-*.sql`, renumber this branch's files to the next free numbers (story first, then review fixes). Update the mentions in `cards.js`, `STORYLINE.md` and this file. |
| `supabase/upgrade-22-review-fixes.sql` | `open_pack`, `record_win`, `wager_battle` | If `main` has redefined any of these since 17 Sep, apply the three fixes to `main`'s newest version instead of the copy in upgrade 22. |

After resolving, run a syntax check (`node --check cards.js account.js play.js`) and open `play.html` once to check that the Story screen loads.

**Also check:** if a new migration on `main` redefines `buy_card` or `sell_card`, make sure the new version still rejects any rarity it doesn't price. If one redefines the `cards_rarity_check` constraint, make sure the list still includes `'story'`.

## 3. Check it's working

1. Sign in → **Story** (in the account bar). The campus map loads with Science glowing and everything else locked.
2. Tap Science → **Play** on *Prac Report Due*. A 3 v 3 starts against 3 opponents drawn from that chapter's pool. Win it.
3. The results screen says *Harbour Seal Knox joins your collection!* and **Next chapter** appears. Collection shows the card.
4. Replay that chapter and win again. No second reward is given.
5. Beat *Head of Science Knox*. The card is in Collection with no Buy/Sell buttons, and you can put it in a saved deck.
6. A normal Versus CPU win still gives the daily win pack.

## Bug fixes included

These came from a code review of `main`. Each issue has the full details.

| Issue | Fix | Where |
|---|---|---|
| #15 Game hangs after spectating | `CFG.spectating` is cleared in `teamPick()` (every deck, event and story game passes through it) and in `goScreen()`. | `play.js` |
| #16 Holo/Legendary skip starters and Chairman as foil/gold | The foil/gold pool uses `pack_id is distinct from 'australiana'` (a `<>` comparison silently dropped null `pack_id`s), and keeps story cards out with `rarity <> 'story'`. | upgrade 22, `open_pack` |
| #17 Pack wins missing from the activity feed | Activity inserts restored in `record_win` and `wager_battle`, including the Insane branch and wager losses. | upgrade 22 |
| #18 High Stakes stake not checked | `wager_battle` locks the profile row and rejects a stake larger than the player's Grant Points. A loss then subtracts the full stake. | upgrade 22 |

#18 also mentions that the server trusts the difficulty the browser sends. That needs a larger change (recording each game on the server when it starts), so it isn't included here.

To check the fixes after merging:
- **#15:** watch a live match → Menu → Versus CPU with a saved deck. Your turn starts normally.
- **#16:** open a few Holo packs. Starter characters can appear as foils.
- **#17:** win a CPU game while signed in. A "won a pack" line appears in the activity feed.
- **#18:** a player with fewer Grant Points than a stake gets "Not enough Grant Points for that stake" instead of the game settling it.

## UI changes included

Each of these was reproduced in a scripted battle in headless Chrome and checked again after the fix.

| Change | What was wrong | Fix | Commit |
|---|---|---|---|
| Battle log scroll | The turn timer's 10-second nudge redraws the whole screen, which sent the battle log (and the side rail) back to the top while you were reading. | `paint()` keeps the scroll position of every scrolling panel (`.feed`, `.log`, `.rail`, `.chatfeed`). Chat only follows new messages while you're already at the bottom. | `5b38d94` |
| Attack buttons covered | A raised or selected action card in the hand (z-index 20) sat on top of the attack buttons. | The attack bar stacks above hand cards. Its gaps let clicks through to the cards. | `5b38d94` |
| Text overflow | Long status chips (e.g. the stun-immunity chip) ran off the card, and long attack names and log lines could spill out. | Attack names and log lines wrap. Status chips cut off with "…", and the stun chip now reads "Stun immune", with the full text on hover. | `5b38d94` |
| Deck selection | The deck was chosen on the menu before starting. | The menu's "Your team" group is gone. Pressing Start against the CPU (signed in, with saved decks) opens a **Choose your team** screen: Random deal or a saved deck, with the last choice highlighted. Players with no saved decks, and Two Players, still deal straight away. Online already chose the deck after connecting. | `c4510a0` |

The narrow-screen check of the attack buttons was cut short, because tapping a unit there opens a full-screen character card. The desktop run is what confirmed that fix.

"Shuffle Up Again" after a CPU game also shows the Choose your team screen each time. If a rematch should reuse the last deck instead, that's a small follow-up.

To check the UI changes after merging:
- **Deck selection:** Menu → Versus CPU → Start. The Choose your team screen appears, and picking a saved deck starts the game with that deck's characters.
- **Log scroll:** in a battle, scroll the log down and wait more than 10 seconds on your turn. It stays where you scrolled.
- **Attack buttons:** select a character and tap a hand card. The attack buttons stay visible and clickable.

## Known limits

- The win itself is reported by the browser, the same as the normal daily win packs, so the server can't check the battle happened. It only makes sure each reward goes out once, in order.
- The map pin positions are in `STORY_MAP` in `cards.js`, as percentages of the image width and height. To use a new map, replace `images/story/campus-map.jpg` and adjust those numbers.

## Rolling back

Revert the merge commit on `main`. You can leave upgrade 21 in place: nothing outside Story mode reads `story_chapter` or `story_clear`, and players keep any story cards they've already earned.

Leave upgrade 22 in place too; it only fixes bugs. If you must undo it, rerun `upgrade-16-australiana.sql` (for `open_pack`) and `upgrade-19-insane-difficulty.sql` (for `record_win` and `wager_battle`). That brings back bugs #16–#18.
