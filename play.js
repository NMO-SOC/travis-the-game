/* Travis: The Game — browser engine. Depends on cards.js (S, chars, acts). */
(function(){
'use strict';

var HAND_LIMIT = 3;
var ABORT_OVER = {abort:'over'}, ABORT_DEAD = {abort:'dead'};
var CFG = {mode:'cpu', size:6, speed:1};
var G = {phase:'menu', log:[], fx:[]};

var CHAR = {}; chars.forEach(function(c,i){ CHAR[c.n] = i; });
var CHARID = {}; chars.forEach(function(c,i){ CHARID[c.id] = i; });
var ACTD = {}; acts.forEach(function(a){ ACTD[a.n] = a; });
var ACTID = {}; acts.forEach(function(a){ ACTID[a.id] = a; });
var BASE_CHARS = chars.map(function(_,i){ return i; }).filter(function(i){ return chars[i].set==='base'; });
var ACC = (typeof window!=='undefined' && window.TravisAccount) || null;

/* ---------------- helpers ---------------- */
/* Online games need both browsers to roll identical dice, so game logic draws from a seeded generator. */
function seeded(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function rand(){ return G && G.rng ? G.rng() : Math.random(); }
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(rand()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function best(arr, ai){
  if(!ai) return arr[Math.floor(rand()*arr.length)];
  var b=null, bs=-Infinity;
  arr.forEach(function(x,i){ var s=ai(x,i)+rand()*0.01; if(s>bs){ bs=s; b=x; } });
  return b;
}
function bestIdx(arr, ai){ var b=best(arr.map(function(x,i){return {x:x,i:i};}), ai ? function(o){ return ai(o.x,o.i); } : null); return b.i; }

function isCPU(t){ return CFG.mode==='sim' || (CFG.mode==='cpu' && t===1); }
function isRemote(t){ return CFG.mode==='online' && t!==CFG.me; }
function pname(t){
  if(CFG.mode==='cpu') return t===0 ? 'You' : 'CPU';
  if(CFG.mode==='sim') return 'CPU '+(t+1);
  if(CFG.mode==='online') return t===CFG.me ? 'You' : (CFG.names && CFG.names[t]) || 'Opponent';
  return 'Player '+(t+1);
}
function viewer(){
  if(CFG.mode==='online') return CFG.me;
  if(CFG.mode!=='hot') return 0;
  if(G.phase==='deal') return G.deal.turn;
  return handTeam();
}
function hidden(u){ return !u.revealed && u.team!==viewer(); }
function nm(u){ return '<b class="t'+u.team+'">'+(hidden(u) ? 'a face-down card' : u.c.n)+'</b>'; }
function reveal(u){
  if(u.revealed) return;
  var was = hidden(u);
  u.revealed = true;
  if(was){ fxc('u'+u.id, 'flip', 700); log(pn(u.team)+' reveals '+nm(u)+'!', 'reveal'); }
}
function pn(t){ return '<b class="t'+t+'">'+pname(t)+'</b>'; }
function possessive(t){ return pname(t)==='You' ? 'Your' : pname(t)+'&rsquo;s'; }
function card(n){ return '<i>'+n+'</i>'; }

function moveDamage(u, mv){ return Math.max(1, mv.dmg + u.atkGame + u.atkRound); }
/* Typical attack power for a character right now (its hardest-hitting move) — used by CPU heuristics
   and by other cards' targeting AI, not to display a single ATK number any more. */
function effAtk(u){ return Math.max.apply(null, u.c.atks.map(function(mv){ return moveDamage(u, mv); })); }
function effSpd(u){ return u.spd; }
function living(t){ return G.teams[t].filter(function(u){ return !u.ko; }); }
function foes(u){ return living(1-u.team); }
function allUnits(){ return G.teams[0].concat(G.teams[1]); }
function unitById(id){ return allUnits().filter(function(u){ return u.id===id; })[0]; }
function queue(){
  return allUnits().filter(function(u){ return !u.ko && !u.acted; })
    .sort(function(a,b){ return effSpd(b)-effSpd(a) || b.hp-a.hp || b.tie-a.tie; });
}
function maxMissing(t){ return living(t).reduce(function(m,u){ return Math.max(m, u.max-u.hp); }, 0); }
function now(){ return Date.now(); }

function newUnit(ci, team, foil){
  var c = chars[ci];
  return {id:++G.uid, ci:ci, c:c, team:team, max:c.hp, hp:c.hp, spd:c.spd, foil:!!foil,
    ko:false, revealed:false, shield:false, atkGame:0, atkRound:0, skip:0, acted:false, tie:rand()};
}

/* ---------------- async plumbing ---------------- */
function delay(ms){
  var g = G;
  var p = CFG.speed ? new Promise(function(r){ setTimeout(r, ms*CFG.speed); }) : Promise.resolve();
  return p.then(function(){ if(g!==G) throw ABORT_DEAD; });
}
function checkInt(){ if(G.over) throw ABORT_OVER; }
function sleep(ms){ return delay(ms).then(checkInt); }

/* Every player decision goes through wait(). Online, a local decision is also broadcast, and a decision
   belonging to the remote player is taken from the network queue instead of the screen. */
function wait(kind, data){
  if(data && data.team!=null && isRemote(data.team)) return remoteInput(kind, data);
  return new Promise(function(res, rej){
    var w = {kind:kind};
    for(var k in data) w[k]=data[k];
    w.res = function(v){
      if(G.wait!==w) return;
      if(CFG.mode==='online') NET.send({k:'in', v:encodeInput(kind, v)});
      G.wait=null; render(); res(v);
    };
    w.rej = function(e){ G.wait=null; render(); rej(e); };
    G.wait = w; render();
  });
}
function encodeInput(kind, v){
  if(kind==='unit') return v ? v.id : null;
  if(kind==='cmd') return {t:v.t, target:v.target, i:v.i, cur:G.cur ? G.cur.id : null};
  return v;
}
function remoteInput(kind, data){
  var g = G;
  G.wait = {kind:'remote', team:data.team, what:kind}; render();
  return new Promise(function(res){
    NET.next(function(v){
      if(g!==G) return;
      G.wait = null;
      if(kind==='unit') v = v==null ? null : unitById(v);
      else if(kind==='cmd'){ G.cur = v.cur==null ? null : unitById(v.cur); v = {t:v.t, target:v.target, i:v.i}; }
      render(); res(v);
    });
  });
}
function pickUnit(team, prompt, cands, ai, cancel){
  if(!cands.length) return Promise.resolve(null);
  if(isCPU(team)) return sleep(350).then(function(){ return best(cands, ai); });
  return wait('unit', {team:team, prompt:prompt, ids:cands.map(function(u){ return u.id; }), cancel:!!cancel});
}
/* Choose one of several options (shown as cards when they have .act). Resolves to an index, or -1 if cancelled. */
function pickOpt(team, prompt, opts, ai, cancel){
  if(!opts.length) return Promise.resolve(-1);
  if(isCPU(team)) return sleep(350).then(function(){ return bestIdx(opts, ai); });
  return wait('opt', {team:team, prompt:prompt, opts:opts, cancel:!!cancel});
}

/* ---------------- log & fx ---------------- */
function log(h, cls){
  h = h.replace(/(>You<\/b>) (plays|draws)/g, function(m, you, verb){ return you+' '+verb.slice(0,-1); });
  G.log.unshift({h:h, cls:cls||''});
  if(G.log.length>250) G.log.pop();
  render();
}
/* One-shot visual effects. Each lives for `dur` ms; re-renders resume the animation via a negative delay. */
function fxc(key, cls, dur, wait){ (G.fx=G.fx||[]).push({key:key, cls:cls, t0:now()+(wait||0), dur:dur+(wait||0)}); }
function fx(u, text, kind){
  (G.fx=G.fx||[]).push({key:'u'+u.id, float:text, kind:kind, t0:now(), dur:1200});
  if(kind==='dmg') fxc('u'+u.id, 'hit', 450);
  if(kind==='heal') fxc('u'+u.id, 'healed', 800);
}
function fxFor(key){
  var t = now(), cls = '', fl = '', d = null;
  (G.fx||[]).forEach(function(f){
    if(f.key!==key || t-f.t0>f.dur) return;
    var el = t-f.t0;
    if(f.cls){ cls += ' '+f.cls; d = -el; }
    if(f.float) fl += '<span class="float '+f.kind+'" style="animation-delay:'+(-el)+'ms">'+f.float+'</span>';
  });
  return {cls:cls, style:d==null ? '' : '--d:'+d+'ms', fl:fl};
}

/* ---------------- core combat ---------------- */
async function damage(t, amt){
  if(t.ko) return;
  if(t.shield){ t.shield=false; fx(t,'Blocked','blk'); log(nm(t)+'&rsquo;s Shield blocks the hit.'); return; }
  t.hp -= amt;
  fx(t, '&minus;'+amt, 'dmg');
  log(nm(t)+' takes <b>'+amt+'</b> damage.');
  if(t.hp<=0) knockOut(t);
}
function heal(u, n){
  if(u.ko || u.hp>=u.max) return;
  var before = u.hp; u.hp = Math.min(u.max, u.hp+n);
  fx(u, '+'+(u.hp-before), 'heal');
  log(nm(u)+' heals <b>'+(u.hp-before)+'</b> HP.');
}
function knockOut(t){
  reveal(t);
  t.ko=true; t.hp=0; t.shield=false; t.atkGame=0; t.skip=0;
  fxc('u'+t.id, 'die', 900);
  log(nm(t)+' is <b>knocked out</b>.', 'ko');
  checkOver();
}
function checkOver(){
  var a = living(0).length, b = living(1).length;
  if(a && b) return;
  G.over = true; G.winner = a ? 0 : b ? 1 : -1;
  G.cur = null;
  log(G.winner<0 ? 'Both teams are knocked out. It&rsquo;s a draw.' : pn(G.winner)+' '+(pname(G.winner)==='You'?'win':'wins')+'!', 'win');
  gameEnded();
  throw ABORT_OVER;
}
/* A signed-in player who wins against the CPU or online earns a pack (the server caps it at five a day). */
function gameEnded(){
  if(CFG.mode==='online') NET.finished = true;
  var me = CFG.mode==='online' ? CFG.me : 0;
  if(!ACC || !ACC.user || G.winner!==me || !(CFG.mode==='cpu' || CFG.mode==='online')) return;
  var g = G;
  ACC.recordWin().then(function(got){ if(g===G){ G.reward = got ? 'pack' : 'capped'; render(); } });
}
function strikeTargets(u){ return foes(u); }
/* "Skip": an untapped character is tapped now (loses this round's action); an already-tapped one stays tapped next round. */
function stun(e){ if(!e.acted) e.acted = true; else e.skip = 1; }
/* Run one of a character's three attacks against a target: damage, then its effect (if any). */
async function performAttack(u, e, mv){
  var dmg = moveDamage(u, mv);
  fxc('u'+u.id, 'lunge', 450);
  log(nm(u)+' uses '+card(mv.n)+' on '+nm(e)+'.');
  if(mv.fx==='unshield' && e.shield){ e.shield = false; log(nm(e)+'&rsquo;s Shield is stripped.'); }
  await damage(e, dmg);
  if(mv.fx==='heal') heal(u, Math.round(dmg*0.5));
  else if(mv.fx==='shield'){ u.shield = true; log(nm(u)+' raises a Shield.'); }
  else if(mv.fx==='stun' && !e.ko){ stun(e); log(nm(e)+' will miss its next turn.'); }
  else if(mv.fx==='draw') drawCard(u.team, true);
  else if(mv.fx==='recoil'){ var r = Math.round(dmg*0.35); if(r>0) await damage(u, r); }
}
function hitScore(dmg, e){ return (e.shield?-8:0) + (e.hp<=dmg?40+effAtk(e):0) + effAtk(e)*1.5 - e.hp*0.4; }
function pickFoe(u, prompt, dmg){ return pickUnit(u.team, prompt, foes(u), function(e){ return hitScore(dmg, e); }, true); }
function pickFriend(t, prompt, list, ai){ return pickUnit(t, prompt, list, ai, true); }

/* ---------------- action cards ---------------- */
function cardOpt(c){ return {label:c.n, sub:ACTD[c.n].a, act:c.n}; }
var ACT = {
 'CAT':{
  can:function(t){ return living(1-t).length>0; },
  ai:function(t){ return living(1-t).some(function(e){ return e.hp<=3 && !e.shield; }) ? 8 : 3.5; },
  run:async function(t){
   var e = await pickUnit(t, 'CAT: deal 3 damage to whom?', living(1-t), function(e){ return hitScore(3, e); }, true);
   if(!e) return false;
   log(pn(t)+' plays '+card('CAT')+' on '+nm(e)+'.');
   await damage(e, 3); return true;
  }},
 'Canteen':{
  can:function(t){ return living(t).some(function(f){ return f.hp<f.max; }); },
  ai:function(t){ return Math.min(6, maxMissing(t)) - 0.5; },
  run:async function(t){
   var f = await pickFriend(t, 'Canteen: heal whom 6 HP?', living(t).filter(function(f){ return f.hp<f.max; }), function(f){ return f.max-f.hp; });
   if(!f) return false;
   log(pn(t)+' plays '+card('Canteen')+' on '+nm(f)+'.');
   heal(f, 6); return true;
  }},
 'Excursion':{
  can:function(t){ return living(t).length>0; },
  ai:function(){ return 3.5; },
  run:async function(t){
   var f = await pickFriend(t, 'Excursion: who gets +2 ATK?', living(t), function(f){ return effAtk(f)+f.hp*0.1; });
   if(!f) return false;
   f.atkGame += 2;
   log(pn(t)+' plays '+card('Excursion')+': '+nm(f)+' gets +2 ATK.'); return true;
  }},
 'DLC':{
  can:function(t){ return living(t).some(function(f){ return !f.shield; }); },
  ai:function(t){ var l = living(t).filter(function(f){ return !f.shield; }); return Math.min.apply(null, l.map(function(f){ return f.hp; }))<=8 ? 5 : 1.5; },
  run:async function(t){
   var f = await pickFriend(t, 'DLC: who gets a Shield?', living(t).filter(function(f){ return !f.shield; }), function(f){ return -f.hp; });
   if(!f) return false;
   f.shield = true;
   log(pn(t)+' plays '+card('DLC')+': '+nm(f)+' gets a Shield.'); return true;
  }},
 'Detention':{
  can:function(t){ return living(1-t).length>0; },
  ai:function(t){ return living(1-t).some(function(e){ return !e.acted && !e.skip; }) ? 3 : 1.5; },
  run:async function(t){
   var e = await pickUnit(t, 'Detention: who skips their next turn?', living(1-t), function(e){ return effAtk(e)*2+(e.acted?0:3)-(e.skip?30:0); }, true);
   if(!e) return false;
   stun(e);
   log(pn(t)+' plays '+card('Detention')+': '+nm(e)+' skips its next turn.'); return true;
  }},
 /* ---- pack action cards ---- */
 'Reports':{
  can:function(t){ return G.hands[1-t].length>0; },
  ai:function(t){ return 2 + G.hands[1-t].length*0.6; },
  run:async function(t){
   var h = G.hands[1-t];
   var i = await pickOpt(t, 'Reports: which card does '+pname(1-t)+' discard?', h.map(cardOpt), function(o){ return ACT[o.act].ai(1-t); }, true);
   if(i<0) return false;
   var c = h.splice(i,1)[0];
   G.discards[1-t].push(c);
   log(pn(t)+' plays '+card('Reports')+': '+pn(1-t)+' discards '+card(c.n)+'.'); return true;
  }},
 'Photo Day':{
  can:function(t){ var l = G.lastCard; return !!l && l!=='Photo Day' && ACT[l].can(t); },
  ai:function(t){ return G.lastCard ? ACT[G.lastCard].ai(t) - 0.5 : 0; },
  run:async function(t){
   var l = G.lastCard;
   log(pn(t)+' plays '+card('Photo Day')+', copying '+card(l)+'.');
   return ACT[l].run(t);
  }},
 'Uniform Check':{
  can:function(t){ return living(1-t).some(function(e){ return e.atkGame>0; }); },
  ai:function(t){ return Math.max.apply(null, living(1-t).map(function(e){ return e.atkGame; }))*1.5; },
  run:async function(t){
   var e = await pickUnit(t, 'Uniform Check: remove whose ATK boosts?', living(1-t).filter(function(e){ return e.atkGame>0; }), function(e){ return e.atkGame; }, true);
   if(!e) return false;
   e.atkGame = 0;
   log(pn(t)+' plays '+card('Uniform Check')+': '+nm(e)+' loses its ATK boosts.'); return true;
  }},
 'Assembly':{
  can:function(t){ return living(t).some(function(f){ return f.hp<f.max; }); },
  ai:function(t){ return living(t).filter(function(f){ return f.hp<f.max; }).length*1.2; },
  run:async function(t){ log(pn(t)+' plays '+card('Assembly')+': the whole team heals 2.'); living(t).forEach(function(f){ heal(f, 2); }); return true; }},
 'Low Tide':{
  can:function(t){ return living(1-t).length>0; },
  ai:function(t){ return ready(1-t).length*1.4; },
  run:async function(t){
   living(1-t).forEach(function(e){ e.atkRound -= 2; });
   log(pn(t)+' plays '+card('Low Tide')+': every enemy has &minus;2 ATK this round.'); return true;
  }}
};
async function playCard(t, i, u){
  var c = G.hands[t][i];
  G.hands[t].splice(i,1);
  if(await ACT[c.n].run(t,u)===false){ G.hands[t].splice(i,0,c); render(); return false; }
  G.discards[t].push(c);
  if(c.n!=='Photo Day') G.lastCard = c.n;
  render(); return true;
}
function canPlayCards(u){ return !G.cardPlayed && !u.ko; }
function playable(t, c, u){ return ACT[c.n].can(t, u); }
/* Each player draws from their own action deck; the discard is reshuffled when it runs out. */
function drawCard(t, force){
  if(!force && G.hands[t].length>=HAND_LIMIT) return;
  if(!G.decks[t].length && G.discards[t].length){ G.decks[t] = shuffle(G.discards[t]); G.discards[t] = []; log(possessive(t)+' discard pile is shuffled into a new deck.'); }
  if(!G.decks[t].length) return;
  var c = G.decks[t].pop();
  G.hands[t].push(c); fxc('c'+c.uid, 'drawn', 650);
  render();
}

/* ---------------- turns ----------------
   Players alternate. On your turn you choose one of your ready (untapped) characters, then choose
   one of its three attacks and a target, then it taps. You may also play one action card per turn.
   When every character has acted, a new round starts and everyone untaps. */
function ready(t){ return living(t).filter(function(u){ return !u.acted; }); }
function act(u){ u.acted = true; reveal(u); }

async function humanTurn(t){
  while(true){
    if(G.over) return;
    var cardsOk = !G.cardPlayed && G.hands[t].some(function(c){ return playable(t,c,G.cur); });
    if(G.acted && !cardsOk) return;
    var cmd = await wait('cmd', {team:t});
    var u = G.cur;
    if(cmd.t==='end'){ if(G.acted) return; continue; }
    if(cmd.t==='atk' && u && !G.acted){
      var mv = u.c.atks[cmd.i], dmg = moveDamage(u, mv);
      var e = await pickFoe(u, 'Attack with '+mv.n+' ('+dmg+' damage): tap an enemy', dmg);
      if(!e) continue;
      G.acted = true; act(u); await performAttack(u, e, mv);
    } else if(cmd.t==='card' && cardsOk && playable(t, G.hands[t][cmd.i], u)){
      if(await playCard(t, cmd.i, u)) G.cardPlayed = true;
    }
  }
}
async function cpuCard(t, threshold){
  if(G.cardPlayed) return;
  var bi = -1, bs = threshold;
  G.hands[t].forEach(function(c,i){
    if(!playable(t,c,G.cur)) return;
    var s = ACT[c.n].ai(t,G.cur) + rand()*0.6;
    if(s>bs){ bs=s; bi=i; }
  });
  if(bi<0) return;
  await sleep(450);
  if(await playCard(t, bi, G.cur)) G.cardPlayed = true;
}
/* fx bonus nudges the CPU toward useful effects (healing when hurt, shielding, etc.) without over-thinking it. */
function fxBonus(u, mv, e){
  switch(mv.fx){
    case 'heal': return u.hp<u.max ? 3 : -2;
    case 'shield': return u.shield ? -2 : 2;
    case 'stun': return e.skip || e.ko ? -2 : 2;
    case 'unshield': return e.shield ? 3 : -1;
    case 'draw': return G.hands[u.team].length<HAND_LIMIT ? 1.5 : -1;
    case 'recoil': return -1;
    default: return 0;
  }
}
function movePlan(u){
  var top = null;
  u.c.atks.forEach(function(mv, i){
    var dmg = moveDamage(u, mv), foe = best(foes(u), function(e){ return hitScore(dmg, e)+fxBonus(u,mv,e); });
    var score = hitScore(dmg, foe) + fxBonus(u, mv, foe);
    if(!top || score>top.score) top = {i:i, mv:mv, foe:foe, score:score};
  });
  return top;
}
function cpuPlan(u){ var mp = movePlan(u); return {u:u, mv:mp, score:mp.score+rand()*1.5}; }
async function cpuTurn(t){
  await sleep(650);
  await cpuCard(t, 3);
  var list = ready(t);
  if(list.length && !G.over){
    var plan = list.map(cpuPlan).sort(function(a,b){ return b.score-a.score; })[0], u = plan.u;
    G.cur = u; act(u); G.acted = true; render();
    await sleep(500);
    await performAttack(u, plan.mv.foe, plan.mv.mv);
  }
  await cpuCard(t, 2.6);
}
async function passScreen(t){
  if(CFG.mode!=='hot' || G.lastHuman===t) return;
  G.lastHuman = t;
  await wait('pass', {team:t});
}
async function takeTurn(t){
  G.turnOf=t; G.cur=null; G.acted=false; G.cardPlayed=false; G.sel=null;
  if(!isCPU(t)) await passScreen(t);
  checkInt();
  log(possessive(t)+' turn.', 'turn');
  drawCard(t);
  if(isCPU(t)) await cpuTurn(t); else await humanTurn(t);
  if(G.cur && !G.cur.ko) fxc('u'+G.cur.id, 'tapanim', 450);
  G.cur = null;
}
function startRound(){
  G.round++;
  allUnits().forEach(function(u){
    if(u.ko) return;
    u.atkRound = 0;
    if(u.skip){ u.skip = 0; u.acted = true; log(nm(u)+' misses this round.'); return; }
    if(u.acted) fxc('u'+u.id, 'untap', 450);
    u.acted = false;
  });
  log('Round '+G.round+' &mdash; everyone untaps.', 'round');
}
async function gameLoop(){
  var g = G;
  try{
    G.turnOf = G.first!=null ? G.first : rand()<0.5 ? 0 : 1;
    log(pn(G.turnOf)+' '+(pname(G.turnOf)==='You'?'go':'goes')+' first.');
    var next = G.turnOf;
    while(true){
      startRound();
      await delay(250);
      while(ready(0).length || ready(1).length){
        var t = ready(next).length ? next : 1-next;
        await takeTurn(t);
        next = 1-t;
      }
      if(G.round>=99){ G.over=true; G.winner=-1; log('Ninety-nine rounds. Everyone goes home.', 'win'); gameEnded(); throw ABORT_OVER; }
    }
  } catch(e){
    if(e===ABORT_DEAD || g!==G) return;
    if(e===ABORT_OVER){ G.cur=null; render(); return; }
    if(typeof console!=='undefined') console.error(e);
    G.error = String(e && e.stack || e); render();
  }
}

/* ---------------- setup: shuffle & deal ---------------- */
function startGame(){
  G = {phase:'deal', log:[], fx:[], uid:0, zoom:null,
       charDeck:shuffle(BASE_CHARS.slice()),
       deal:{turn:0, picks:[[],[]], shown:[{},{}], mull:[1,1], pass:CFG.mode==='hot'}};
  for(var t=0;t<2;t++) dealTeam(t);
  if(CFG.mode==='sim') return beginBattle();
  render();
}
function dealTeam(t){
  var d = G.deal;
  d.picks[t] = G.charDeck.splice(0, CFG.size);
  d.shown[t] = {};
  d.picks[t].forEach(function(_,i){ fxc('d'+t+'_'+i, 'dealt', 650, i*160 + (t===d.turn?0:500)); });
}
function mulligan(){
  var d = G.deal, t = d.turn;
  if(d.mull[t]<1) return;
  d.mull[t]--;
  G.charDeck = shuffle(G.charDeck.concat(d.picks[t]));
  dealTeam(t);
  G.zoom = null;
  render();
}
function flipDealt(i){
  var d = G.deal, t = d.turn;
  if(d.shown[t][i]) { G.zoom = {k:'ci', ci:d.picks[t][i]}; G.zoomOpen = true; render(); return; }
  d.shown[t][i] = true;
  fxc('d'+t+'_'+i, 'flip', 700);
  G.zoom = {k:'ci', ci:d.picks[t][i]};
  render();
}
function revealAll(){
  var d = G.deal, t = d.turn;
  d.picks[t].forEach(function(_,i){ if(!d.shown[t][i]){ d.shown[t][i]=true; fxc('d'+t+'_'+i, 'flip', 700, i*120); } });
  render();
}
function dealDone(){
  var d = G.deal;
  if(CFG.mode==='hot' && d.turn===0){ d.turn = 1; d.pass = true; G.zoom = null; render(); return; }
  beginBattle();
}
/* The printed base action deck (16 cards), used by anyone not bringing a saved deck. */
function baseActions(){ var l = []; acts.forEach(function(a){ for(var k=0;k<a.x;k++) l.push(a.n); }); return l; }
/* setup: {teams:[[charIndex..],[..]], foils:[[bool..],[..]], actions:[[cardName..]|null, ..]}. Defaults to the deal. */
function beginBattle(setup){
  setup = setup || {teams:G.deal.picks};
  G.phase='battle'; G.round=0; G.over=false; G.winner=null; G.zoom=null; G.sel=null;
  G.teams = setup.teams.map(function(p,t){ return p.map(function(ci,i){ return newUnit(ci, t, setup.foils && setup.foils[t] && setup.foils[t][i]); }); });
  var uid = 0;
  G.decks = [0,1].map(function(t){
    var names = (setup.actions && setup.actions[t]) || baseActions();
    return shuffle(names.map(function(n){ return {uid:uid++, n:n}; }));
  });
  G.discards=[[],[]]; G.hands=[[],[]]; G.lastHuman=null; G.lastCard=null;
  for(var k=0;k<2;k++){ for(var t=0;t<2;t++){ var c=G.decks[t].pop(); if(!c) continue; G.hands[t].push(c); fxc('c'+c.uid, 'drawn', 650, k*200); } }
  log('The specimens take the field, face-down. Each is revealed when it first acts.');
  gameLoop();
}
/* Start straight into battle with known teams (saved decks, online games). A seed makes the game reproducible. */
function startWithTeams(setup, seed, first){
  G = {phase:'battle', log:[], fx:[], uid:0, zoom:null};
  if(seed!=null) G.rng = seeded(seed);
  G.first = first;
  beginBattle(setup);
}
/* Turn a saved deck plus the chosen character ids into one team's setup. */
function deckTeam(deck, ids){
  return {chars:ids.map(function(id){ return CHARID[id]; }),
          foils:ids.map(function(id){ return (deck.foils||[]).indexOf(id)>=0; }),
          actions:deck.actions.map(function(id){ return ACTID[id].n; })};
}
function randomTeam(n, exclude){
  var pool = shuffle(BASE_CHARS.filter(function(i){ return (exclude||[]).indexOf(i)<0; }));
  return {chars:pool.slice(0, n), foils:[], actions:null};
}

/* ---------------- card faces ---------------- */
var COLOR = {
  'doctor-knox':'blue','seal-whisperer-knox':'blue','field-researcher-knox':'blue','elephant-seal-knox':'blue',
  'director-knox':'white','chaperone-knox':'white','staff-meeting-knox':'white','parent-teacher-knox':'white',
  'blue-suit-knox':'black','leopard-seal-knox':'black','emeritus-knox':'black',
  'family-man-knox':'red','mixtape-knox':'red','fire-drill-knox':'red',
  'beer-frog-knox':'green','tadpole-knox':'green',
  'harbour-seal-knox':'blue','swimming-carnival-knox':'green','sports-carnival-knox':'red',
  'conference-knox':'white','yard-duty-knox':'white','socs-got-talent-knox':'black'
};
var root = null;
function art(k){ return (S[k]||'').replace(/#(0B2545|5F8F35|1D4E89)/g, 'currentColor'); }
function charFace(c, o){
  o = o || {};
  var col = COLOR[c.id] || 'blue';
  var moves = c.atks.map(function(mv){
    return '<p class="mv"><b>'+mv.n+'</b><span class="mvdmg" title="Damage">'+mv.dmg+'</span><br><span class="fl">'+mv.a+'</span></p>';
  }).join('');
  return '<div class="face f-'+col+(o.foil?' foil':'')+'">'
   +(c.set!=='base' ? '<span class="setmark" title="Pack card">&#10022;</span>' : '')
   +'<div class="tl"><span class="tn">'+c.n+'</span></div>'
   +'<div class="art a-'+col+'">'+art(c.i)+'</div>'
   +(o.bar||'')
   +'<div class="ty">Specimen &mdash; '+c.r+'</div>'
   +'<div class="tx">'+moves+'</div>'
   +'<div class="gem hp'+(o.hpCls||'')+'" title="HP &mdash; health. Knocked out at 0.">HP<b>'+(o.hp!=null?o.hp:c.hp)+'</b></div>'
   +'</div>';
}
function actFace(n){
  var a = ACTD[n];
  return '<div class="face f-gold">'
   +'<div class="tl"><span class="tn">'+n+'</span><span class="actiontag" title="This is an action card, not a character">ACTION</span></div>'
   +'<div class="art a-gold">'+art(a.i)+'</div>'
   +'<div class="ty">Action Card</div>'
   +'<div class="tx"><p>'+a.a+'</p><p class="fl">One action card per turn.</p></div>'
   +'</div>';
}
function backFace(){
  return '<div class="back"><div class="pips"><i class="pw"></i><i class="pu"></i><i class="pb"></i><i class="pr"></i><i class="pg"></i></div>'
   +'<div class="oval">'+art('seal')+'</div><div class="bw">Travis</div></div>';
}

/* ---------------- rendering ---------------- */
function chips(u){
  var c = [];
  if(u.ko) return '';
  if(u.shield) c.push(['Shield','g']);
  if(u.atkGame>0) c.push(['+'+u.atkGame+' ATK','b']);
  if(u.atkGame<0) c.push(['&minus;'+(-u.atkGame)+' ATK','r']);
  if(u.atkRound<0) c.push(['&minus;'+(-u.atkRound)+' ATK this round','r']);
  if(u.skip>0) c.push(['Skips turn','r']);
  return c.map(function(x){ return '<span class="chip '+x[1]+'">'+x[0]+'</span>'; }).join('');
}
function isZoom(k, v){ return G.zoom && G.zoom.k===k && (G.zoom.id===v || G.zoom.uid===v || G.zoom.ci===v); }
function myTurn(){ var w = G.wait; return !!(w && w.kind==='cmd' && G.turnOf===viewer() && !isCPU(G.turnOf)); }
function selectable(u){ return myTurn() && !G.acted && u.team===G.turnOf && !u.ko && !u.acted; }
function unitCard(u){
  var w = G.wait, pick = w && w.kind==='unit' && w.ids.indexOf(u.id)>=0;
  var dim = w && w.kind==='unit' && !pick;
  var hid = hidden(u), f = fxFor('u'+u.id), body;
  var cls = 'card mini unit t'+u.team+(u.ko?' ko':'')+(G.cur===u?' cur':'')+(pick?' pick':'')+(dim?' dim':'')
    +(selectable(u) && G.cur!==u ? ' ready' : '')
    +(u.acted && !u.ko && G.cur!==u ? ' tapped' : '')+(isZoom('u',u.id)?' zoomed':'')+f.cls;
  if(hid){
    var dmg = u.max-u.hp;
    body = backFace() + (dmg>0 && !u.ko ? '<span class="dmgb">&minus;'+dmg+'</span>' : '');
  } else {
    var pct = Math.max(0, Math.min(100, u.hp/u.max*100));
    body = charFace(u.c, {foil:u.foil, hp:u.hp, hpCls:u.hp<u.max?' hurt':'', bar:'<div class="hpb"><i style="width:'+pct+'%"></i></div>'});
  }
  return '<button class="'+cls+'" style="'+f.style+'" data-a="unit" data-v="'+u.id+'" aria-label="'+(hid?'Face-down card':u.c.n)+'">'
   + body + '<div class="chips">'+chips(u)+'</div>' + (u.ko ? '<div class="kotag">Knocked out</div>' : '')
   + '<span class="info" data-a="info" data-v="'+u.id+'" aria-label="Card details">i</span>' + f.fl + '</button>';
}
function handTeam(){
  if(CFG.mode==='online') return CFG.me;
  if(CFG.mode!=='hot') return 0;
  if(G.turnOf!=null && !isCPU(G.turnOf)) return G.turnOf;
  return G.lastHuman==null ? 0 : G.lastHuman;
}
function canPlayNow(c){ return myTurn() && !G.cardPlayed && playable(viewer(), c, G.cur); }
function fanStyle(i, n, spread){
  var off = i-(n-1)/2;
  return '--r:'+(off*spread)+'deg;--y:'+(Math.abs(off)*Math.abs(off)*4)+'px;z-index:'+(i+1);
}
function handHtml(t){
  var h = G.hands[t];
  if(!h.length) return '<div class="hand empty"><span>No cards in hand</span></div>';
  return '<div class="hand">'+h.map(function(c,i){
    var f = fxFor('c'+c.uid), ok = canPlayNow(c);
    return '<button class="card hc'+(ok?' ok':'')+(G.sel===c.uid?' sel':'')+f.cls+'" style="'+fanStyle(i,h.length,6)+';'+f.style+'" data-a="hand" data-v="'+c.uid+'" aria-label="'+c.n+'">'
      +actFace(c.n)+'<span class="info" data-a="cinfo" data-v="'+c.uid+'" aria-label="Card details">i</span></button>';
  }).join('')+'</div>';
}
function oppHand(t){
  var n = G.hands[t].length;
  var backs = ''; for(var i=0;i<n;i++) backs += '<div class="card ob" style="'+fanStyle(i,n,9)+'">'+backFace()+'</div>';
  return '<div class="ohand" title="'+n+' cards in hand">'+backs+'<span class="ocount">'+n+'</span></div>';
}
function plate(t, side){
  var alive = living(t).length, act = G.turnOf===t && !G.over;
  return '<div class="plate '+side+' t'+t+(act?' active':'')+'"><span class="av">'+art(t?'lseal':'seal')+'</span>'
   +'<span class="pinfo"><b>'+pname(t)+(act?' &middot; <em>'+(pname(t)==='You'?'your':'their')+' turn</em>':'')+'</b><small>'+alive+' of '+G.teams[t].length+' standing &middot; '+ready(t).length+' ready</small></span>'
   + (side==='top' ? oppHand(t) : '') + '</div>';
}
function statusLine(){
  var w = G.wait;
  if(G.over) return G.winner<0 ? 'A draw.' : pname(G.winner)+(pname(G.winner)==='You'?' win!':' wins!');
  if(w && w.kind==='remote') return '<span class="who t'+w.team+'">'+pname(w.team)+'</span> is choosing <span class="muted">&hellip;</span>';
  if(w && w.kind==='unit') return '<span class="who t'+w.team+'">'+pname(w.team)+':</span> '+w.prompt+(w.cancel?' <button class="lnk" data-a="cancel">Cancel</button>':'');
  if(myTurn()){
    var u = G.cur, cards = !G.cardPlayed && G.hands[G.turnOf].some(function(c){ return canPlayNow(c); });
    if(G.acted) return 'Done! '+(cards?'Play a card, or tap ':'Tap ')+'<b>End Turn</b>.';
    if(!u) return '<b>Your turn.</b> Tap one of your <b>glowing characters</b> to choose who acts.'+(cards?' Or tap a card in your hand to play it.':'');
    return nm(u)+' is chosen. <b>Choose an attack</b> below.';
  }
  if(G.turnOf!=null && isCPU(G.turnOf)) return (G.cur ? nm(G.cur)+' acts' : pname(G.turnOf)+' is choosing')+' <span class="muted">&hellip;</span>';
  return '&nbsp;';
}
function pile(kind){
  if(kind==='deck'){
    var n = G.decks[viewer()].length;
    return '<div class="pile deck'+(n?'':' gone')+'" title="Action deck"><div class="card">'+backFace()+'</div><span class="pc">'+n+'</span><small>Deck</small></div>';
  }
  var dp = G.discards[viewer()], top = dp[dp.length-1];
  return '<div class="pile disc" title="Your discard pile">'+(top ? '<div class="card">'+actFace(top.n)+'</div>' : '<div class="slot"></div>')+'<span class="pc">'+dp.length+'</span><small>Discard</small></div>';
}
function actionBar(){
  if(!myTurn()) return '<div class="actions idle"></div>';
  var u = G.cur;
  if(G.acted) return '<div class="actions"><button class="btn end" data-a="cmd" data-v="end"><b>End Turn</b></button></div>';
  if(!u) return '<div class="actions idle"></div>';
  return '<div class="actions">'
   + u.c.atks.map(function(mv, i){
       return '<button class="btn act" data-a="cmd" data-v="atk" data-i="'+i+'"><i>&#9876;</i><b>'+mv.n+'</b><small>'+moveDamage(u,mv)+' damage'+(mv.fx?' &middot; '+FX_SHORT[mv.fx]:'')+'</small></button>';
     }).join('')
   +'</div>';
}
var FX_SHORT = {heal:'heals self', shield:'self Shield', stun:'stuns target', unshield:'strips Shield', draw:'draws a card', recoil:'self recoil'};
/* Buttons shown under an inspected card, so every action is reachable from the details view too. */
function unitActions(u){
  var btn = '', cap = '';
  if(selectable(u)){
    btn += '<button class="btn gold" data-a="select" data-v="'+u.id+'">&#9876; Choose '+u.c.n+' to act</button>';
  } else if(myTurn() && u.team===G.turnOf && u.acted && !u.ko){
    cap = 'This character already acted this round.';
  }
  return {btn:btn, cap:cap};
}
/* While choosing a target, keep the prompt pinned to the screen (on phones the board is taller than the viewport). */
function pickBar(){
  var w = G.wait;
  if(!(w && w.kind==='unit' && !isCPU(w.team))) return '';
  return '<div class="pickbar t'+w.team+'"><span>&#128073; '+w.prompt+'</span>'+(w.cancel?'<button class="btn sm" data-a="cancel">Cancel</button>':'')+'</div>';
}
function cardReason(c){
  if(!myTurn()) return 'Wait for your turn.';
  if(G.cardPlayed) return 'You already played a card this turn. One card per turn.';
  if(c.n==='Canteen') return 'Everyone on your team is at full health, so there&rsquo;s nobody to heal yet.';
  if(c.n==='DLC') return 'Everyone on your team already has a Shield.';
  if(c.n==='Photo Day') return 'Nothing to copy yet. Photo Day copies the last action card played.';
  if(c.n==='Reports') return 'Your opponent has no cards in hand.';
  if(c.n==='Uniform Check') return 'No enemy has an ATK boost to remove.';
  if(c.n==='Assembly') return 'Everyone on your team is at full health.';
  return 'There&rsquo;s no valid target for this card right now.';
}
function zoomBlock(){
  var z = G.zoom, html = '', cap = '', btn = '';
  if(z && z.k==='u'){
    var u = unitById(z.id);
    if(u && hidden(u)){ html = '<div class="card big">'+backFace()+'</div>'; cap = 'Face-down. Revealed when it first acts.'; }
    else if(u){
      html = '<div class="card big'+(u.ko?' ko':'')+'">'+charFace(u.c, {foil:u.foil, hp:u.hp, hpCls:u.hp<u.max?' hurt':''})+'</div>';
      cap = pname(u.team)+' &middot; HP '+u.hp+'/'+u.max+(u.ko?' &middot; knocked out':'');
    }
    if(u){ var ua = unitActions(u); btn = ua.btn; if(ua.cap) cap = ua.cap; }
  } else if(z && z.k==='c'){
    var c = G.hands[viewer()].filter(function(c){ return c.uid===z.uid; })[0];
    if(c){
      html = '<div class="card big">'+actFace(c.n)+'</div>';
      btn = canPlayNow(c) ? '<button class="btn gold big" data-a="play" data-v="'+c.uid+'">Play this card</button>'
                          : '<button class="btn big" disabled>Can&rsquo;t play right now</button>';
      cap = canPlayNow(c) ? '' : '<span class="why">'+cardReason(c)+'</span>';
    }
  } else if(z && z.k==='ci'){
    html = '<div class="card big">'+charFace(chars[z.ci], {foil:z.foil})+'</div>';
  } else if(z && z.k==='an'){
    html = '<div class="card big">'+actFace(z.n)+'</div>';
  }
  if(!html) return '<div class="zoom empty"><div class="card big ghost">'+backFace()+'</div><p class="cap">Tap the &#9432; on any card to read it.</p></div>';
  return '<div class="zoom">'+html+(cap?'<p class="cap">'+cap+'</p>':'')+btn+'</div>';
}
function orderHtml(){
  var items = ready(0).concat(ready(1));
  return items.map(function(u){
    return '<li class="t'+u.team+(u===G.cur?' now':'')+'"><span>'+(hidden(u)?'Face-down card':u.c.n)+'</span><b>'+pname(u.team)+'</b></li>';
  }).join('') || '<li class="muted">Everyone has acted</li>';
}
function overlays(){
  var w = G.wait, o = '';
  if(w && w.kind==='pass'){
    o += '<div class="ov solid"><div class="panel pass"><div class="eyebrow">Pass the device</div><h2 class="t'+w.team+'">'+pname(w.team)+'</h2><p>Your turn. Nobody else looks.</p><button class="btn gold big" data-a="pass">Show my cards</button></div></div>';
  } else if(w && w.kind==='opt'){
    var cards = w.opts.some(function(x){ return x.act; });
    o += '<div class="ov"><div class="panel"><div class="eyebrow t'+w.team+'">'+pname(w.team)+'</div><h2>'+w.prompt+'</h2><div class="opts'+(cards?' cardopts':'')+'">'
      + w.opts.map(function(x,i){
          return x.act ? '<button class="card optc" data-a="opt" data-v="'+i+'" aria-label="'+x.label+'">'+actFace(x.act)+'</button>'
                       : '<button class="optb" data-a="opt" data-v="'+i+'"><b>'+x.label+'</b><span>'+x.sub+'</span></button>';
        }).join('')
      + '</div>'+(w.cancel?'<button class="lnk" data-a="cancel">Cancel</button>':'')+'</div></div>';
  } else if(G.over && !G.hideOver){
    var me = CFG.mode==='online' ? CFG.me : 0, you = CFG.mode==='cpu' || CFG.mode==='online', title, sub;
    if(G.winner<0){ title='Stalemate'; sub='Nobody claims the grant.'; }
    else if(you){ title = G.winner===me ? 'Victory' : 'Defeat'; sub = G.winner===me ? 'The grant is yours.' : pname(G.winner)+' takes the grant.'; }
    else { title = pname(G.winner)+' Wins'; sub = 'The grant is theirs.'; }
    var reward = G.reward==='pack' ? '<p class="reward">&#10022; You earned a pack! Open it from the menu.</p>'
               : G.reward==='capped' ? '<p class="reward dim">You&rsquo;ve had today&rsquo;s five packs from wins. More tomorrow.</p>' : '';
    var again = CFG.mode==='online' ? '<button class="btn gold big" data-a="lobby">Back to the lobby</button>' : '<button class="btn gold big" data-a="start">Shuffle Up Again</button>';
    o += '<div class="ov soft"><div class="panel over'+(you&&G.winner>=0&&G.winner!==me?' lose':'')+'"><div class="eyebrow">Round '+G.round+'</div><h2 class="vt">'+title+'</h2><p>'+sub+'</p>'+reward
      +'<div class="row">'+again+'<button class="lnk" data-a="close">View board</button><button class="lnk" data-a="menu">Menu</button></div></div></div>';
  } else if(G.oppGone && !G.over){
    o += '<div class="ov soft"><div class="panel"><div class="eyebrow">Connection</div><h2>'+pname(1-CFG.me)+' left the game</h2><p>The match can&rsquo;t continue. No result is recorded.</p>'
      +'<div class="row"><button class="btn gold" data-a="lobby">Back to the lobby</button><button class="lnk" data-a="menu">Menu</button></div></div></div>';
  }
  if(G.zoomOpen && !o) o += '<div class="ov zoomov" data-a="unzoom">'+zoomBlock()+'</div>';
  return o;
}
function rulesHtml(){
  if(!G.showRules) return '';
  return '<div class="ov" data-a="rulesoff"><div class="panel rules" data-a="noop"><div class="eyebrow">How to play</div><h2>Travis: The Game</h2><ol>'
   +'<li><b>Goal:</b> knock out every one of your opponent&rsquo;s characters.</li>'
   +'<li><b>The deal:</b> each player gets '+CFG.size+' random characters, face-down. Flip yours over. Enemy cards flip when they take their first turn.</li>'
   +'<li><b>Taking turns:</b> players go back and forth. On your turn, <b>tap one of your glowing characters</b> to choose it. Each character can act once per round; after it acts it turns sideways. When everyone has acted, a new round starts.</li>'
   +'<li><b>Your chosen character attacks:</b> every character has three attacks to pick from &mdash; a light Jab, a named signature move (often with an extra effect), and a heavy Overdrive that costs it some of its own HP. Pick one, then tap an enemy.</li>'
   +'<li><b>Action cards:</b> you draw one each turn (you can hold 3). Tap one in your hand to play it &mdash; one per turn, as well as attacking.</li>'
   +'<li><b>Health:</b> the green <b>HP</b> circle on the card. At 0, that character is knocked out.</li></ol>'
   +'<p class="kw"><b>Shield</b> blocks all damage from the next hit. <b>Skip</b> means that character misses its next chance to act. Tap the &#9432; on any card to read it.</p>'
   +'<button class="btn gold" data-a="rulesoff">Got it</button></div></div>';
}
function topbar(extra){
  return '<header class="bar"><div class="brand">Travis <span>The Game</span></div><div class="meta">'+(extra||'')+'</div>'
   +'<div class="btns"><button class="btn sm" data-a="rules">How to play</button><button class="btn sm" data-a="menu">Menu</button></div></header>';
}
function renderBattle(){
  var me = viewer(), op = 1-me;
  return topbar('Round <b>'+G.round+'</b>')
   +'<div class="table"><div class="mat">'
   + plate(op,'top')
   +'<div class="zone top n'+CFG.size+'">'+G.teams[op].map(unitCard).join('')+'</div>'
   +'<div class="mid"><div class="prompt">'+statusLine()+'</div><div class="piles">'+pile('deck')+pile('disc')+'</div></div>'
   +'<div class="zone bottom n'+CFG.size+'">'+G.teams[me].map(unitCard).join('')+'</div>'
   + plate(me,'bottom')
   + actionBar()
   + handHtml(me)
   +'</div><aside class="rail">'
   + zoomBlock()
   +'<div class="side"><div class="sl">Still to act this round</div><ol class="order">'+orderHtml()+'</ol></div>'
   +'<div class="side"><div class="sl">Battle log</div><div class="log">'+G.log.map(function(l){ return '<p class="'+l.cls+'">'+l.h+'</p>'; }).join('')+'</div></div>'
   +'</aside></div>'
   +(G.error?'<pre class="err">'+G.error+'</pre>':'')
   + pickBar()
   + overlays();
}
function renderDeal(){
  var d = G.deal, me = d.turn, op = 1-me;
  var all = d.picks[me].every(function(_,i){ return d.shown[me][i]; });
  var mine = d.picks[me].map(function(ci,i){
    var f = fxFor('d'+me+'_'+i), up = d.shown[me][i];
    return '<button class="card deal'+(up?' up':' down')+f.cls+(isZoom('ci',ci)&&up?' zoomed':'')+'" style="'+f.style+'" data-a="flip" data-v="'+i+'" aria-label="'+(up?chars[ci].n:'Face-down card')+'">'+(up?charFace(chars[ci]):backFace())+'</button>';
  }).join('');
  var theirs = d.picks[op].map(function(_,i){ var f = fxFor('d'+op+'_'+i); return '<div class="card mini'+f.cls+'" style="'+f.style+'">'+backFace()+'</div>'; }).join('');
  var next = CFG.mode==='hot' && me===0 ? 'Done &mdash; pass to Player 2' : 'To battle &rarr;';
  var o = '';
  if(d.pass) o = '<div class="ov solid"><div class="panel pass"><div class="eyebrow">Pass the device</div><h2 class="t'+me+'">'+pname(me)+'</h2><p>Your specimens are dealt face-down. Nobody else looks.</p><button class="btn gold big" data-a="dealpass">Look at my cards</button></div></div>';
  else if(G.zoomOpen) o = '<div class="ov zoomov" data-a="unzoom">'+zoomBlock()+'</div>';
  return topbar('The Deal')
   +'<div class="table"><div class="mat dealmat">'
   +'<div class="plate top t'+op+'"><span class="av">'+art(op?'lseal':'seal')+'</span><span class="pinfo"><b>'+pname(op)+'</b><small>'+CFG.size+' face-down specimens</small></span></div>'
   +'<div class="zone top n'+CFG.size+'">'+theirs+'</div>'
   +'<div class="mid"><div class="prompt">'+(all ? 'This is your team. Keep it, or mulligan for a fresh hand.' : 'You&rsquo;ve been dealt '+CFG.size+' specimens. <b>Tap each card</b> to flip it over.')+'</div>'
   +'<div class="piles"><div class="pile deck"><div class="card">'+backFace()+'</div><span class="pc">'+G.charDeck.length+'</span><small>Specimens</small></div></div></div>'
   +'<div class="zone bottom dealzone n'+CFG.size+'">'+mine+'</div>'
   +'<div class="actions deal">'
   +(all ? '' : '<button class="btn" data-a="revealall">Reveal all</button>')
   +'<button class="btn"'+(d.mull[me]<1?' disabled':'')+' data-a="mull">Mulligan <small>('+d.mull[me]+' left)</small></button>'
   +'<button class="btn gold"'+(all?'':' disabled')+' data-a="dealdone">'+next+'</button></div>'
   +'</div><aside class="rail">'+zoomBlock()
   +'<div class="side"><div class="sl">Quick rules</div><ul class="how"><li>Players take turns. On your turn, tap one of your characters, then pick one of its <b>three attacks</b> and tap an enemy to hit it.</li><li>Each character acts once per round.</li><li>The green <b>HP</b> circle is health. Knock out all enemies to win.</li><li>Enemy cards stay face-down until they act.</li></ul><button class="btn sm" data-a="rules">Full rules</button></div>'
   +'</aside></div>' + o;
}
function renderMenu(){
  var on = function(k,v){ return String(CFG[k])===String(v) ? ' on' : ''; };
  var o = function(k,v,label,sub){ return '<button class="choice'+on(k,v)+'" data-a="cfg" data-k="'+k+'" data-v="'+v+'"><b>'+label+'</b><span>'+sub+'</span></button>'; };
  var hero = ['Beer Frog Knox','Blue Suit Knox','Doctor Knox','Leopard Seal Knox','Family Man Knox'].map(function(n,i){
    return '<div class="card hero" style="'+fanStyle(i,5,11)+'">'+charFace(chars[CHAR[n]])+'</div>';
  }).join('');
  var user = ACC && ACC.user && ACC.profile, decks = user ? ACC.decks : [];
  var deckGroup = '';
  if(user && CFG.mode!=='hot'){
    var dopt = function(v, label, sub){ return '<button class="choice'+(String(M.deckSel)===String(v)?' on':'')+'" data-a="deckpick" data-v="'+v+'"><b>'+esc(label)+'</b><span>'+sub+'</span></button>'; };
    deckGroup = '<div class="group"><div class="gl">Your team</div><div class="choices">'
      + dopt('random','Random deal','Base cards, shuffled')
      + decks.map(function(d){ return dopt(d.id, d.name, 'Saved deck'); }).join('')
      + '</div>'+(decks.length ? '' : '<p class="hint">Build a deck to bring your own cards. <button class="lnk" data-a="go" data-v="decks">Decks</button></p>')+'</div>';
  }
  var go = CFG.mode==='online' ? 'Play Online' : 'Shuffle Up &amp; Deal';
  return '<div class="menu"><div class="fan">'+hero+'</div>'
   +'<h1 class="logo"><span class="l1">Travis</span><span class="l2">The Game</span></h1>'
   +'<p class="tag">Specimens of Travis Knox. A shuffled deck. You never know who you&rsquo;ll get.</p>'
   + accountStrip()
   +'<div class="group"><div class="gl">Opponent</div><div class="choices">'
   + o('mode','cpu','Versus CPU','Battle the computer') + o('mode','hot','Two Players','Pass the device')
   + o('mode','online','Online','A colleague, live')
   +'</div></div>'
   + deckGroup
   +'<div class="group"><div class="gl">Format</div><div class="choices">'
   + o('size','6','6 v 6','Full squad') + o('size','4','4 v 4','Medium') + o('size','3','3 v 3','Quick game')
   +'</div>'+(CFG.mode==='online' ? '<p class="hint">Online, the player who creates the game sets the format.</p>' : '')+'</div>'
   + msgs()
   +'<button class="btn gold big" data-a="start">'+go+'</button>'
   +'<p class="foot"><button class="lnk" data-a="rules">How to play</button> <a href="index.html" target="_blank" rel="noopener">Printable deck</a></p>'
   +'</div>';
}

/* ================= accounts, packs, collection, decks, online ================= */
/* M holds screen state that survives G being replaced (forms, messages, the pack being revealed, the deck being edited). */
var M = {form:{}, err:'', note:'', busy:false, authMode:'in', deckSel:'random', reveal:null, edit:null};
try{ M.deckSel = localStorage.getItem('travis.deck') || 'random'; }catch(e){}
var L = {stage:'choose'};   // online lobby state

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
function field(name, label, type, auto){
  return '<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+(type||'text')+'" autocomplete="'+(auto||'off')+'" autocapitalize="off" spellcheck="false" value="'+esc(M.form[name]||'')+'"></label>';
}
function msgs(){ return (M.err ? '<p class="err-msg">'+M.err+'</p>' : '') + (M.note ? '<p class="ok-msg">'+M.note+'</p>' : ''); }
function goScreen(p){ NET.close(); M.err=''; M.note=''; G = {phase:p, log:[], fx:[]}; if(typeof window!=='undefined' && window.scrollTo) window.scrollTo(0,0); render(); }
function needAccount(){ if(ACC && ACC.user) return false; M.authMode='in'; goScreen('auth'); M.err='Sign in first.'; return true; }
function chosenDeck(){ return ACC && ACC.user ? ACC.decks.filter(function(d){ return d.id===M.deckSel; })[0] || null : null; }
async function busy(fn){
  if(M.busy) return;
  M.busy = true; M.err = ''; M.note = ''; render();
  try{ await fn(); }catch(e){ M.err = (e && e.message) || String(e); }
  M.busy = false; render();
}
function pageTop(title){ return topbar(title) + '<div class="pg">'; }

function accountStrip(){
  if(!ACC || !ACC.available) return '';
  if(!ACC.ready) return '<div class="acct"><span class="muted">Connecting&hellip;</span></div>';
  if(!ACC.user || !ACC.profile) return '<div class="acct"><p>Sign in to open packs, build your own decks and play colleagues online.</p><button class="btn" data-a="go" data-v="auth">Sign in or create an account</button></div>';
  var p = ACC.profile;
  return '<div class="acct in"><div class="who-am-i"><b>'+esc(p.username)+'</b><span>'+p.packs+' pack'+(p.packs===1?'':'s')+' &middot; '+p.grant_points+' Grant Points</span></div>'
    +'<div class="acct-btns"><button class="btn sm'+(p.packs?' gold':'')+'" data-a="go" data-v="packs">Packs'+(p.packs?' ('+p.packs+')':'')+'</button><button class="btn sm" data-a="go" data-v="collection">Collection</button><button class="btn sm" data-a="go" data-v="decks">Decks</button>'
    +(p.is_admin ? '<button class="btn sm" data-a="go" data-v="admin">Admin</button>' : '')
    +'<button class="lnk" data-a="signout">Sign out</button></div></div>';
}

/* ---- sign in ---- */
function renderAuth(){
  var up = M.authMode==='up';
  return pageTop('Account')+'<div class="panel-pg narrow">'
    +'<div class="tabs"><button class="tab'+(up?'':' on')+'" data-a="authmode" data-v="in">Sign in</button><button class="tab'+(up?' on':'')+'" data-a="authmode" data-v="up">Create account</button></div>'
    + field('user','Username','text','username')
    + field('pass','Password','password', up?'new-password':'current-password')
    + (up ? field('pass2','Password again','password','new-password') : '')
    + (up ? '<p class="hint">3&ndash;20 letters, numbers or _. No email needed.</p>' : '')
    + msgs()
    +'<button class="btn gold big wide" data-a="authsubmit" data-submit'+(M.busy?' disabled':'')+'>'+(M.busy?'One moment&hellip;':up?'Create account':'Sign in')+'</button>'
    +'<p class="hint">Forgotten your password? Message the game admin and they&rsquo;ll reset it for you.</p>'
    +'</div></div>';
}
function submitAuth(){
  var up = M.authMode==='up', u = M.form.user, p = M.form.pass || '';
  if(up && p!==(M.form.pass2||'')){ M.err = 'The two passwords don&rsquo;t match.'; render(); return; }
  busy(async function(){
    if(up) await ACC.signUp(u, p); else await ACC.signIn(u, p);
    M.form = {}; goScreen('menu');
    if(up) M.note = 'Welcome! Your welcome pack is waiting.';
  });
}

/* ---- packs ---- */
function packCardFace(x){ return chars.indexOf(x.card)>=0 ? charFace(x.card, {foil:x.foil}) : actFace(x.card.n); }
function renderPacks(){
  var p = ACC.profile, r = M.reveal, body = '';
  if(r){
    body = '<div class="reveal">'+r.cards.map(function(x,i){
      var up = r.shown[i], f = fxFor('rv'+i);
      var tag = !up ? '' : x.dupe ? '<span class="rtag dupe">Duplicate &middot; +'+x.points+' Grant Points</span>'
        : '<span class="rtag new">'+(x.foil?'New foil!':'New!')+'</span>';
      return '<div class="rslot"><button class="card rcard'+(up?' up':'')+(x.foil&&up?' shine':'')+f.cls+'" style="'+f.style+'" data-a="rv" data-v="'+i+'" aria-label="'+(up?x.card.n:'Face-down card')+'">'+(up?packCardFace(x):backFace())+'</button>'+tag+'</div>';
    }).join('')+'</div>'
    +'<div class="row">'+(r.shown.every(Boolean) ? '<button class="btn gold" data-a="rvdone">Done</button>' : '<button class="btn" data-a="rvall">Reveal all</button>')+'</div>';
  } else {
    body = '<div class="packstack'+(p.packs?'':' empty')+'"><div class="card pack">'+backFace()+'<span class="packn">'+p.packs+'</span></div></div>'
      +'<div class="row"><button class="btn gold big" data-a="packopen"'+(p.packs&&!M.busy?'':' disabled')+'>'+(M.busy?'Opening&hellip;':'Open a pack')+'</button></div>';
  }
  return pageTop('Packs')+'<div class="panel-pg">'
    +'<div class="statline"><span><b>'+p.packs+'</b> unopened</span><span><b>'+p.grant_points+'</b> Grant Points</span></div>'
    + msgs() + body
    +'<ul class="how small"><li>Each pack holds three cards: two action cards and one new character or foil.</li><li>Win a game against the CPU or online for a pack (up to five a day).</li><li>Cards you can&rsquo;t use more of become Grant Points. Spend them in your <button class="lnk" data-a="go" data-v="collection">Collection</button>.</li></ul>'
    +'</div></div>';
}
function openPack(){
  busy(async function(){
    var cards = await ACC.openPack();
    M.reveal = {cards:cards, shown:cards.map(function(){ return false; })};
    cards.forEach(function(_,i){ fxc('rv'+i, 'dealt', 650, i*180); });
  });
}
function flipReveal(i){
  var r = M.reveal; if(!r) return;
  if(r.shown[i]){ var x = r.cards[i]; G.zoom = chars.indexOf(x.card)>=0 ? {k:'ci', ci:chars.indexOf(x.card), foil:x.foil} : {k:'an', n:x.card.n}; G.zoomOpen = true; render(); return; }
  r.shown[i] = true; fxc('rv'+i, 'flip', 700); render();
}

/* ---- collection ---- */
function collTile(c, foil){
  var isChar = chars.indexOf(c)>=0, owned, label;
  if(foil){ owned = ACC.ownsFoil(c.id); label = owned ? 'Foil owned' : 'Foil'; }
  else if(c.set==='base'){ owned = true; label = isChar ? 'Base card' : '3 in every deck'; }
  else if(isChar){ owned = ACC.qty(c.id,false)>0; label = owned ? 'Owned' : 'Pack card'; }
  else { var q = Math.min(3, ACC.qty(c.id,false)); owned = q>0; label = 'Owned '+q+' of 3'; }
  var price = ACC.price(c, foil), buy = ACC.canBuy(c, foil)
    ? '<button class="btn sm buy" data-a="buy" data-v="'+c.id+'" data-f="'+(foil?1:0)+'"'+(ACC.profile.grant_points>=price&&!M.busy?'':' disabled')+'>Buy &middot; '+price+' GP</button>' : '';
  var face = isChar ? charFace(c, {foil:foil}) : actFace(c.n);
  var zv = isChar ? 'c:'+chars.indexOf(c)+(foil?':f':'') : 'a:'+c.n;
  return '<div class="tile"><button class="card coll'+(owned?'':' locked')+(foil&&owned?' shine':'')+'" data-a="czoom" data-v="'+esc(zv)+'" aria-label="'+esc(c.n)+'">'+face+'</button><span class="tl-lbl">'+label+'</span>'+buy+'</div>';
}
function renderCollection(){
  var packChars = chars.filter(function(c){ return c.set!=='base'; }), baseChars = chars.filter(function(c){ return c.set==='base'; });
  var packActs = acts.filter(function(a){ return a.set!=='base'; }), baseActs = acts.filter(function(a){ return a.set==='base'; });
  var grid = function(list, foil){ return '<div class="grid">'+list.map(function(c){ return collTile(c, foil); }).join('')+'</div>'; };
  return pageTop('Collection')+'<div class="panel-pg wide">'
    +'<div class="statline"><span><b>'+ACC.profile.grant_points+'</b> Grant Points</span><span>Commons 8 &middot; Foils 15 &middot; New characters 20</span></div>'
    + msgs()
    +'<h3 class="sec">New characters</h3>'+grid(packChars)
    +'<h3 class="sec">New action cards</h3>'+grid(packActs)
    +'<h3 class="sec">Foils</h3><p class="hint">Foils play exactly like the normal card. They just shine.</p>'+grid(baseChars, true)
    +'<h3 class="sec">Base characters</h3>'+grid(baseChars)
    +'<h3 class="sec">Base action cards</h3>'+grid(baseActs)
    +'</div></div>';
}

/* ---- decks ---- */
var STARTER_ACTIONS = {cat:3, canteen:3, excursion:2, dlc:2, detention:2};
function deckToEdit(d){
  var counts = {};
  (d ? d.actions : []).forEach(function(id){ counts[id] = (counts[id]||0)+1; });
  if(!d) for(var k in STARTER_ACTIONS) counts[k] = STARTER_ACTIONS[k];
  return {id:d?d.id:null, characters:d?d.characters.slice():[], foils:d?(d.foils||[]).slice():[], counts:counts};
}
function editTotal(e){ var n=0; for(var k in e.counts) n += e.counts[k]; return n; }
function renderDecks(){
  var list = ACC.decks.map(function(d){
    return '<div class="deckrow"><div class="dinfo"><b>'+esc(d.name)+'</b><span>'+d.characters.map(function(id){ return chars[CHARID[id]] ? chars[CHARID[id]].n : id; }).join(' &middot; ')+'</span></div>'
      +'<div class="row"><button class="btn sm" data-a="deckedit" data-v="'+d.id+'">Edit</button><button class="lnk" data-a="deckdel" data-v="'+d.id+'">Delete</button></div></div>';
  }).join('');
  return pageTop('Decks')+'<div class="panel-pg">'
    + msgs()
    +'<p class="hint">A deck is six characters and twelve action cards. Choose it on the main menu before a game against the CPU or online.</p>'
    +(list || '<p class="muted">No decks yet.</p>')
    +'<button class="btn gold" data-a="decknew">New deck</button>'
    +'</div></div>';
}
function renderDeckEdit(){
  var e = M.edit, total = editTotal(e), nc = e.characters.length;
  var owned = chars.filter(function(c){ return ACC.ownsChar(c); });
  var charTiles = owned.map(function(c){
    var on = e.characters.indexOf(c.id)>=0, foil = on && e.foils.indexOf(c.id)>=0;
    return '<div class="tile"><button class="card coll pickable'+(on?' sel':'')+(foil?' shine':'')+'" data-a="dchar" data-v="'+c.id+'" aria-pressed="'+on+'">'+charFace(c, {foil:foil})+'</button>'
      +(on && ACC.ownsFoil(c.id) ? '<button class="btn sm" data-a="dfoil" data-v="'+c.id+'">'+(foil?'&#10022; Foil on':'Use foil')+'</button>' : '')+'</div>';
  }).join('');
  var actRows = acts.map(function(a){
    var lim = ACC.actionLimit(a), n = e.counts[a.id]||0;
    if(lim<1 && !n) return '';
    return '<div class="actrow"><button class="aname" data-a="czoom" data-v="a:'+esc(a.n)+'"><b>'+a.n+'</b><span>'+a.a+'</span></button>'
      +'<div class="stepper"><button class="btn sm" data-a="dact" data-v="'+a.id+'" data-d="-1"'+(n>0?'':' disabled')+'>&minus;</button><b>'+n+'</b>'
      +'<button class="btn sm" data-a="dact" data-v="'+a.id+'" data-d="1"'+(n<lim&&total<12?'':' disabled')+'>+</button></div></div>';
  }).join('');
  return pageTop(e.id?'Edit deck':'New deck')+'<div class="panel-pg wide">'
    + field('deckname','Deck name','text')
    +'<h3 class="sec">Characters <span class="count'+(nc===6?' ok':'')+'">'+nc+' / 6</span></h3><div class="grid">'+charTiles+'</div>'
    +'<h3 class="sec">Action cards <span class="count'+(total===12?' ok':'')+'">'+total+' / 12</span></h3><p class="hint">Up to three of each.</p><div class="actlist">'+actRows+'</div>'
    + msgs()
    +'<div class="row sticky-save"><button class="btn gold big" data-a="decksave"'+(nc===6&&total===12&&!M.busy?'':' disabled')+'>Save deck</button><button class="lnk" data-a="go" data-v="decks">Cancel</button></div>'
    +'</div></div>';
}
function saveDeck(){
  var e = M.edit, name = (M.form.deckname||'').trim();
  if(!name){ M.err = 'Give the deck a name.'; render(); return; }
  var actions = []; acts.forEach(function(a){ for(var i=0;i<(e.counts[a.id]||0);i++) actions.push(a.id); });
  busy(async function(){
    await ACC.saveDeck({id:e.id, name:name.slice(0,30), characters:e.characters, actions:actions, foils:e.foils.filter(function(id){ return e.characters.indexOf(id)>=0; })});
    goScreen('decks'); M.note = 'Deck saved.';
  });
}

/* ---- choosing which of a deck's six characters to field (3 v 3 and 4 v 4) ---- */
function teamPick(deck, n, title, done){
  if(!deck){ done(randomTeam(n)); return; }
  if(n>=6){ done(deckTeam(deck, deck.characters)); return; }
  G = {phase:'pick', log:[], fx:[], pick:{deck:deck, n:n, chosen:[], title:title, done:done}};
  render();
}
function renderPick(){
  var p = G.pick, d = p.deck;
  var tiles = d.characters.map(function(id){
    var c = chars[CHARID[id]], on = p.chosen.indexOf(id)>=0;
    return '<button class="card deal up'+(on?' sel':'')+'" data-a="pchar" data-v="'+id+'" aria-pressed="'+on+'">'+charFace(c, {foil:(d.foils||[]).indexOf(id)>=0})+'</button>';
  }).join('');
  return topbar(p.title||'Choose your team')+'<div class="pg"><div class="panel-pg wide">'
    +'<p class="prompt">Choose <b>'+p.n+'</b> of your six characters from <b>'+esc(d.name)+'</b>. '+p.chosen.length+' / '+p.n+' chosen.</p>'
    +'<div class="zone bottom pickzone">'+tiles+'</div>'
    +'<div class="row"><button class="btn gold big" data-a="pickdone"'+(p.chosen.length===p.n?'':' disabled')+'>Ready</button></div>'
    + msgs() + '</div></div>';
}

/* ---- starting games ---- */
function startFromMenu(){
  M.err = '';
  if(CFG.mode==='online'){ if(needAccount()) return; openLobby(); return; }
  var deck = CFG.mode==='cpu' ? chosenDeck() : null;
  if(!deck){ startGame(); return; }
  teamPick(deck, CFG.size, 'Choose your team', function(me){
    var cpu = randomTeam(CFG.size);
    startWithTeams({teams:[me.chars, cpu.chars], foils:[me.foils, []], actions:[me.actions, null]});
  });
}

/* ---- online lobby ----
   Host creates a code and waits. When the guest arrives the host says hello (with the format); both choose
   teams; the guest sends its team; the host picks the seed and first player and sends start. */
var NET = {conn:null, queue:[], waiter:null, finished:false,
  send:function(p){ if(NET.conn) NET.conn.send(p); },
  next:function(cb){ if(NET.queue.length){ var v = NET.queue.shift(); setTimeout(function(){ cb(v); }, 0); } else NET.waiter = cb; },
  push:function(v){ if(NET.waiter){ var cb = NET.waiter; NET.waiter = null; cb(v); } else NET.queue.push(v); },
  close:function(){ if(NET.conn) NET.conn.close(); NET.conn = null; NET.queue = []; NET.waiter = null; }
};
function openLobby(){ NET.close(); L = {stage:'choose'}; M.err=''; G = {phase:'lobby', log:[], fx:[]}; render(); }
function teamToWire(t){ return {chars:t.chars.map(function(ci){ return chars[ci].id; }), foils:t.foils||[], actions:t.actions}; }
function teamFromWire(t){ return {chars:t.chars.map(function(id){ return CHARID[id]; }).filter(function(i){ return i!=null; }), foils:t.foils||[], actions:t.actions}; }
function connect(code, role){
  NET.close(); NET.finished = false;
  L = {stage:role==='host'?'hosting':'joining', role:role, code:code, deck:chosenDeck(), size:role==='host'?CFG.size:null};
  G = {phase:'lobby', log:[], fx:[]};
  NET.conn = ACC.openMatch(code, role, {message:onNet, presence:onPresence, error:function(m){ L.err = m; render(); }});
  render();
}
function onPresence(people){
  var other = people.filter(function(p){ return p.id!==ACC.user.id; })[0];
  if(G.phase==='battle'){ if(!other && !NET.finished && !G.over){ G.oppGone = true; render(); } return; }
  if(!other){ if(L.stage==='picking' || L.stage==='waiting'){ L.err = 'Your opponent left the lobby.'; render(); } return; }
  if(other.role===L.role){ L.err = 'Someone else is already using that code. Try another.'; render(); return; }
  if(L.role==='host' && L.stage==='hosting'){
    L.oppName = other.username;
    NET.send({k:'hello', size:L.size, name:ACC.profile.username});
    pickOnline();
  }
}
function pickOnline(){
  L.stage = 'picking';
  teamPick(L.deck, L.size, 'Versus '+esc(L.oppName||'your opponent'), function(team){
    L.myTeam = team;
    G = {phase:'lobby', log:[], fx:[]};
    if(L.role==='guest'){ L.stage = 'waiting'; NET.send({k:'team', team:teamToWire(team)}); }
    else { L.stage = 'waiting'; maybeStart(); }
    render();
  });
}
function maybeStart(){
  if(L.role!=='host' || !L.myTeam || !L.oppTeam) return;
  var seed = Math.floor(Math.random()*2147483647), first = Math.random()<0.5 ? 0 : 1;
  var msg = {k:'start', seed:seed, first:first, size:L.size, names:[ACC.profile.username, L.oppName], teams:[teamToWire(L.myTeam), L.oppTeam]};
  NET.send(msg);
  beginOnline(msg, 0);
}
function onNet(m){
  if(m.k==='in'){ NET.push(m.v); return; }
  if(m.k==='hello' && L.role==='guest'){ L.size = m.size; L.oppName = m.name; pickOnline(); return; }
  if(m.k==='team' && L.role==='host'){ L.oppTeam = m.team; maybeStart(); render(); return; }
  if(m.k==='start' && L.role==='guest'){ beginOnline(m, 1); }
}
function beginOnline(m, me){
  CFG.mode = 'online'; CFG.me = me; CFG.size = m.size; CFG.names = m.names.map(esc);
  var t = m.teams.map(teamFromWire);
  NET.queue = []; NET.waiter = null;
  startWithTeams({teams:[t[0].chars, t[1].chars], foils:[t[0].chars.map(function(ci){ return t[0].foils.indexOf(chars[ci].id)>=0; }), t[1].chars.map(function(ci){ return t[1].foils.indexOf(chars[ci].id)>=0; })],
    actions:[t[0].actions, t[1].actions]}, m.seed, m.first);
}
function renderLobby(){
  var body = '', deck = L.deck || chosenDeck();
  var deckLine = '<p class="hint">Your team: <b>'+(deck ? esc(deck.name) : 'Random deal')+'</b>. Change it on the <button class="lnk" data-a="menu">menu</button>.</p>';
  if(L.stage==='choose'){
    body = '<div class="lobby-grid"><div class="lobby-card"><h3>Create a game</h3><p>You&rsquo;ll get a code to send to your opponent. Format: <b>'+CFG.size+' v '+CFG.size+'</b>.</p><button class="btn gold" data-a="host">Create game</button></div>'
      +'<div class="lobby-card"><h3>Join a game</h3>'+field('code','Game code','text')+'<button class="btn gold" data-a="join" data-submit>Join</button></div></div>'+deckLine;
  } else if(L.stage==='hosting'){
    body = '<div class="codebox"><span class="eyebrow">Your game code</span><b>'+esc(L.code)+'</b></div><p>Send this code to your opponent. The game starts when they join.</p><p class="muted">Waiting&hellip;</p>';
  } else if(L.stage==='joining'){
    body = '<p>Joining <b>'+esc(L.code)+'</b>&hellip;</p><p class="muted">If nothing happens, check the code with your opponent.</p>';
  } else if(L.stage==='waiting'){
    body = '<p>Waiting for <b>'+esc(L.oppName||'your opponent')+'</b> to choose their team&hellip;</p>';
  }
  return pageTop('Play online')+'<div class="panel-pg">'+body+(L.err?'<p class="err-msg">'+L.err+'</p>':'')
    +(L.stage!=='choose' ? '<div class="row"><button class="lnk" data-a="lobby">Cancel</button></div>' : '')+'</div></div>';
}
function normCode(s){ s = String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,''); return s.length>4 ? s.slice(0,4)+'-'+s.slice(4) : s; }

/* ---- admin ---- */
function renderAdmin(){
  if(!ACC.profile.is_admin) return renderMenuBlocked();
  var d = M.admin;
  if(!d) { loadAdmin(); return pageTop('Admin')+'<div class="panel-pg wide"><p class="muted">Loading&hellip;</p></div></div>'; }
  var rows = d.overview.map(function(u){
    return '<div class="deckrow"><div class="dinfo"><b>'+esc(u.username)+'</b><span>'+u.packs+' packs &middot; '+u.grant_points+' GP &middot; '+u.deck_count+' deck'+(u.deck_count===1?'':'s')+'</span></div>'
      +'<div class="dinfo"><span>Last login</span><b class="small">'+(u.last_login ? new Date(u.last_login).toLocaleString() : 'never')+'</b></div></div>';
  }).join('');
  var decks = d.decks.map(function(dk){
    return '<div class="deckrow"><div class="dinfo"><b>'+esc(dk.username)+'</b><span>'+esc(dk.deck_name)+' &middot; '+dk.characters.map(function(id){ return chars[CHARID[id]] ? chars[CHARID[id]].n : id; }).join(', ')+'</span></div></div>';
  }).join('');
  return pageTop('Admin')+'<div class="panel-pg wide">'
    +'<h3 class="sec">Players ('+d.overview.length+')</h3>'+(rows || '<p class="muted">No players yet.</p>')
    +'<h3 class="sec">Decks</h3>'+(decks || '<p class="muted">No decks yet.</p>')
    +'</div></div>';
}
function renderMenuBlocked(){ return pageTop('Admin')+'<div class="panel-pg"><p class="err-msg">Admin access only.</p></div></div>'; }
function loadAdmin(){
  busy(async function(){
    var r = await Promise.all([ACC.adminOverview(), ACC.adminDecks()]);
    M.admin = {overview:r[0]||[], decks:r[1]||[]};
  });
}

function renderMeta(){
  var signedIn = ACC && ACC.user && ACC.profile;
  var needs = {packs:1, collection:1, decks:1, deckedit:1, lobby:1, admin:1};
  if(needs[G.phase] && !signedIn) return renderAuth();
  var html = G.phase==='auth' ? renderAuth() : G.phase==='packs' ? renderPacks() : G.phase==='collection' ? renderCollection()
    : G.phase==='decks' ? renderDecks() : G.phase==='deckedit' ? renderDeckEdit() : G.phase==='lobby' ? renderLobby()
    : G.phase==='admin' ? renderAdmin() : renderPick();
  if(G.zoomOpen) html += '<div class="ov zoomov always" data-a="unzoom">'+zoomBlock()+'</div>';
  return html;
}

function paint(){
  var t = now();
  G.fx = (G.fx||[]).filter(function(f){ return t-f.t0 <= f.dur; });
  // Keep typing focus across re-renders (the whole screen is rebuilt each time).
  var ae = typeof document!=='undefined' && document.activeElement, fname = ae && ae.name && root.contains(ae) ? ae.name : null, sel = fname ? [ae.selectionStart, ae.selectionEnd] : null;
  root.innerHTML = (G.phase==='deal' ? renderDeal() : G.phase==='battle' ? renderBattle() : G.phase==='menu' ? renderMenu() : renderMeta()) + rulesHtml();
  if(fname){ var ne = root.querySelector('[name="'+fname+'"]'); if(ne){ ne.focus(); try{ ne.setSelectionRange(sel[0], sel[1]); }catch(e){} } }
  // When a target choice starts, bring the first valid target into view.
  var w = G.wait;
  if(w && w.kind==='unit' && !w.scrolled){
    w.scrolled = true;
    var el = root.querySelector && root.querySelector('.unit.pick');
    if(el && el.scrollIntoView) el.scrollIntoView({block:'center'});
  }
  root.className = 'ph-'+G.phase;
}
var queued = false;
function render(){
  if(!root) return;
  if(CFG.mode==='sim'){ paint(); return; }
  if(queued) return;
  queued = true;
  setTimeout(function(){ queued = false; paint(); }, 0);
}

function onClick(e){
  var el = e.target.closest('[data-a]');
  if(!el || el.disabled) return;
  var a = el.getAttribute('data-a'), v = el.getAttribute('data-v'), w = G.wait;
  switch(a){
    case 'cfg': CFG[el.getAttribute('data-k')] = el.getAttribute('data-k')==='size' ? +v : v; M.err=''; render(); break;
    case 'start': startFromMenu(); break;
    case 'menu': goScreen('menu'); break;
    /* ---- accounts & collection ---- */
    case 'go':
      if(v==='deckedit' || (v!=='auth' && needAccount())) break;
      if(v==='packs') M.reveal = null;
      goScreen(v); break;
    case 'authmode': M.authMode = v; M.err=''; render(); break;
    case 'authsubmit': submitAuth(); break;
    case 'signout': busy(async function(){ await ACC.signOut(); M.deckSel='random'; }); break;
    case 'deckpick': M.deckSel = v; try{ localStorage.setItem('travis.deck', v); }catch(e){} render(); break;
    case 'packopen': openPack(); break;
    case 'rv': flipReveal(+v); break;
    case 'rvall': M.reveal.shown.forEach(function(s,i){ if(!s){ M.reveal.shown[i]=true; fxc('rv'+i, 'flip', 700, i*140); } }); render(); break;
    case 'rvdone': M.reveal = null; render(); break;
    case 'buy': { var f = el.getAttribute('data-f')==='1'; busy(async function(){ await ACC.buyCard(v, f); M.note = 'Added to your collection.'; }); break; }
    case 'czoom': {
      var parts = v.split(':');
      G.zoom = parts[0]==='c' ? {k:'ci', ci:+parts[1], foil:parts[2]==='f'} : {k:'an', n:parts.slice(1).join(':')};
      G.zoomOpen = true; render(); break;
    }
    case 'decknew': M.edit = deckToEdit(null); M.form.deckname = 'My deck'; goScreen('deckedit'); break;
    case 'deckedit': { var d = ACC.decks.filter(function(x){ return x.id===v; })[0]; if(!d) break; M.edit = deckToEdit(d); M.form.deckname = d.name; goScreen('deckedit'); break; }
    case 'deckdel': {
      var dd = ACC.decks.filter(function(x){ return x.id===v; })[0];
      if(dd && (typeof confirm!=='function' || confirm('Delete the deck "'+dd.name+'"?'))) busy(async function(){ await ACC.deleteDeck(v); if(M.deckSel===v) M.deckSel='random'; });
      break;
    }
    case 'dchar': {
      var e2 = M.edit, k = e2.characters.indexOf(v);
      if(k>=0) e2.characters.splice(k,1); else if(e2.characters.length<6) e2.characters.push(v);
      render(); break;
    }
    case 'dfoil': { var fl = M.edit.foils, fk = fl.indexOf(v); if(fk>=0) fl.splice(fk,1); else fl.push(v); render(); break; }
    case 'dact': { var cn = M.edit.counts; cn[v] = Math.max(0, (cn[v]||0) + (+el.getAttribute('data-d'))); render(); break; }
    case 'decksave': saveDeck(); break;
    case 'pchar': {
      var pk = G.pick, pi = pk.chosen.indexOf(v);
      if(pi>=0) pk.chosen.splice(pi,1); else if(pk.chosen.length<pk.n) pk.chosen.push(v);
      render(); break;
    }
    case 'pickdone': { var pp = G.pick; if(pp.chosen.length===pp.n) pp.done(deckTeam(pp.deck, pp.chosen)); break; }
    /* ---- online ---- */
    case 'lobby': if(needAccount()) break; openLobby(); break;
    case 'host': connect(ACC.makeCode(), 'host'); break;
    case 'join': { var code = normCode(M.form.code); if(!/^[A-Z]{4}-\d{2}$/.test(code)){ M.err=''; L.err = 'Codes look like ABCD-12.'; render(); break; } L.err=''; connect(code, 'guest'); break; }
    case 'close': G.hideOver = true; render(); break;
    case 'unzoom': G.zoomOpen = false; render(); break;
    case 'dealpass': G.deal.pass = false; G.deal.picks[G.deal.turn].forEach(function(_,i){ fxc('d'+G.deal.turn+'_'+i, 'dealt', 650, i*160); }); render(); break;
    case 'flip': flipDealt(+v); break;
    case 'revealall': revealAll(); break;
    case 'mull': mulligan(); break;
    case 'dealdone': dealDone(); break;
    case 'unit': {
      // Tapping a card acts on it: pick a target, or choose your character.
      var u = unitById(+v);
      if(w && w.kind==='unit'){ if(w.ids.indexOf(+v)>=0){ G.zoomOpen = false; w.res(u); } break; }
      if(u && selectable(u) && G.cur!==u){ G.cur = u; G.zoom = {k:'u', id:u.id}; render(); break; }
      G.zoom = {k:'u', id:+v}; G.zoomOpen = true; render();
      break;
    }
    case 'info': G.zoom = {k:'u', id:+v}; G.zoomOpen = true; render(); break;
    case 'cinfo': G.zoom = {k:'c', uid:+v}; G.zoomOpen = true; render(); break;
    case 'select': { var s = unitById(+v); if(s && selectable(s)){ G.cur = s; G.zoom = {k:'u', id:s.id}; } G.zoomOpen = false; render(); break; }
    case 'hand': {
      var uid = +v, h = G.hands[viewer()], i = h.map(function(c){ return c.uid; }).indexOf(uid);
      if(i<0) break;
      if(canPlayNow(h[i])){ G.sel=null; G.zoomOpen=false; w.res({t:'card', i:i}); }
      else { G.sel = uid; G.zoom = {k:'c', uid:uid}; G.zoomOpen = true; render(); }
      break;
    }
    case 'play': {
      var h2 = G.hands[viewer()], j = h2.map(function(c){ return c.uid; }).indexOf(+v);
      if(j>=0 && w && w.kind==='cmd' && canPlayNow(h2[j])){ G.sel=null; G.zoom=null; G.zoomOpen=false; w.res({t:'card', i:j}); }
      break;
    }
    case 'cmd': if(w && w.kind==='cmd'){ G.zoomOpen = false; w.res(v==='atk' ? {t:'atk', i:+el.getAttribute('data-i')} : {t:v}); } break;
    case 'opt': if(w && w.kind==='opt') w.res(+v); break;
    case 'cancel': if(w && w.cancel) w.res(w.kind==='opt' ? -1 : null); break;
    case 'pass': if(w && w.kind==='pass') w.res(); break;
    case 'rules': G.showRules = true; render(); break;
    case 'rulesoff': G.showRules = false; render(); break;
    case 'noop': break;
  }
}

function onInput(e){ var t = e.target; if(t && t.name) M.form[t.name] = t.value; }
function onKey(e){
  if(e.key!=='Enter' || !e.target || e.target.tagName!=='INPUT') return;
  var b = root.querySelector('[data-submit]');
  if(b && !b.disabled){ e.preventDefault(); b.click(); }
}

var api = {CFG:CFG, state:function(){ return G; }, startGame:startGame, net:NET,
  mount:function(el){
    root = el;
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey);
    render();
    if(ACC) ACC.init(function(){
      if(ACC.user && M.deckSel!=='random' && !chosenDeck()) M.deckSel = 'random';
      if(G.phase!=='battle') render();
    });
  }};
if(typeof window!=='undefined') window.TravisGame = api;
})();
