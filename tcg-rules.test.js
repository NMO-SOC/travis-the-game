// node tcg-rules.test.js — checks the Arena (TCG mode) rules without a browser.
const vm = require('vm'), fs = require('fs'), assert = require('assert');
vm.runInThisContext(fs.readFileSync(__dirname + '/tcg-cards.js', 'utf8'));
const R = require('./tcg-rules.js');

const fixed = v => () => v;

// Every card in the default deck is a known monster or spell; deck is 45 cards
assert.strictEqual(TCG_DEFAULT_DECK.length, 48);
TCG_DEFAULT_DECK.forEach(id => assert.ok(R.MONSTER[id] || R.SPELL[id], 'unknown card ' + id));

// New game: both heroes at 30 HP, 3-card starting hand, 1 summon point
let g = R.newGame(['doctor-knox', 'beer-frog-knox'], null, fixed(0.9));
assert.strictEqual(g.hero[0].hp, 30);
assert.strictEqual(g.hand[0].length, 3);
assert.strictEqual(g.points[0], 1);

// Force a cheap monster into hand and play it
g.hand[0] = ['beer-frog-knox'];
assert.ok(R.canPlay(g, 0, 0));
assert.ok(R.playCard(g, 0, 0));
assert.strictEqual(g.field[0].length, 1);
assert.strictEqual(g.points[0], 0, 'cost 1 spent from the 1-point pool');
assert.ok(g.field[0][0].sick, 'summoning sickness — can\'t attack the turn it\'s played');
assert.ok(!R.canAttack(g, 0, 0));

// Next turn it's no longer sick and can attack the enemy hero (empty enemy field)
R.endTurn(g); R.endTurn(g);
assert.ok(!g.field[0][0].sick);
const targets = R.attackTargets(g, 0);
assert.deepStrictEqual(targets, [{ kind: 'hero' }]);
const before = g.hero[1].hp;
assert.ok(R.attack(g, 0, 0, { kind: 'hero' }));
assert.strictEqual(before - g.hero[1].hp, 2, 'Beer Frog Knox ATK 2 (cost 1)');
assert.ok(!R.canAttack(g, 0, 0), 'can\'t attack twice in one turn');

// Taunt forces targeting: a taunt monster must be killed before the hero or anything else
g.field[1] = [{ id: 'elephant-seal-knox', n: 'Elephant Seal Knox', atk: 3, hp: 25, max: 25, taunt: true, sick: false, attacked: false, atkMod: 0, idx: 0 },
  { id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 1 }];
assert.deepStrictEqual(R.attackTargets(g, 0), [{ kind: 'monster', team: 1, idx: 0 }], 'taunt is the only legal target');

// Fatigue: drawing from an empty deck costs 2 HP, not a card
g.deck[0] = [];
const hpBefore = g.hero[0].hp;
R.draw(g, 0, 1);
assert.strictEqual(hpBefore - g.hero[0].hp, R.FATIGUE_DMG);

// Spell: Detention Slip deals 2 to an enemy monster, no turn-skip anywhere in the engine
g = R.newGame(null, null, fixed(0.9));
g.hand[0] = ['detention-slip'];
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
assert.ok(R.playCard(g, 0, 0, { kind: 'monster', idx: 0 }));
assert.strictEqual(g.field[1][0].hp, 19);
assert.strictEqual(g.turn, 0, 'playing a card never ends the turn or skips anyone');

// Written Up debuffs ATK until the target's controller's next turn, never skips a turn
g = R.newGame(null, null, fixed(0.9));
g.points[0] = 5; g.hand[0] = ['written-up'];
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
R.playCard(g, 0, 0, { kind: 'monster', idx: 0 });
assert.strictEqual(g.field[1][0].atkMod, -3);
R.endTurn(g); // player 1's turn — the debuff is theirs, clears at the *start* of their own next turn, not immediately
assert.strictEqual(g.field[1][0].atkMod, -3, 'still debuffed on the turn right after it was cast');
assert.strictEqual(g.turn, 1, 'turn alternates normally, nobody got skipped');
R.endTurn(g); R.endTurn(g); // back around to player 1's next turn
assert.strictEqual(g.field[1][0].atkMod, 0, 'cleared at the start of their own next turn');

