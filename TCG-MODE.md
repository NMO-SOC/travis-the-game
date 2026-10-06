# New mode (working title) — design brief

Status: **captured, not built.** This is Nick's design brief for a new, more complex card-game mode,
saved as-is (cleaned up into sections, nothing added or decided that wasn't said). The current browser
game (`play.html`/`play.js`, packs/decks/Story/Events/High Stakes — everything `README.md` describes)
is **unchanged and stays primary**. Internally we're now calling it **SmalLab mode** to distinguish it
from this one. Nothing here touches SmalLab mode's code, cards, or database.

This is a different game, not a variant: a hero-plus-deck TCG (closer to Hearthstone/Yu-Gi-Oh than to
SmalLab mode's "6 pre-dealt characters, attack or play a card" loop).

## Core loop

- You don't start with characters on the field. Cards — monsters and effects alike — sit in your
  **hand**, drawn over the course of the game; nothing ever enters play by itself. Each card has a
  **summon value** (a mana-curve-style cost), scaled to its strength — a stronger monster or a more
  powerful effect costs more. E.g. Beer Frog Knox (a weak early card) costs 1, Principal Knox (a late-
  game bomb) costs 5.
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
  Whatever a "stun" card does instead (debuff/delay/etc.) is still open, just not a skip.

## Open questions

Nothing below blocks saving this doc — flagging them because they change what gets built once this
moves past "brief" into an actual spec/implementation:

1. **Card pool:** new card set from scratch, or reuse/adapt existing Travis Knox characters (stats,
   flavor, art) into summon-cost + ATK/HP + effect format?
2. **Platform:** new standalone mode in this repo (own HTML/JS, own Supabase tables, like T5 got its own
   files), or a from-scratch project?
3. **Priority:** is this the next thing to build, or purely a spec to park for later?
