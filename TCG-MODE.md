# New mode (working title) — design brief

Status: **captured, not built.** This is Nick's design brief for a new, more complex card-game mode,
saved as-is (cleaned up into sections, nothing added or decided that wasn't said). The current browser
game (`play.html`/`play.js`, packs/decks/Story/Events/High Stakes — everything `README.md` describes)
is **unchanged and stays primary**. Internally we're now calling it **SmalLab mode** to distinguish it
from this one. Nothing here touches SmalLab mode's code, cards, or database.

This is a different game, not a variant: a hero-plus-deck TCG (closer to Hearthstone/Yu-Gi-Oh than to
SmalLab mode's "6 pre-dealt characters, attack or play a card" loop).

## Core loop

- You don't start with characters on the field. You **summon** Travis Knoxes from your hand by
  spending **summon value** (a mana-curve-style cost per card).
- You gain **1 summon point per turn** (classic mana-curve ramp).
- Each player preselects a **hero**: a base character with **30 HP**. Once your field is empty, your
  hero is what gets hit.
- Each hero has a **signature ability**, usable instead of summoning a monster or playing a card —
  spends a separate resource ("mana" in the brief) rather than summon points. *Open question: is this
  the same pool as summon points, or a second resource entirely? See Open questions below.*

## Cards

- **Monsters** (Travis Knoxes): have a summon cost, ATK, HP, and sometimes an effect.
- **Ability/effect cards**: NOT tied to a specific monster — any player can use them on their turn.
  Stun is kept as a mechanic, but reworked so it doesn't just lock a character out forever (a problem
  already fixed once in SmalLab mode's `stun()` — same principle should carry over here: no card should
  be able to permanently remove a turn from the game).
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

## Open questions

Nothing below blocks saving this doc — flagging them because they change what gets built once this
moves past "brief" into an actual spec/implementation:

1. **Resource model:** is the hero ability powered by the same summon-point pool as monster summons
   (a single resource, spend it on a creature *or* the hero power each turn), or a second, separately
   accumulating resource (closer to Hearthstone's 1-per-turn hero power on top of mana)? The brief says
   "use for mana **instead of** using cards or summoning," which reads like one shared pool, but it's
   worth confirming before the cost curve gets designed around it.
2. **Stun rework:** "each player should get a turn" — does this mean stun now only ever delays, never
   skips entirely (e.g. the target acts at reduced effectiveness instead of not at all), or does it mean
   the existing SmalLab mode guard (one free turn after a stun before it can be stunned again) is enough
   once ported over?
3. **Card pool:** new card set from scratch, or reuse/adapt existing Travis Knox characters (stats,
   flavor, art) into summon-cost + ATK/HP + effect format?
4. **Platform:** new standalone mode in this repo (own HTML/JS, own Supabase tables, like T5 got its own
   files), or a from-scratch project?
5. **Priority:** is this the next thing to build, or purely a spec to park for later?