// Hero power shares the summon-point pool and is once per turn
g = R.newGame(['elephant-seal-knox', 'doctor-knox'], null, fixed(0.9));
g.points[0] = 2;
assert.ok(R.heroPowerUsable(g, 0));
assert.ok(R.useHeroPower(g, 0));
assert.strictEqual(g.points[0], 0);
assert.ok(!R.heroPowerUsable(g, 0), 'already used this turn');

// Win: hero at 0 HP loses
g = R.newGame(null, null, fixed(0.9));
g.hero[1].hp = 1;
g.field[0] = [{ id: 'beer-frog-knox', n: 'Beer Frog Knox', atk: 4, hp: 20, max: 20, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
R.attack(g, 0, 0, { kind: 'hero' });
assert.strictEqual(g.winner, 0);

// CPU turn: plays cards/attacks and always hands the turn back to the human side (or wins)
g = R.newGame(null, null, Math.random);
R.endTurn(g); // get to player 1's turn (CPU side)
assert.strictEqual(g.turn, 1);
R.cpuTurn(g, 1);
assert.ok(g.winner !== null || g.turn === 0, 'cpuTurn always hands the turn back (or wins)');

// Run several full random CPU-vs-CPU games to shake out crashes across many card/board states
for (let game = 0; game < 25; game++) {
  g = R.newGame(null, null, Math.random);
  let rounds = 0;
  while (g.winner === null && rounds++ < 60) R.cpuTurn(g, g.turn);
}
console.log('25 CPU-vs-CPU games ran with no crash');

// Battlecry: summoning is never blocked by the lack of a target — empty enemy field, no target
// passed, the monster still enters play, the battlecry just doesn't fire (nothing to hit).
g = R.newGame(null, null, fixed(0.9));
g.points[0] = 5;
g.hand[0] = ['field-researcher-knox'];
assert.ok(R.playCard(g, 0, 0), 'a monster always summons, even with no legal battlecry target');
assert.strictEqual(g.field[0].length, 1, 'it entered play');
assert.strictEqual(g.hand[0].length, 0);

// With an enemy on the board and no target explicitly chosen, the battlecry auto-picks one.
g = R.newGame(null, null, fixed(0.9));
g.points[0] = 5;
g.hand[0] = ['field-researcher-knox'];
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
assert.ok(R.playCard(g, 0, 0));
assert.strictEqual(g.field[1][0].hp, 19, 'battlecry auto-targeted the only enemy and dealt its 2 damage');
assert.strictEqual(g.field[0].length, 1, 'the monster itself is still on the field');

// An explicitly-chosen, but invalid (dead/out of range), target is still rejected rather than
// silently reinterpreted — this is the one case summoning SHOULD fail.
g = R.newGame(null, null, fixed(0.9));
g.points[0] = 5;
g.hand[0] = ['field-researcher-knox'];
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
assert.ok(!R.playCard(g, 0, 0, { kind: 'monster', idx: 7 }), 'a bogus explicit target still rejects the play');
assert.strictEqual(g.hand[0].length, 1);

// Battlecry: Harbour Seal Knox heals the hero, no target needed
g = R.newGame(null, null, fixed(0.9));
g.points[0] = 5; g.hero[0].hp = 20;
g.hand[0] = ['harbour-seal-knox'];
assert.ok(R.playCard(g, 0, 0));
assert.strictEqual(g.hero[0].hp, 23);

// Battlecry: Tadpole Knox returns the strongest monster from the graveyard to hand
g = R.newGame(null, null, fixed(0.9));
g.points[0] = 5;
g.graveyard[0] = ['beer-frog-knox', 'barbarian-knox']; // barbarian-knox (cost 6) is the "strongest"
g.hand[0] = ['tadpole-knox'];
assert.ok(R.playCard(g, 0, 0));
assert.ok(g.hand[0].includes('barbarian-knox'), 'returned the strongest, not just the first, dead monster');
assert.deepStrictEqual(g.graveyard[0], ['beer-frog-knox']);

// Monsters that die go to the graveyard (feeding Tadpole Knox above)
g = R.newGame(null, null, fixed(0.9));
g.field[0] = [{ id: 'beer-frog-knox', n: 'Beer Frog Knox', atk: 4, hp: 20, max: 20, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 99, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
g.turn = 1;
R.attack(g, 1, 0, { kind: 'monster', idx: 0 });
assert.deepStrictEqual(g.graveyard[0], ['beer-frog-knox']);
assert.strictEqual(g.field[0].length, 0);

// Regression: attackTargets() must include `team` on every monster target. The UI's click handler
// validates a chosen target against this list with `x.team === t` (tcg.html), so a target missing
// `team` silently fails every attack on an enemy monster forever, even though canAttack/attack()
// themselves are fine — this is exactly what let the CPU attack (it calls R.attack directly, bypassing
// the UI check) while the human player's clicks on an enemy monster never did anything.
g = R.newGame(null, null, fixed(0.9));
g.field[0] = [{ id: 'beer-frog-knox', n: 'Beer Frog Knox', atk: 4, hp: 20, max: 20, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
const targs = R.attackTargets(g, 0);
assert.strictEqual(targs.length, 2, 'the enemy monster AND the hero are both legal targets now (no Taunt up)');
assert.strictEqual(targs[0].team, 1, 'monster targets must carry a team, or the UI can never match them');
// Simulate the UI's exact validation predicate for clicking that target.
const uiAccepts = targs.some(x => x.kind === 'monster' && x.team === 1 && x.idx === 0);
assert.ok(uiAccepts, 'the UI click handler would accept this as a valid attack target');

// Opening hand always has something affordable at 1 starting point — a random 3-card hand from the
// 45-card deck misses that ~31% of the time otherwise, which reads as "nothing to play" on turn 1.
for (let i = 0; i < 200; i++) {
  g = R.newGame(null, null, Math.random);
  for (const t of [0, 1]) {
    assert.ok(g.hand[t].some(id => (R.MONSTER[id] || R.SPELL[id]).cost <= 1), 'every opening hand has a 1-cost-or-cheaper card');
    assert.strictEqual(g.hand[t].length, 3, 'the guarantee swaps a card in, it doesn\'t add one');
  }
}

// Watchable CPU turns: cpuStep does exactly one action per call and eventually reports done, instead
// of resolving the whole turn atomically (the UI drives this with a delay between calls so the
// player can see what happened, with a cursor — see tcg.html placeCpuCursor/runCpuStep).
g = R.newGame(null, null, Math.random);
g.turn = 1;
let steps = 0, sawDone = false;
while (steps++ < 200) { const r = R.cpuStep(g, 1); if (r.done) { sawDone = true; break; } assert.ok(r.kind, 'every non-done step reports what it did'); }
assert.ok(sawDone, 'cpuStep eventually finishes the turn');
assert.strictEqual(g.turn, 1, 'cpuStep never ends the turn itself — that\'s the caller\'s job (cpuTurn, or the UI)');

// Hall Monitor peeks the OPPONENT's hand, never your own (reported as "shows my own hand instead").
g = R.newGame(null, null, fixed(0.9));
g.points[0] = 5;
g.hand[0] = ['hall-monitor'];
g.hand[1] = ['beer-frog-knox', 'written-up', 'assembly'];
assert.ok(R.playCard(g, 0, 0, null));
assert.deepStrictEqual(g.peek.hand.slice().sort(), ['assembly', 'beer-frog-knox', 'written-up'].sort(), 'peeked the opponent\'s hand, not the caster\'s own');
assert.strictEqual(g.peek.team, 0, 'tagged with the CASTER\'s team, so the UI shows it only to them');

// A monster can attack every round from the one after it's summoned, not just the round it's
// summoned, and not just once ever — reported as "can only attack while being summoned, then never
// again." Simulate several full rounds by hand rather than trusting a single round's canAttack call.
g = R.newGame(null, null, fixed(0.9));
g.points[0] = 5;
g.hand[0] = ['beer-frog-knox'];
assert.ok(R.playCard(g, 0, 0));
const mon = g.field[0][0];
assert.ok(!R.canAttack(g, 0, 0), 'summoning sickness: cannot attack the turn it was summoned');
for (let round = 0; round < 4; round++) {
  R.endTurn(g); // -> player 1's turn
  R.endTurn(g); // -> player 0's turn again; startTurn(0) clears sickness/attacked
  assert.ok(R.canAttack(g, 0, 0), 'round ' + round + ': ready to attack again at the start of its controller\'s turn');
  assert.ok(R.attack(g, 0, 0, { kind: 'hero' }), 'round ' + round + ': the attack itself succeeds');
  assert.ok(!R.canAttack(g, 0, 0), 'round ' + round + ': cannot attack twice in the same turn');
}
assert.strictEqual(mon.hp, mon.max, 'it never took damage itself, so it\'s still the same monster throughout');

// Armor: absorbs damage before HP, on both monsters and heroes; healing never tops it up.
g = R.newGame(null, null, fixed(0.9));
g.hero[0].armor = 3;
R.attack(g, 0, 0, { kind: 'hero' }); // no-op, just to prove armor alone doesn't crash anything — real hit below
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 5, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0, armor: 2 }];
g.turn = 1;
R.attack(g, 1, 0, { kind: 'hero' });
assert.strictEqual(g.hero[0].armor, 0, 'armor absorbed 3 of the 5 damage');
assert.strictEqual(g.hero[0].hp, g.hero[0].max - 2, 'only the overflow (2) came off HP');

// Taunt still overrides everything, including the new "always hit hero" rule and enemyOrHero spells.
g = R.newGame(null, null, fixed(0.9));
g.field[1] = [
  { id: 'elephant-seal-knox', n: 'Elephant Seal Knox', atk: 2, hp: 10, max: 10, taunt: true, sick: false, attacked: false, atkMod: 0, idx: 0 },
  { id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 1 },
];
assert.deepStrictEqual(R.attackTargets(g, 0), [{ kind: 'monster', team: 1, idx: 0 }], 'Taunt is still the only legal attack target');
g.points[0] = 5; g.hand[0] = ['detention-slip'];
assert.ok(!R.playCard(g, 0, 0, { kind: 'hero' }), 'enemyOrHero spells can\'t snipe the hero while Taunt is up');
assert.ok(R.playCard(g, 0, 0, { kind: 'monster', team: 1, idx: 0 }), 'but the Taunt monster itself is still a legal target');

// enemyOrHero: with no Taunt in the way, a direct-damage (non-AoE) spell can go face.
g = R.newGame(null, null, fixed(0.9));
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
g.points[0] = 5; g.hand[0] = ['detention-slip'];
const heroHpBefore = g.hero[1].hp;
assert.ok(R.playCard(g, 0, 0, { kind: 'hero' }));
assert.strictEqual(heroHpBefore - g.hero[1].hp, 2, 'Detention Slip hit the hero for its 2 damage');

// Freeze: a frozen monster can't attack until its controller's next turn starts.
g = R.newGame(null, null, fixed(0.9));
g.field[0] = [{ id: 'beer-frog-knox', n: 'Beer Frog Knox', atk: 2, hp: 5, max: 5, taunt: false, sick: false, attacked: false, atkMod: 0, frozen: true, idx: 0 }];
assert.ok(!R.canAttack(g, 0, 0), 'frozen monsters cannot attack');
R.endTurn(g); R.endTurn(g); // back around to this side's next turn — startTurn clears frozen
assert.ok(R.canAttack(g, 0, 0), 'unfrozen at the start of its controller\'s next turn');

// Poisonous: combat damage from a poisonous attacker destroys the target outright, armor and all.
g = R.newGame(null, null, fixed(0.9));
g.field[0] = [{ id: 'beer-frog-knox', n: 'Beer Frog Knox', atk: 1, hp: 20, max: 20, taunt: false, sick: false, attacked: false, atkMod: 0, poisonous: true, idx: 0 }];
g.field[1] = [{ id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, armor: 10, idx: 0 }];
R.attack(g, 0, 0, { kind: 'monster', team: 1, idx: 0 });
assert.strictEqual(g.field[1].length, 0, 'a 1 ATK poisonous hit destroyed a 21 HP + 10 armor monster outright');

// Type synergy: Director Knox's battlecry buffs other Scholar monsters you control.
g = R.newGame(null, null, fixed(0.9));
g.field[0] = [{ id: 'field-researcher-knox', n: 'Field Researcher Knox', type: 'scholar', atk: 3, hp: 5, max: 5, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 0 }];
g.points[0] = 5; g.hand[0] = ['director-knox'];
assert.ok(R.playCard(g, 0, 0));
assert.strictEqual(g.field[0][0].atkMod, 1, 'the existing Scholar monster got buffed by the battlecry');

console.log('tcg rules OK');
