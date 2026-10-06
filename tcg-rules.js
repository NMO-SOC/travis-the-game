/* Travis: Arena — game rules only, no DOM. Needs TCG_MONSTERS/TCG_SPELLS/TCG_HEROES/TCG_DEFAULT_DECK
   from tcg-cards.js. See TCG-MODE.md for the design brief this implements.

   Resource: 1 summon point per turn, banked, capped at MAX_POINTS. Spent on playing a card from hand
   (monster or spell) or the hero power — one shared pool, nothing is ever auto-played.
   Turns strictly alternate, always — no card may ever skip a player's turn (Written Up and other
   "stun"-flavoured cards debuff instead: reduced ATK until the target's controller's next turn).
   Taunt: while any enemy monster with taunt is alive, it's the only legal attack target (and the hero
   can't be hit either). Deck doesn't reshuffle: drawing from empty hits your hero for 2. */
var TCGRules = (function () {
'use strict';

const START_HP = 30, START_HAND = 3, HAND_CAP = 10, MAX_POINTS = 10, FATIGUE_DMG = 2;
const MONSTER = {}, SPELL = {}, HERO = {};
TCG_MONSTERS.forEach(c => { MONSTER[c.id] = c; });
TCG_SPELLS.forEach(c => { SPELL[c.id] = c; });
TCG_HEROES.forEach(h => { HERO[h.id] = h; });

function shuffle(a, rng) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* heroIds: [id, id]. decks: [[cardId,...], [cardId,...]] or null for TCG_DEFAULT_DECK both sides. */
function newGame(heroIds, decks, rng = Math.random) {
  heroIds = heroIds && heroIds.length === 2 ? heroIds : [TCG_HEROES[0].id, TCG_HEROES[1].id];
  decks = (decks || [TCG_DEFAULT_DECK, TCG_DEFAULT_DECK]).map(d => (d && d.length ? d : TCG_DEFAULT_DECK).filter(id => MONSTER[id] || SPELL[id]));
  const g = {
    rng, turn: 0, winner: null, round: 1, log: [], lastSpell: [null, null],
    hero: heroIds.map(id => ({ id, hp: (HERO[id] || HERO[TCG_HEROES[0].id]).hp, max: (HERO[id] || HERO[TCG_HEROES[0].id]).hp, powerUsed: false })),
    points: [1, 1], maxPoints: [1, 1],
    deck: [], hand: [[], []], field: [[], []], fatigue: [0, 0],
  };
  for (const t of [0, 1]) {
    g.deck[t] = shuffle(decks[t], rng);
    for (let i = 0; i < START_HAND; i++) draw(g, t);
  }
  log(g, 'Round 1 — ' + heroName(g, 0) + ' goes first.');
  return g;
}
function heroName(g, t) { const h = HERO[g.hero[t].id]; return h ? h.n : 'Hero'; }
function log(g, s) { g.log.push(s); if (g.log.length > 300) g.log.shift(); }

function cardOf(id) { return MONSTER[id] || SPELL[id]; }
function isMonster(id) { return !!MONSTER[id]; }

/* Drawing: hand over HAND_CAP burns the card (discarded, no effect) rather than growing forever.
   Empty deck: no card is drawn, the hero takes FATIGUE_DMG instead — a real clock against stalling. */
function draw(g, t, n) {
  n = n || 1;
  for (let i = 0; i < n; i++) {
    if (g.deck[t].length) {
      const id = g.deck[t].pop();
      if (g.hand[t].length < HAND_CAP) g.hand[t].push(id);
    } else {
      g.fatigue[t]++;
      damageHero(g, t, FATIGUE_DMG);
      log(g, heroName(g, t) + ' draws from an empty deck and takes ' + FATIGUE_DMG + ' damage.');
    }
  }
}

function aliveField(g, t) { return g.field[t].filter(u => u.hp > 0); }
function tauntUp(g, t) { return aliveField(g, t).some(u => u.taunt); }

/* Legal attack targets for a friendly attacker: taunt monsters take priority; otherwise any enemy
   monster, or the enemy hero if their field is empty. Mirrors the "damage can hit the hero if no
   monsters are up" rule from the brief. */
function attackTargets(g, t) {
  const foes = aliveField(g, 1 - t);
  const taunts = foes.filter(u => u.taunt);
  const list = (taunts.length ? taunts : foes).map(u => ({ kind: 'monster', idx: u.idx }));
  if (!foes.length) list.push({ kind: 'hero' });
  return list;
}
function canAttack(g, t, fi) {
  const u = g.field[t][fi];
  return g.winner === null && g.turn === t && u && u.hp > 0 && !u.sick && !u.attacked;
}
/* n negative heals (clamped to max HP) — used by a few spells/powers instead of a separate heal fn. */
function damageHero(g, t, n) {
  const h = g.hero[t];
  h.hp = Math.max(0, Math.min(h.max, h.hp - n));
  if (h.hp <= 0 && g.winner === null) { g.winner = 1 - t; log(g, heroName(g, t) + ' is defeated!'); }
}
function damageMonster(g, t, idx, n) {
  const u = g.field[t][idx];
  if (!u || u.hp <= 0) return;
  u.hp = Math.max(0, u.hp - n);
  if (u.hp <= 0) log(g, u.n + ' is destroyed.');
}
function attack(g, t, fi, target) {
  if (!canAttack(g, t, fi)) return false;
  const u = g.field[t][fi], atk = Math.max(0, u.atk + (u.atkMod || 0));
  u.attacked = true;
  if (target.kind === 'hero') { damageHero(g, 1 - t, atk); log(g, u.n + ' hits ' + heroName(g, 1 - t) + ' for ' + atk + '.'); }
  else { const e = g.field[1 - t][target.idx]; damageMonster(g, 1 - t, target.idx, atk); log(g, u.n + ' hits ' + e.n + ' for ' + atk + '.'); }
  return true;
}

function canPlay(g, t, hi) {
  const id = g.hand[t][hi];
  return g.winner === null && g.turn === t && id != null && cardOf(id) && cardOf(id).cost <= g.points[t];
}
/* target: {kind:'monster', idx} for a friendly/enemy field slot, or null. sacIdx: a friendly field
   slot to sacrifice, for cards with sac:true. Returns false (and leaves the hand untouched) if the
   target/sacrifice requirement isn't met, so the caller can re-prompt instead of silently failing. */
function playCard(g, t, hi, target, sacIdx) {
  if (!canPlay(g, t, hi)) return false;
  const id = g.hand[t][hi], c = cardOf(id);
  if (isMonster(id)) {
    g.points[t] -= c.cost;
    g.hand[t].splice(hi, 1);
    g.field[t].push({ id, n: c.n, atk: c.atk, hp: c.hp, max: c.hp, taunt: !!c.taunt, sick: true, attacked: false, atkMod: 0, atkModOwner: null, atkModArmed: false, idx: g.field[t].length });
    reindex(g, t);
    log(g, heroName(g, t) + ' summons ' + c.n + '.');
    return true;
  }
  const s = c;
  if (s.sac) {
    if (sacIdx == null || !g.field[t][sacIdx] || g.field[t][sacIdx].hp <= 0) return false;
  }
  if ((s.to === 'enemy' || s.to === 'friend') && (!target || target.kind !== 'monster')) return false;
  if (s.to === 'friendOrNone' && target && target.kind !== 'monster') return false;
  g.points[t] -= s.cost;
  g.hand[t].splice(hi, 1);
  if (s.sac) { g.field[t][sacIdx].hp = 0; log(g, heroName(g, t) + ' sacrifices ' + g.field[t][sacIdx].n + '.'); }
  g.lastSpell[t] = id;
  log(g, heroName(g, t) + ' casts ' + s.n + '.');
  SPELL_FX[id](g, t, target);
  cleanupField(g);
  return true;
}

function cleanupField(g) { for (const t of [0, 1]) { g.field[t] = aliveField(g, t); reindex(g, t); } }
function reindex(g, t) { g.field[t].forEach((u, i) => { u.idx = i; }); }
function weakest(g, t) { const f = aliveField(g, t); return f.length ? f.reduce((a, b) => a.hp <= b.hp ? a : b) : null; }
function roll20(g) { return 1 + Math.floor(g.rng() * 20); }

const SPELL_FX = {
  'food-fight': (g, t) => aliveField(g, 1 - t).forEach(u => damageMonster(g, 1 - t, u.idx, 2)),
  'clean-slate': g => [0, 1].forEach(t => g.field[t].forEach(u => { u.atkMod = 0; })),
  'double-period': (g, t, tgt) => { const u = g.field[t][tgt.idx]; if (u) u.attacked = false; },
  'pop-quiz': (g, t) => { draw(g, t, 2); if (g.hand[t].length) g.hand[t].splice(Math.floor(g.rng() * g.hand[t].length), 1); },
  'hall-monitor': (g, t) => { g.peek = { team: t, hand: g.hand[1 - t].slice() }; log(g, heroName(g, t) + ' looks at ' + heroName(g, 1 - t) + '&rsquo;s hand.'); },
  'group-project': (g, t) => { const id = g.lastSpell[1 - t] || g.lastSpell[t]; if (id && SPELL_FX[id]) SPELL_FX[id](g, t, { kind: 'monster', idx: 0 }); },
  'written-up': (g, t, tgt) => { const u = g.field[1 - t][tgt.idx]; if (u) { u.atkMod -= 3; u.atkModOwner = 1 - t; u.atkModArmed = false; } },
  'faculty-meeting': (g, t, tgt) => damageMonster(g, 1 - t, tgt.idx, 6),
  'science-fair-volcano': (g, t, tgt) => {
    const r = roll20(g);
    if (r >= 15) damageMonster(g, 1 - t, tgt.idx, 8);
    else if (r >= 10) damageMonster(g, 1 - t, tgt.idx, 8);
    else if (r >= 5) damageHero(g, t, 4);
    else { const w = weakest(g, t); if (w) w.hp = 0; }
    log(g, 'Rolled ' + r + '.');
  },
  'excursion-bus': (g, t, tgt) => { const u = g.field[t][tgt.idx]; if (u) { u.max += 4; u.hp += 4; u.taunt = true; } },
  'low-tide': (g, t) => aliveField(g, 1 - t).forEach(u => { u.atkMod -= 2; u.atkModOwner = 1 - t; u.atkModArmed = false; }),
  'detention-slip': (g, t, tgt) => damageMonster(g, 1 - t, tgt.idx, 2),
  'staffroom-coffee': (g, t, tgt) => { if (tgt && tgt.kind === 'monster') { const u = g.field[t][tgt.idx]; if (u) u.hp = Math.min(u.max, u.hp + 5); } else damageHero(g, t, -5); },
  'assembly': (g, t) => { damageHero(g, t, -6); draw(g, t, 1); },
};

function heroPowerUsable(g, t) {
  const h = g.hero[t], hero = HERO[h.id];
  return g.winner === null && g.turn === t && !h.powerUsed && hero && hero.power.cost <= g.points[t];
}
function useHeroPower(g, t, target) {
  if (!heroPowerUsable(g, t)) return false;
  const h = g.hero[t], hero = HERO[h.id];
  if (hero.power.to === 'enemy' && (!target || target.kind !== 'monster')) return false;
  g.points[t] -= hero.power.cost; h.powerUsed = true;
  log(g, heroName(g, t) + ' uses ' + hero.power.n + '.');
  if (hero.id === 'doctor-knox') damageMonster(g, 1 - t, target.idx, 3);
  else if (hero.id === 'elephant-seal-knox') damageHero(g, t, -4);
  else if (hero.id === 'beer-frog-knox') aliveField(g, 1 - t).forEach(u => damageMonster(g, 1 - t, u.idx, 1));
  cleanupField(g);
  return true;
}

function startTurn(g, t) {
  g.turn = t;
  g.maxPoints[t] = Math.min(MAX_POINTS, g.maxPoints[t] + 1);
  g.points[t] = g.maxPoints[t];
  g.hero[t].powerUsed = false;
  g.field[t].forEach(u => { u.sick = false; u.attacked = false; });
  // a Written Up-style debuff lasts through the target's very next turn, then clears at the start of
  // the turn after that — "armed" marks that the one free turn has already happened.
  g.field.flat().forEach(u => {
    if (u.atkModOwner !== t) return;
    if (u.atkModArmed) { u.atkMod = 0; u.atkModOwner = null; u.atkModArmed = false; }
    else u.atkModArmed = true;
  });
  draw(g, t, 1);
  log(g, heroName(g, t) + '&rsquo;s turn.');
}
function endTurn(g) {
  if (g.winner !== null) return;
  const next = 1 - g.turn;
  if (next === 0) g.round++;
  startTurn(g, next);
}

return {
  START_HP, START_HAND, HAND_CAP, MAX_POINTS, FATIGUE_DMG, MONSTER, SPELL, HERO,
  newGame, draw, aliveField, tauntUp, attackTargets, canAttack, attack,
  canPlay, playCard, heroPowerUsable, useHeroPower, startTurn, endTurn, roll20,
};
})();
if (typeof module !== 'undefined') module.exports = TCGRules;
