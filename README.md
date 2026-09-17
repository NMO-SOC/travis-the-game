# Travis: The Game

A turn-based card game starring sixteen versions of Travis Knox.

**Play in the browser:** open `play.html` (or on the GitHub Pages site). Each player is dealt six random Knoxes face-down. Players take turns: tap one of your characters, then pick one of its **three attacks** (a light Jab, a named signature move, or a heavy Overdrive) and tap an enemy to hit it. Each character acts once per round. Tap a card in your hand to play an action card. Knock out every enemy to win.

**Print it:** open `index.html` and print on Letter cardstock at 100% scale with background graphics on. Full rules are on that page.

Files: `cards.js` holds the shared card data, `index.html` is the printable deck, and `play.html` + `play.js` are the browser game.

## T5 (floor game, 1 v 1)

`t5-display.html` runs on the T5 floor screen. Players scan its QR code (or open `t5.html` and type the code), sign in with their Travis account, pick 3 characters from a saved deck, and tap Ready. Nothing is saved and there's no game log. On the floor, drag an attack onto an enemy; the attacker and then the defender each get a quick skill challenge (hold a height, or stop a hidden clock) that scales the damage, and Shields are a coin flip. "Play with starter decks" skips phones entirely.

Wand tracking comes from the local wand helper on the T5 PC (`serve.py --wands-only`); without it the mouse works. Rules live in `t5-rules.js`; run `node t5-rules.test.js`.
