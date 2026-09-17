/* Travis: T5 1v1 — game rules only, no DOM. Needs chars/acts from cards.js. Used by t5-display.html
   (the floor game) and t5.html (the phone card picker, for ACTIONS/sanitizeDeck).
   A turn: optionally play one action card, then attack with one ready character (ends the turn) or pass.
   Attacks go through two skill tiers (attacker boost, defender guard); Shields are a coin flip. */
var T5Rules = (function () {
'use strict';

const HAND = 3, TEAM = 3, COOLDOWN = [0, 2, 3];  // Jab never; Signature skips 1 own turn; Overdrive skips 2
const ATK_TIERS = [1, 1.5, 2], DEF_TIERS = [1, 0.75, 0.5];
const CHAR = {}, ACT = {};
chars.forEach(c => { CHAR[c.id] = c; });
acts.forEach(a => { ACT[a.id] = a; });

const alive = (g, t) => g.teams[t].filter(u => u.hp > 0);
const hurt = u => u.hp > 0 && u.hp < u.max;

/* Action cards on the floor. to: who it's dropped on. ok(g, t, u): extra check on that unit. */
const enemyHit = (n, txt, extra) => ({to: 'enemy', txt, run(g, t, u, ev) { hit(g, u, n, ev); if (extra && u.hp > 0) extra(u); }});
const boost = (n, txt) => ({to: 'friend', txt, run(g, t, u) { u.boost += n; if (u.c.id === 'excursion-knox' && n === 2) u.shield = true; }});
const teamHeal = (n, txt) => ({to: 'friend', txt, ok: (g, t) => alive(g, t).some(hurt), run(g, t, u, ev) { alive(g, t).forEach(f => heal(f, n, ev)); }});
const stun = u => { if (!u.c.tank) u.skip = true; };
const spirit = id => ({to: 'friend', txt: 'A friend gets +1 ATK per copy you own (max 3).',
  run(g, t, u) { u.boost += Math.min(3, Math.max(1, g.decks[t].spirit[id] || 1)); }});
const ACTIONS = {
  'cat': enemyHit(3, 'Deal 3 damage to an enemy.'),
  'tagging-dart': enemyHit(4, 'Deal 4 damage to an enemy.'),
  'hall-pass': enemyHit(6, 'Deal 6 damage to an enemy.'),
  's1-4': enemyHit(5, 'Deal 5 damage to an enemy. It skips its next turn.', stun),
  'detention': {to: 'enemy', txt: 'An enemy skips their next turn.', ok: (g, t, u) => !u.skip && !u.c.tank, run: (g, t, u) => stun(u)},
  'uniform-check': {to: 'enemy', txt: 'Remove every ATK boost from an enemy.', ok: (g, t, u) => u.boost > 0, run: (g, t, u) => { u.boost = 0; }},
  'low-tide': {to: 'enemy', txt: 'Every enemy gets −2 ATK on their next turn.', run(g, t) { alive(g, 1 - t).forEach(e => { e.penalty = -2; }); }},
  'canteen': {to: 'friend', txt: 'Heal a friend 6 HP.', ok: (g, t, u) => hurt(u), run: (g, t, u, ev) => heal(u, 6, ev)},
  'excursion': boost(2, 'A friend gets +2 ATK for the game.'),
  'relief-teacher': boost(3, 'A friend gets +3 ATK for the game.'),
  'dlc': {to: 'friend', txt: 'Shield a friend. When hit, flip a coin: heads blocks all, tails blocks half.', ok: (g, t, u) => !u.shield, run: (g, t, u) => { u.shield = true; }},
  'long-weekend': {to: 'friend', txt: 'Shield a friend and heal it 5 HP.', ok: (g, t, u) => !u.shield || hurt(u), run: (g, t, u, ev) => { u.shield = true; heal(u, 5, ev); }},
  'assembly': teamHeal(2, 'Heal your whole team 2 HP.'),
  'fog-bank': teamHeal(3, 'Heal your whole team 3 HP.'),
  'staffroom-coffee': teamHeal(4, 'Heal your whole team 4 HP.'),
  'classroom-change': {to: 'any', txt: 'Every Shield on both teams drops.', ok: g => g.teams.flat().some(u => u.hp > 0 && u.shield),
    run(g) { g.teams.flat().forEach(u => { u.shield = false; }); }},
  'compass-is-down': {to: 'any', txt: 'Every character on both teams skips their next turn.', run(g) { g.teams.flat().filter(u => u.hp > 0).forEach(stun); }},
  'waratah-spirit': spirit('waratah-spirit'), 'grevillea-spirit': spirit('grevillea-spirit'),
  'acacia-spirit': spirit('acacia-spirit'), 'banksia-spirit': spirit('banksia-spirit'),
};  // Not in T5 yet: Reports, Photo Day (they need extra choices)

/* Both players get this if they join without phones; also tops up small phone decks. Interleaved so a top-up is a mix. */
const DEFAULT_ACTS = [];
for (let i = 0; i < 4; i++) ['cat', 'canteen', 'excursion', 'dlc', 'detention'].forEach(id => { if (DEFAULT_ACTS.filter(x => x === id).length < ACT[id].x) DEFAULT_ACTS.push(id); });
const DEFAULT_DECK = {chars: ['doctor-knox', 'family-man-knox', 'leopard-seal-knox'], acts: DEFAULT_ACTS, spirit: {}};

/* A deck from a phone is untrusted: keep only real, supported ids and sane sizes. */
function sanitizeDeck(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const list = v => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  let cs = list(raw.chars).filter(id => CHAR[id]).slice(0, TEAM);
  if (cs.length < TEAM) cs = cs.concat(DEFAULT_DECK.chars.filter(id => !cs.includes(id))).slice(0, TEAM);
  let as = list(raw.acts).filter(id => ACTIONS[id]).slice(0, 20);
  if (as.length < 8) as = as.concat(DEFAULT_ACTS.slice(0, 12 - as.length));
  const spirit = {};
  for (const id of Object.keys(ACTIONS).filter(k => k.endsWith('-spirit'))) {
    const n = Math.floor(Number(raw.spirit && raw.spirit[id]));
    if (n >= 1) spirit[id] = Math.min(3, n);
  }
  return {chars: cs, acts: as, spirit};
}

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* decks: [deck, deck] as from sanitizeDeck. */
function newGame(decks, rng = Math.random) {
  decks = (decks || [DEFAULT_DECK, DEFAULT_DECK]).map(sanitizeDeck);
  const g = {rng, decks, turn: 0, winner: null, cardPlayed: false, teams: [], hands: [[], []], piles: [], discards: [[], []]};
  for (const t of [0, 1]) {
    g.teams[t] = decks[t].chars.map((id, i) => {
      const c = CHAR[id];
      return {c, team: t, idx: i, hp: c.hp, max: c.hp, boost: 0, penalty: 0, shield: false, cd: [0, 0, 0], skip: false, skipping: false};
    });
    g.piles[t] = shuffle(decks[t].acts.map(id => ACT[id]), rng);
    for (let i = 0; i < HAND; i++) draw(g, t);
  }
  return g;
}

const baseDamage = (u, mi) => Math.max(1, u.c.atks[mi].dmg + u.boost + u.penalty);

function draw(g, t, force) {
  if (!force && g.hands[t].length >= HAND) return;
  if (!g.piles[t].length) g.piles[t] = shuffle(g.discards[t].splice(0), g.rng);
  if (g.piles[t].length) g.hands[t].push(g.piles[t].pop());
}

function canAttack(g, t, ui, mi) {
  const u = g.teams[t][ui];
  return g.winner === null && g.turn === t && u.hp > 0 && !u.skipping && u.cd[mi] === 0;
}

/* Units a hand card can be dropped on: [{team, idx}]. */
function cardTargets(g, t, hi) {
  const A = ACTIONS[g.hands[t][hi].id];
  const pool = A.to === 'enemy' ? alive(g, 1 - t) : A.to === 'friend' ? alive(g, t) : alive(g, 0).concat(alive(g, 1));
  return pool.filter(u => !A.ok || A.ok(g, t, u)).map(u => ({team: u.team, idx: u.idx}));
}
function canCard(g, t, hi) { return g.winner === null && g.turn === t && !g.cardPlayed && cardTargets(g, t, hi).length > 0; }

/* Damage through Shields. Events describe what happened, for the UI to animate. */
function hit(g, u, amount, ev) {
  if (u.hp <= 0) return;
  if (u.shield) {
    u.shield = false;
    const heads = g.rng() < 0.5;  // heads: Shield blocks it all, tails: it blocks half
    ev.push({kind: 'coin', team: u.team, idx: u.idx, heads});
    if (heads) return;
    amount = Math.ceil(amount / 2);
  }
  u.hp = Math.max(0, u.hp - amount);
  ev.push({kind: 'dmg', team: u.team, idx: u.idx, n: amount});
  if (!alive(g, u.team).length) g.winner = 1 - u.team;
}
function heal(u, n, ev) {
  const before = u.hp;
  u.hp = Math.min(u.max, u.hp + n);
  if (u.hp > before) ev.push({kind: 'heal', team: u.team, idx: u.idx, n: u.hp - before});
}

/* atkTier/defTier: 0-2, from the skill challenges. Ends the turn. */
function attack(g, t, ui, ei, mi, atkTier, defTier) {
  const u = g.teams[t][ui], e = g.teams[1 - t][ei], mv = u.c.atks[mi], ev = [];
  u.cd[mi] = COOLDOWN[mi];
  const dmg = Math.max(1, Math.round(baseDamage(u, mi) * ATK_TIERS[atkTier] * DEF_TIERS[defTier]));
  if (mv.fx === 'unshield') e.shield = false;
  hit(g, e, dmg, ev);
  if (mv.fx === 'heal') heal(u, Math.round(dmg * 0.5), ev);
  else if (mv.fx === 'shield') u.shield = true;
  else if (mv.fx === 'stun' && e.hp > 0) stun(e);
  else if (mv.fx === 'draw') draw(g, t, true);
  else if (mv.fx === 'recoil') hit(g, u, Math.round(dmg * 0.35), ev);
  endTurn(g);
  return ev;
}

function playCard(g, t, hi, tt, ti) {
  const a = g.hands[t].splice(hi, 1)[0], ev = [];
  ACTIONS[a.id].run(g, t, g.teams[tt][ti], ev);
  g.discards[t].push(a);
  g.cardPlayed = true;
  return ev;
}

function startTurn(g, t) {
  g.turn = t; g.cardPlayed = false;
  for (const u of g.teams[t]) { u.cd = u.cd.map(c => Math.max(0, c - 1)); u.skipping = u.skip; u.skip = false; }
  draw(g, t);
}
function endTurn(g) {
  for (const u of g.teams[g.turn]) { u.skipping = false; u.penalty = 0; }
  if (g.winner === null) startTurn(g, 1 - g.turn);
}

/* Skill tiers. Height: seconds held continuously in the tight band / total seconds in the loose band. */
const heightTier = (tightHold, looseTotal) => tightHold >= 1 ? 2 : looseTotal >= 1 ? 1 : 0;
const timerTier = err => err <= 0.1 ? 2 : err <= 0.3 ? 1 : 0;

return {HAND, TEAM, ATK_TIERS, DEF_TIERS, ACTIONS, CHAR, ACT, DEFAULT_DECK, sanitizeDeck, newGame, alive, baseDamage,
  canAttack, cardTargets, canCard, attack, playCard, endTurn, heightTier, timerTier};
})();
if (typeof module !== 'undefined') module.exports = T5Rules;
