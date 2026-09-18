# Travis: The Game

A turn-based card game starring dozens of versions of Travis Knox. Play in the browser against the CPU, a friend on the same device, or a colleague online — build a collection, open packs, build decks, run a single-player Story campaign, or play a physical printed deck at the kitchen table.

**Play in the browser:** open `play.html`, or the GitHub Pages site. Sign in (or play as a guest with a random hand) and go.

**Print it:** open `index.html` and print on Letter cardstock at 100% scale with background graphics on — a 16-character starter set, no account needed.

Files: `cards.js` holds all shared card data, `index.html` is the printable starter deck, `play.html` + `play.js` + `account.js` are the browser game (Supabase-backed), and `supabase/` holds every database migration in order.

## Full rules

### The goal

Knock out every character on your opponent's team.

### The deal

Each player fields a team — **3, 4, or 6** characters, your choice of format. If you're signed in with a saved deck, you choose which characters from it to field; otherwise you're dealt random characters, face-down. Your own cards are visible to you immediately; an opponent's stay face-down until that character takes its first turn.

### Turns

Players alternate, back and forth (a coin flip decides who goes first, and who leads alternates every round so nobody keeps first-move advantage). On your turn:

- **Choose one of your ready (not yet acted) characters.**
- **Attack:** pick one of its three attacks — a light **Jab**, a named **signature move** (often with an extra effect like healing, a Shield, or a stun), or a heavy **Overdrive** that costs it some of its own HP — and hit an enemy.
- **Play an action card** (optional, one per turn, before or after attacking): you draw one action card each turn, up to a hand of 3.

Once every character on both teams has acted, a new round starts and everyone untaps.

### Health and status

- **HP** hits 0 → knocked out. Healing never exceeds a character's max HP.
- **Shield** blocks all damage from the next hit, then it's gone.
- **Skip** — that character misses its next chance to act. A few characters are marked as **tanks** and simply can't be stunned at all.
- After a character is stunned, it gets one guaranteed free turn before it can be stunned again — no permanently locking one character out of the game.

### Modes

- **Versus CPU** — four difficulties: **Easy** (very forgiving), **Medium** (makes real mistakes), **Hard** (a fair fight, has a 15s move timer), **Insane** (plays with zero randomness or mistakes — brutally hard, but pays out noticeably better XP and pack odds on a win). Easy/Medium have no move timer; Hard/Insane and Online give you 15 seconds a turn (30s against the CPU) before your turn auto-forfeits.
- **Two Players** — pass the device, no account needed.
- **Online** — invite a signed-in colleague with a match code; live turn-by-turn play, plus spectating and in-match chat.

### Decks and collection

Signed-in players can save decks: **exactly 6 characters** (no duplicates — a deck is 6 *distinct* characters, however many copies of a card you own) and **exactly 12 action cards** (up to 3 copies of most). For 3v3/4v4, you choose which of your deck's 6 to field before the game starts. Cards you don't own or that don't fit a format simply aren't offered.

Buying and selling uses **Grant Points**: common cards cost 8 GP (cap 3 copies), rare cards cost 20 GP (cap 1). Starter (base) cards, foil/gold finishes, Chairman Knox, Australiana cards, and Story reward cards can never be bought — they're pack- or achievement-only. Selling refunds half the buy price.

### Packs

Win a CPU or online game to earn a pack (up to **5 free wins a day**) — you choose which pack to open. Most packs can also be bought outright with Grant Points. Every pack opens 3 cards, each rolled independently across starter/common/rare/foil/gold slots; a duplicate you already own at cap converts into Grant Points instead (2 GP for a common, 5 for a rare/foil/gold, 1 for a starter) — so "all duplicates" on the reveal screen still means points, not nothing.

Packs: **Term One, SOC's Favourite, Field Season, End of Year, Daily Org, Spirit Week, Knox of History, Australiana** (limited-time), **Holo** (guarantees a foil), **Legendary** (guarantees a gold).

**Chairman Knox** is never sold or purchased: a one-time gift to every player, and otherwise a 1-in-100 chance on any pack won from an **online** win. Alone it's the weakest card in the game (1/1/1) — own three, and every copy plays as 10/10/10 instead.

**High Stakes:** on Hard/Insane CPU or Online games, stake 10–100 Grant Points before the match. Win and get a bonus pack on top of your daily wins; lose and forfeit the stake.

### Story Mode

A single-player campaign on a campus map: four faculties (Science, Maths, English, Humanities), each three quick 3v3 chapters against that faculty's foe pool, capped off by its Head of Faculty as a boss fight. Beating a Head adds their card to your permanent collection — the four Heads and the final boss, Principal Travis Knox, are the strongest cards in the game. Clear all four faculties to unlock the Principal finale. Story wins don't count toward your daily free win-packs; it's a separate reward track, and each chapter's reward is only ever given once.

### Special Events

Admins can run a time-limited event from the Admin screen: pick which packs' characters are allowed (or foils-only), set a fixed 12-card action deck everyone plays, and go live. Players see it as an extra menu option for CPU or Online. Events can optionally be restricted to specific usernames, so a new-player-hostile event doesn't show up for everyone.

## T5 (floor game, 1 v 1)

`t5-display.html` runs on the T5 floor screen. Players scan its QR code (or open `t5.html` and type the code), sign in with their Travis account, pick 3 characters from a saved deck, and tap Ready. Nothing is saved and there's no game log. On the floor, drag an attack onto an enemy; the attacker and then the defender each get a quick skill challenge (hold a height, or stop a hidden clock) that scales the damage, and Shields are a coin flip. "Play with starter decks" skips phones entirely.

Wand tracking comes from the local wand helper on the T5 PC (`serve.py --wands-only`); without it the mouse works. Rules live in `t5-rules.js`; run `node t5-rules.test.js`.

## Admin

Signed-in players with `profiles.is_admin = true` get an Admin screen: a live overview of every player and their activity, Special Events management, and giving packs/cards directly. Promote someone with:

```sql
update public.profiles set is_admin = true where username = 'their_username';
```

## Database

Everything server-side lives in `supabase/`. `schema.sql` is the base install; `upgrade-*.sql` files apply in numeric order on top of it and are all safe to run more than once. Check a given upgrade file's own header comment for what it needs to run first.
