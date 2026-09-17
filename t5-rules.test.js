// node t5-rules.test.js — checks the T5 1v1 rules without a browser.
const vm = require('vm'), fs = require('fs'), assert = require('assert');
vm.runInThisContext(fs.readFileSync(__dirname + '/cards.js', 'utf8'));
const R = require('./t5-rules.js');

const fixed = v => () => v;  // rng: 0.9 = coin tails, 0.1 = heads
const card = id => R.ACT[id];

// Every supported action id and every deck character exists in cards.js
Object.keys(R.ACTIONS).forEach(id => assert.ok(R.ACT[id], 'unknown action ' + id));
assert.strictEqual(R.DEFAULT_DECK.acts.length, 16);

// Untrusted decks: junk dropped, sizes fixed, unsupported cards removed, small decks topped up, spirit clamped
let d = R.sanitizeDeck({chars: ['pirate-knox', 'nope', 42, 'pirate-knox', 'caesar-knox', 'tadpole-knox'], acts: ['reports', 'photo-day', 'hall-pass', '<img>'], spirit: {'waratah-spirit': 99, 'x': 3}});
assert.deepStrictEqual(d.chars, ['pirate-knox', 'pirate-knox', 'caesar-knox']);
assert.strictEqual(d.acts.length, 12); assert.strictEqual(d.acts[0], 'hall-pass'); assert.ok(!d.acts.includes('reports'));
assert.deepStrictEqual(d.spirit, {'waratah-spirit': 3});
assert.deepStrictEqual(R.sanitizeDeck(null).chars, R.DEFAULT_DECK.chars);

// Default game: Jab x2 attack, turn passes
let g = R.newGame(null, fixed(0.9));
assert.strictEqual(g.hands[0].length, 3);
const e = g.teams[1][0], jab = R.baseDamage(g.teams[0][0], 0);
R.attack(g, 0, 0, 0, 0, 2, 0);
assert.strictEqual(e.max - e.hp, jab * 2); assert.strictEqual(g.turn, 1);

// Overdrive cooldown: locked for 2 own turns
R.attack(g, 1, 1, 1, 2, 0, 0);
R.endTurn(g); assert.ok(!R.canAttack(g, 1, 1, 2));
R.endTurn(g); R.endTurn(g); assert.ok(!R.canAttack(g, 1, 1, 2));
R.endTurn(g); R.endTurn(g); assert.ok(R.canAttack(g, 1, 1, 2));

// Shield coin: tails halves, heads blocks
g = R.newGame(null, fixed(0.9)); g.teams[1][0].shield = true;
let before = g.teams[1][0].hp; const full = R.baseDamage(g.teams[0][2], 0);
let ev = R.attack(g, 0, 2, 0, 0, 0, 0);
assert.strictEqual(before - g.teams[1][0].hp, Math.ceil(full / 2)); assert.ok(ev.some(x => x.kind === 'coin' && !x.heads));
g.rng = fixed(0.1); g.teams[0][0].shield = true; before = g.teams[0][0].hp;
R.attack(g, 1, 0, 0, 0, 2, 0); assert.strictEqual(g.teams[0][0].hp, before);

// Defence tier halves; stun skips next turn
g = R.newGame(null, fixed(0.9));
const t2 = g.teams[1][2]; R.attack(g, 0, 0, 2, 1, 0, 2);
assert.strictEqual(t2.max - t2.hp, Math.max(1, Math.round(R.baseDamage(g.teams[0][0], 1) * 0.5)));
assert.ok(!R.canAttack(g, 1, 2, 0)); R.endTurn(g); R.endTurn(g); assert.ok(R.canAttack(g, 1, 2, 0));

// Custom decks and pack cards
g = R.newGame([{chars: ['tadpole-knox', 'excursion-knox', 'caesar-knox'], acts: [], spirit: {'acacia-spirit': 2}}, null], fixed(0.9));
assert.strictEqual(g.teams[0][1].c.n, 'Excursion Knox');
const give = (t, id) => { g.cardPlayed = false; g.turn = t; g.hands[t] = [card(id)]; };
give(0, 'excursion'); R.playCard(g, 0, 0, 0, 1); assert.ok(g.teams[0][1].shield && g.teams[0][1].boost === 2, 'Excursion Knox gimmick');
give(0, 'acacia-spirit'); R.playCard(g, 0, 0, 0, 0); assert.strictEqual(g.teams[0][0].boost, 2, 'spirit uses owned count');
give(0, 's1-4'); R.playCard(g, 0, 0, 1, 0); assert.ok(g.teams[1][0].skip && g.teams[1][0].max - g.teams[1][0].hp === 5);
give(0, 'canteen'); assert.deepStrictEqual(R.cardTargets(g, 0, 0), [], 'nobody on my team hurt');
give(0, 'fog-bank'); assert.ok(!R.canCard(g, 0, 0));
g.teams[0][2].hp -= 5; assert.ok(R.canCard(g, 0, 0)); R.playCard(g, 0, 0, 0, 0); assert.strictEqual(g.teams[0][2].hp, g.teams[0][2].max - 2);
give(0, 'uniform-check'); assert.deepStrictEqual(R.cardTargets(g, 0, 0), [], 'no enemy boosts');
give(0, 'classroom-change'); assert.strictEqual(R.cardTargets(g, 0, 0).length, 6); R.playCard(g, 0, 0, 1, 1); assert.ok(!g.teams[0][1].shield);
give(0, 'low-tide'); R.playCard(g, 0, 0, 1, 1);
const lt = g.teams[1][1]; assert.strictEqual(R.baseDamage(lt, 0), Math.max(1, lt.c.atks[0].dmg - 2));
R.endTurn(g); assert.strictEqual(g.turn, 1); assert.strictEqual(lt.penalty, -2, 'lasts through their turn');
R.endTurn(g); assert.strictEqual(lt.penalty, 0);
give(0, 'compass-is-down'); R.playCard(g, 0, 0, 1, 0); assert.ok(g.teams.flat().every(u => u.skip || u.c.tank));

// Win
g = R.newGame(null, fixed(0.9)); g.teams[1].forEach(u => { u.hp = 0; }); g.teams[1][0].hp = 1;
R.attack(g, 0, 0, 0, 0, 0, 0); assert.strictEqual(g.winner, 0);

assert.strictEqual(R.heightTier(1.2, 1.2), 2); assert.strictEqual(R.heightTier(0.5, 1.5), 1); assert.strictEqual(R.heightTier(0, 0.5), 0);
assert.strictEqual(R.timerTier(0.05), 2); assert.strictEqual(R.timerTier(0.25), 1); assert.strictEqual(R.timerTier(1), 0);
console.log('t5 rules OK');
