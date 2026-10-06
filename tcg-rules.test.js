// node tcg-rules.test.js — checks the Arena (TCG mode) rules without a browser.
const vm = require('vm'), fs = require('fs'), assert = require('assert');
vm.runInThisContext(fs.readFileSync(__dirname + '/tcg-cards.js', 'utf8'));
const R = require('./tcg-rules.js');

const fixed = v => () => v;

// Every card in the default deck is a known monster or spell; deck is 45 cards
assert.strictEqual(TCG_DEFAULT_DECK.length, 45);
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
assert.strictEqual(before - g.hero[1].hp, 4, 'Beer Frog Knox ATK 4');
assert.ok(!R.canAttack(g, 0, 0), 'can\'t attack twice in one turn');

// Taunt forces targeting: a taunt monster must be killed before the hero or anything else
g.field[1] = [{ id: 'elephant-seal-knox', n: 'Elephant Seal Knox', atk: 3, hp: 25, max: 25, taunt: true, sick: false, attacked: false, atkMod: 0, idx: 0 },
  { id: 'doctor-knox', n: 'Doctor Knox', atk: 4, hp: 21, max: 21, taunt: false, sick: false, attacked: false, atkMod: 0, idx: 1 }];
assert.deepStrictEqual(R.attackTargets(g, 0), [{ kind: 'monster', idx: 0 }], 'taunt is the only legal target');

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

console.log('tcg rules OK');
