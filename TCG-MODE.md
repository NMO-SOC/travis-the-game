# Travis: Arena — design brief

Status: **v1 built and live** at `tcg.html` (`tcg-cards.js` + `tcg-rules.js`, tested by
`tcg-rules.test.js`). This is Nick's design brief for the new hero-and-deck card game, saved as-is
(cleaned up into sections) and then built against. The original browser game (`play.html`/`play.js`,
packs/decks/Story/Events/High Stakes — everything the top of `README.md` describes) is **unchanged**
and is now referred to as **SmalLab mode** to distinguish it. Nothing here touches SmalLab mode's code,
cards, or database — Arena reuses the Travis Knox character roster (adapted into a new cost/stat
format) but is otherwise a fully separate game, own files, own rules engine.

This is a different game, not a variant: a hero-plus-deck TCG (closer to Hearthstone/Yu-Gi-Oh than to
SmalLab mode's "6 pre-dealt characters, attack or play a card" loop).

## v1 scope — what's in, what's deferred

Built: single-device hotseat 2-player (pass between turns, hands hidden via a pass screen), hero
select (3 heroes), the full 45-card default deck, every mechanic in the brief below (summon points,
taunt, sacrifice, dice-roll risk cards, AOE/cleanse/extra-attack/draw/hand-peek/copy spells, fatigue).

Deliberately deferred, not forgotten:
- **No deckbuilder/collection integration.** Both players use the same preset 45-card deck. Building
  your own deck from owned cards (the whole "point of collecting" question from the brief) is real
  future work, not done here.
- **No online play.** Hotseat (pass the device) or Versus CPU only — no match codes/Supabase sync yet.
  The CPU is a simple greedy heuristic in `tcg-rules.js` (`cpuTurn`): no lookahead, plays whatever it
  can afford roughly best-first and attacks for lethal/biggest-threat. Not tuned for difficulty tiers.
- **Most monster Power text is still flavor only.** Per the later instruction ("abilities should not
  be tied to the monsters, but to cards — some monsters will have abilities"), 8 of the 52 adapted
  monsters got real Battlecry-style abilities instead (triggered the instant they're summoned, not
  reusable) — Tadpole Knox, Field Researcher Knox, Fire Drill Knox, Harbour Seal Knox, Yard Duty Knox,
  Seal Whisperer Knox, Mixtape Knox, Emeritus Knox — chosen to map cleanly onto their original SmalLab
  Power text. Tadpole Knox's battlecry needed a graveyard (`g.graveyard[t]`, populated whenever a
  monster dies in combat or from an effect) to "return the strongest monster that died this game." The
  other 44 monsters remain vanilla stats; abilities otherwise live on cards (the 14 spells), as asked.
- **Visual design follows Hearthstone conventions**: a circular hero portrait per side with an HP gem
  overlapping its corner (the attack target once a field is empty), a diamond mana-crystal row for the
  active player, and ATK/HP gems on minion cards instead of a stats line. Not a pixel-for-pixel clone —
  Travis Knox art/palette throughout — but the board reads as the same genre at a glance.

## Core loop

- You don't start with characters on the field. Cards — monsters and effects alike — sit in your
  **hand**, drawn over the course of the game; nothing ever enters play by itself. Each card has a
  **summon value** (a mana-curve-style cost), scaled to its strength — a stronger monster or a more
  powerful effect costs more. E.g. Beer Frog Knox (a weak early card) costs 1, Barbarian Knox (a late-
  game bomb) costs 6. (The original example given was Principal Knox at 5 — but Principal Knox turned
  out to be a Story-mode-only boss card, not part of the general collection, so it's excluded from
  Arena's pool the same way it's excluded from everything else; Barbarian Knox is the actual top of
  the curve instead.)
- You gain **1 summon point per turn** (classic mana-curve ramp), banked into a pool.
- On your turn, you choose which card in hand to pay for out of that pool and bring into play — you
  are never forced to play a card just because you can afford it, and the game never auto-summons
  anything for you.
- Each player preselects a **hero**: a base character with **30 HP**. Once your field is empty, your
  hero is what gets hit.
- Each hero has a **signature ability**, usable instead of playing a card from hand that turn. It
  spends the **same summon-point pool** — one resource total, spent on a card or the hero ability,
  never both in the same turn's budget.

## Cards

- **Monsters** (Travis Knoxes): have a summon cost, ATK, HP, and sometimes an effect.
- **Ability/effect cards**: NOT tied to a specific monster — any player can use them on their turn.
  Stun no longer skips a turn at all: turns still strictly alternate, player by player, no exceptions.
  A "stun" card does something other than remove a turn from the game (debuff, delay an attack,
  reduce effectiveness, etc.) — exact effect TBD, but "skip the opponent's turn" is off the table.
- **Taunt**: some monsters must be killed before anything else can be attacked. Taunt creatures trade
  low ATK for high HP, and a high-ish summon cost — their whole purpose is forcing the opponent into
  removal/dispel/effect answers instead of just racing past them.
- **Synergy pairs/sets**: some Knoxes get boosted stats or new effects when played alongside specific
  others. Some summon smaller "token" Knoxes as a secondary effect, with their own boosted stats under
  certain board conditions.
- **Board-wide effects**: damage the whole field, cleanse/dispel effects, grant an extra attack.
- **Card-advantage effects**: draw cards, look at the opponent's hand, copy an effect, "draw 3 discard
  2" style filtering.
- **Sacrifice costs**: some strong monsters can only be summoned by sacrificing something already on
  the field, spending extra mana value, or sacrificing an effect card instead of paying the normal
  cost — a second axis (board state, not just mana) to build a deck around.
- **Roll-based effect cards**: roll a d20 (brief says 15+/10–15/5–9/1–4 bands):
  - 15+: double damage
  - 10–15: +X damage
  - 5–9: X damage to **yourself**
  - 1–4: instantly sacrifice your summoned card, or lose your next turn
  
  Several cards like this should exist, both to support RNG-leaning "zerg"/aggro decks and as
  high-risk control tools.
- **No-monster rule**: damage-based cards (and presumably direct attacks) can hit the **hero** directly
  if the opponent has no monsters on the field.

## Deck construction

- **40–50 cards.**
- The deck does **not** reshuffle/replenish once empty (unlike SmalLab mode, which reshuffles the
  discard pile). Drawing from an empty deck instead deals **2 damage to yourself** — deck-out is a real
  clock, not a dead end, and it's explicit counterplay to pure stalling: a tank/control deck that
  out-defends everything still loses the fatigue race eventually.
- The point of collecting/building is a **synergised but not overly complex deck**, with room for real
  archetypes to exist side by side:
  - fast/aggro (win early)
  - midrange (win mid-game)
  - stall/control (draw the game out, lean on the fatigue clock as a late-game threat to the *opponent*)
  - tank (high HP/taunt-heavy)
  - balanced
  - effects-focused (cleanse/dispel/draw/copy-heavy)

## Pacing

- **30–40 second turn timer.**
- Target total game length: **5–10 minutes.**

## Resolved

- **Resource model:** one shared pool. Summon points pay for monsters, cards, and the hero ability
  alike — no separate mana track.
- **Stun rework:** turns strictly alternate, always — a stun effect can never skip a player's turn.
  The one spell that fills this role, Written Up, debuffs ATK until the target's controller's next
  turn instead of skipping anything.
- **Cards:** reused/adapted the existing Travis Knox roster (52 non-story, non-Chairman characters) —
  cost derived from the same power-score formula Story mode bosses were balanced with, spread evenly
  across a 1-6 curve, Taunt characters bumped a cost higher per the brief. Beer Frog Knox is hard-pinned
  to cost 1 as the reference example given.
- **Platform:** same repo, own files (`tcg.html`, `tcg-cards.js`, `tcg-rules.js`), same pattern T5 used.
- **Priority:** built now, shipped live, announced with a one-time login notice (see below) rather than
  parked.

## Login notice

Every signed-in player gets a one-time banner on their next login (server-enforced, same once-only
pattern as the Chairman Knox gift — see `supabase/upgrade-23-smallab-notice.sql`): the original game is
now called SmalLab mode and is still fully playable, and Travis: Arena — "personally designed by JRE,
just for your fun" — is live, with a direct link to `tcg.html`.

## Example cost curve

Beer Frog Knox = 1 (early, weak), Barbarian Knox/Leopard Seal Knox/Samurai Knox = 6 (late-game bombs).
Full list in `tcg-cards.js`.
