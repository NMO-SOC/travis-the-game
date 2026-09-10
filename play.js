/* Travis: The Game — browser engine. Depends on cards.js (S, chars, acts). */
(function(){
'use strict';

var HAND_LIMIT = 3;
var ABORT_OVER = {abort:'over'}, ABORT_DEAD = {abort:'dead'};
var CFG = {mode:'cpu', size:6, speed:1};
var G = {phase:'menu', log:[], fx:[]};

var CHAR = {}; chars.forEach(function(c,i){ CHAR[c.n] = i; });
var ACTD = {}; acts.forEach(function(a){ ACTD[a.n] = a; });

/* ---------------- helpers ---------------- */
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function best(arr, ai){
  if(!ai) return arr[Math.floor(Math.random()*arr.length)];
  var b=null, bs=-Infinity;
  arr.forEach(function(x,i){ var s=ai(x,i)+Math.random()*0.01; if(s>bs){ bs=s; b=x; } });
  return b;
}
function bestIdx(arr, ai){ var b=best(arr.map(function(x,i){return {x:x,i:i};}), ai ? function(o){ return ai(o.x,o.i); } : null); return b.i; }

function isCPU(t){ return CFG.mode==='sim' || (CFG.mode==='cpu' && t===1); }
function pname(t){
  if(CFG.mode==='cpu') return t===0 ? 'You' : 'CPU';
  if(CFG.mode==='sim') return 'CPU '+(t+1);
  return 'Player '+(t+1);
}
function viewer(){
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
function pw(u){ return '<i>'+u.c.an+'</i>'; }

function effAtk(u){ return Math.max(1, u.atk + u.atkGame); }
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

function newUnit(ci, team, hp){
  var c = chars[ci];
  return {id:++G.uid, ci:ci, c:c, team:team, max:c.hp, hp:hp==null?c.hp:hp, atk:c.atk, spd:c.spd,
    ko:false, used:false, cancelled:false, revealed:false, shield:false, atkGame:0, skip:0, acted:false, tie:Math.random()};
}

/* ---------------- async plumbing ---------------- */
function delay(ms){
  var g = G;
  var p = CFG.speed ? new Promise(function(r){ setTimeout(r, ms*CFG.speed); }) : Promise.resolve();
  return p.then(function(){ if(g!==G) throw ABORT_DEAD; });
}
function checkInt(){ if(G.over) throw ABORT_OVER; }
function sleep(ms){ return delay(ms).then(checkInt); }

function wait(kind, data){
  return new Promise(function(res, rej){
    var w = {kind:kind};
    for(var k in data) w[k]=data[k];
    w.res = function(v){ G.wait=null; render(); res(v); };
    w.rej = function(e){ G.wait=null; render(); rej(e); };
    G.wait = w; render();
  });
}
function pickUnit(team, prompt, cands, ai, cancel){
  if(!cands.length) return Promise.resolve(null);
  if(isCPU(team)) return sleep(350).then(function(){ return best(cands, ai); });
  return wait('unit', {team:team, prompt:prompt, ids:cands.map(function(u){ return u.id; }), cancel:!!cancel});
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
  log(G.winner<0 ? 'Both teams are knocked out. It&rsquo;s a draw.' : pn(G.winner)+' '+(CFG.mode==='cpu'&&G.winner===0?'win':'wins')+'!', 'win');
  throw ABORT_OVER;
}
function strikeTargets(u){ return foes(u); }
function attack(u, e, mult){
  fxc('u'+u.id, 'lunge', 450);
  log(nm(u)+' attacks '+nm(e)+'.');
  return damage(e, effAtk(u)*(mult||1));
}
function hitScore(dmg, e){ return (e.shield?-8:0) + (e.hp<=dmg?40+effAtk(e):0) + effAtk(e)*1.5 - e.hp*0.4; }
function pickFoe(u, prompt, dmg){ return pickUnit(u.team, prompt, foes(u), function(e){ return hitScore(dmg, e); }, true); }
function pickFriend(t, prompt, list, ai){ return pickUnit(t, prompt, list, ai, true); }

/* ---------------- Powers (once per game) ---------------- */
var AB = {
 'Doctor Knox':{
  can:function(u){ return foes(u).some(function(e){ return !e.used && !e.cancelled; }); },
  ai:function(){ return 4; },
  run:async function(u){
   var t = await pickUnit(u.team, 'Peer Review: which enemy loses its Power?', foes(u).filter(function(e){ return !e.used && !e.cancelled; }), function(e){ return effAtk(e)+e.hp*0.2; }, true);
   if(!t) return false;
   t.cancelled = true;
   log(nm(u)+' uses '+pw(u)+': '+nm(t)+' can&rsquo;t use its Power now.'); return true;
  }},
 'Director Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(){ return 4; },
  run:async function(u){
   var t = await pickUnit(u.team, 'See Me After Class: who skips their next turn?', foes(u), function(e){ return effAtk(e)*2+(e.acted?0:3)-(e.skip?30:0); }, true);
   if(!t) return false;
   t.skip = 1;
   log(nm(u)+' uses '+pw(u)+': '+nm(t)+' skips its next turn.'); return true;
  }},
 'Blue Suit Knox':{
  can:function(){ return true; },
  ai:function(){ return 6; },
  run:async function(u){ u.atkGame += 3; log(nm(u)+' uses '+pw(u)+': +3 ATK for the rest of the game.'); return true; }},
 'Beer Frog Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(u){ return foes(u).length*2.2; },
  run:async function(u){
   log(nm(u)+' uses '+pw(u)+': 2 damage to every enemy!');
   var list = foes(u);
   for(var i=0;i<list.length;i++) await damage(list[i], 2);
   return true;
  }},
 'Family Man Knox':{
  can:function(u){ return living(u.team).some(function(f){ return f.hp<f.max; }); },
  ai:function(u){ return living(u.team).reduce(function(s,f){ return s+Math.min(4, f.max-f.hp); }, 0)*0.6; },
  run:async function(u){ log(nm(u)+' uses '+pw(u)+': the whole team heals.'); living(u.team).forEach(function(f){ heal(f, 4); }); return true; }},
 'Seal Whisperer Knox':{
  can:function(u){ return living(u.team).some(function(f){ return !f.shield; }); },
  ai:function(u){ return living(u.team).filter(function(f){ return !f.shield; }).length*1.5; },
  run:async function(u){ living(u.team).forEach(function(f){ f.shield = true; }); log(nm(u)+' uses '+pw(u)+': every character on the team gets a Shield.'); return true; }},
 'Mixtape Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(){ return 5; },
  run:async function(u){
   var t = await pickFoe(u, 'Track Seven: deal 5 damage to whom?', 5);
   if(!t) return false;
   log(nm(u)+' uses '+pw(u)+' on '+nm(t)+'.');
   await damage(t, 5); return true;
  }},
 'Chaperone Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(u){ return foes(u).length*1.5; },
  run:async function(u){ foes(u).forEach(function(e){ e.atkGame -= 1; }); log(nm(u)+' uses '+pw(u)+': every enemy gets &minus;1 ATK.'); return true; }},
 'Field Researcher Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(){ return 7; },
  run:async function(u){
   var t = await pickFoe(u, 'Tag and Release: 4 damage and a skipped turn to whom?', 4);
   if(!t) return false;
   log(nm(u)+' uses '+pw(u)+' on '+nm(t)+'.');
   await damage(t, 4);
   if(!t.ko){ t.skip = 1; log(nm(t)+' skips its next turn.'); }
   return true;
  }},
 'Fire Drill Knox':{
  can:function(){ return G.deck.length + G.discard.length > 0; },
  ai:function(u){ return G.hands[u.team].length<=1 ? 4.5 : 2; },
  run:async function(u){ log(nm(u)+' uses '+pw(u)+': draw 2 cards.'); drawCard(u.team, true); drawCard(u.team, true); return true; }},
 'Elephant Seal Knox':{
  can:function(u){ return u.hp<u.max; },
  ai:function(u){ return (u.max-u.hp)*0.45; },
  run:async function(u){ log(nm(u)+' uses '+pw(u)+'.'); heal(u, u.max); return true; }},
 'Leopard Seal Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(u){ return effAtk(u)*2; },
  run:async function(u){
   var t = await pickFoe(u, 'Ambush: attack whom for double damage ('+effAtk(u)*2+')?', effAtk(u)*2);
   if(!t) return false;
   log(nm(u)+' uses '+pw(u)+'!');
   await attack(u, t, 2); return true;
  }},
 'Staff Meeting Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(u){ return 3.5 + Math.min(3, u.max-u.hp)*0.5; },
  run:async function(u){
   var t = await pickFoe(u, 'Agenda Item 14: deal 3 damage to whom?', 3);
   if(!t) return false;
   log(nm(u)+' uses '+pw(u)+' on '+nm(t)+'.');
   await damage(t, 3); heal(u, 3); return true;
  }},
 'Parent-Teacher Knox':{
  can:function(u){ return foes(u).some(function(e){ return e.hp>u.hp; }); },
  ai:function(u){ var hi = Math.max.apply(null, foes(u).map(function(e){ return e.hp; })); return (hi-u.hp)/1.5; },
  run:async function(u){
   var t = await pickUnit(u.team, 'Concerns Raised: swap HP with which enemy?', foes(u), function(e){ return e.hp; }, true);
   if(!t) return false;
   var h = u.hp; u.hp = t.hp; t.hp = h;
   log(nm(u)+' uses '+pw(u)+': swaps HP with '+nm(t)+' ('+u.hp+' / '+t.hp+').');
   return true;
  }},
 'Tadpole Knox':{
  can:function(u){ return G.teams[u.team].some(function(f){ return f.ko; }); },
  ai:function(){ return 8; },
  run:async function(u){
   var r = await pickUnit(u.team, 'Metamorphosis: bring back which character?', G.teams[u.team].filter(function(f){ return f.ko; }), function(f){ return f.max+f.atk*2; }, true);
   if(!r) return false;
   r.ko=false; r.hp=Math.min(8, r.max); r.acted=true;
   fx(r, '+'+r.hp, 'heal');
   log(nm(u)+' uses '+pw(u)+': '+nm(r)+' is back with '+r.hp+' HP!');
   return true;
  }},
 'Emeritus Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(u){ return u.hp>4 ? 8 : 1; },
  run:async function(u){
   var t = await pickFoe(u, 'Tenure: deal 10 damage to whom? (Emeritus takes 4.)', 10);
   if(!t) return false;
   log(nm(u)+' uses '+pw(u)+' on '+nm(t)+'!');
   await damage(t, 10);
   await damage(u, 4);
   return true;
  }}
};
function canAbil(u){ var a = AB[u.c.n]; return !!a && !u.used && !u.cancelled && a.can(u); }
function abilReason(u){
  if(u.cancelled) return 'Blocked by Peer Review';
  if(u.used) return 'Already used';
  if(!AB[u.c.n] || !AB[u.c.n].can(u)) return 'Nothing to use it on yet';
  return '';
}
async function useAbility(u){
  u.used = true;
  fxc('u'+u.id, 'cast', 900);
  if(await AB[u.c.n].run(u)===false){ u.used = false; return false; }
  render(); return true;
}

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
   e.skip = 1;
   log(pn(t)+' plays '+card('Detention')+': '+nm(e)+' skips its next turn.'); return true;
  }}
};
async function playCard(t, i, u){
  var c = G.hands[t][i];
  G.hands[t].splice(i,1);
  if(await ACT[c.n].run(t,u)===false){ G.hands[t].splice(i,0,c); render(); return false; }
  G.discard.push(c);
  render(); return true;
}
function canPlayCards(u){ return !G.cardPlayed && !u.ko; }
function playable(t, c, u){ return ACT[c.n].can(t, u); }
function drawCard(t, force){
  if(!force && G.hands[t].length>=HAND_LIMIT) return;
  if(!G.deck.length && G.discard.length){ G.deck = shuffle(G.discard); G.discard = []; log('The discard pile is shuffled into a new deck.'); }
  if(!G.deck.length) return;
  var c = G.deck.pop();
  G.hands[t].push(c); fxc('c'+c.uid, 'drawn', 650);
  render();
}

/* ---------------- turns ---------------- */
async function humanTurn(u){
  while(true){
    if(u.ko || G.over) return;
    var cardsOk = canPlayCards(u) && G.hands[u.team].some(function(c){ return playable(u.team,c,u); });
    if(G.acted && !cardsOk) return;
    var cmd = await wait('cmd', {team:u.team});
    if(cmd.t==='end') return;
    if(cmd.t==='strike' && !G.acted){
      var e = cmd.target ? foes(u).filter(function(x){ return x.id===cmd.target; })[0]
        : await pickUnit(u.team, 'Attack with '+u.c.n+' for '+effAtk(u)+': tap an enemy', foes(u), null, true);
      if(!e) continue;
      G.acted = true; await attack(u, e);
    } else if(cmd.t==='ability' && !G.acted && canAbil(u)){
      if(await useAbility(u)) G.acted = true;
    } else if(cmd.t==='card' && cardsOk && playable(u.team, G.hands[u.team][cmd.i], u)){
      if(await playCard(u.team, cmd.i, u)) G.cardPlayed = true;
    }
  }
}
async function cpuCard(u, threshold){
  if(!canPlayCards(u)) return;
  var t = u.team, bi = -1, bs = threshold;
  G.hands[t].forEach(function(c,i){
    if(!playable(t,c,u)) return;
    var s = ACT[c.n].ai(t,u) + Math.random()*0.6;
    if(s>bs){ bs=s; bi=i; }
  });
  if(bi<0) return;
  await sleep(450);
  if(await playCard(t, bi, u)) G.cardPlayed = true;
}
async function cpuAct(u){
  await sleep(450);
  var a = effAtk(u), tg = foes(u);
  var kill = tg.some(function(e){ return e.hp<=a && !e.shield; });
  var atkScore = a + (kill?6:0) + Math.random()*1.5;
  if(canAbil(u) && AB[u.c.n].ai(u)+Math.random()*1.5 > atkScore && await useAbility(u)) return;
  await attack(u, best(tg, function(e){ return hitScore(a, e); }));
}
async function cpuTurn(u){
  await sleep(650);
  await cpuCard(u, 3);
  if(!G.acted && !u.ko){ G.acted = true; await cpuAct(u); }
  await cpuCard(u, 2.6);
}
async function passScreen(t){
  if(CFG.mode!=='hot' || G.lastHuman===t) return;
  G.lastHuman = t;
  await wait('pass', {team:t});
}
async function takeTurn(u){
  G.cur=u; G.acted=false; G.cardPlayed=false; u.acted=true; G.sel=null;
  if(!isCPU(u.team)) await passScreen(u.team);
  checkInt();
  reveal(u);
  if(!hidden(u)) G.zoom = {k:'u', id:u.id};
  log(pn(u.team)+' &middot; '+nm(u)+' is up.', 'turn');
  if(u.skip>0){
    u.skip = 0;
    log(nm(u)+' skips this turn.');
    await sleep(700);
  } else {
    drawCard(u.team);
    if(isCPU(u.team)) await cpuTurn(u); else await humanTurn(u);
  }
  G.cur = null;
  if(!u.ko) fxc('u'+u.id, 'tapanim', 450);
}
function startRound(){
  G.round++;
  allUnits().forEach(function(u){ if(u.acted && !u.ko) fxc('u'+u.id, 'untap', 450); u.acted=false; u.tie=Math.random(); });
  log('Round '+G.round, 'round');
}
async function gameLoop(){
  var g = G;
  try{
    while(true){
      startRound();
      await delay(250);
      var u;
      while((u = queue()[0])) await takeTurn(u);
      if(G.round>=99){ G.over=true; G.winner=-1; log('Ninety-nine rounds. Everyone goes home.', 'win'); throw ABORT_OVER; }
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
       charDeck:shuffle(chars.map(function(_,i){ return i; })),
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
function beginBattle(){
  var d = G.deal;
  G.phase='battle'; G.round=0; G.over=false; G.winner=null; G.zoom=null; G.sel=null;
  G.teams = d.picks.map(function(p,t){ return p.map(function(ci){ return newUnit(ci,t); }); });
  G.deck = []; acts.forEach(function(a){ for(var k=0;k<a.x;k++) G.deck.push({uid:G.deck.length, n:a.n}); });
  shuffle(G.deck);
  G.discard=[]; G.hands=[[],[]]; G.lastHuman=null;
  var n = 2;
  for(var k=0;k<n;k++){ for(var t=0;t<2;t++){ var c=G.deck.pop(); G.hands[t].push(c); fxc('c'+c.uid, 'drawn', 650, k*200); } }
  log('The specimens take the field, face-down. Each is revealed when it first acts.');
  gameLoop();
}

/* ---------------- card faces ---------------- */
var COLOR = {
  'Doctor Knox':'blue','Seal Whisperer Knox':'blue','Field Researcher Knox':'blue','Elephant Seal Knox':'blue',
  'Director Knox':'white','Chaperone Knox':'white','Staff Meeting Knox':'white','Parent-Teacher Knox':'white',
  'Blue Suit Knox':'black','Leopard Seal Knox':'black','Emeritus Knox':'black',
  'Family Man Knox':'red','Mixtape Knox':'red','Fire Drill Knox':'red',
  'Beer Frog Knox':'green','Tadpole Knox':'green'
};
var root = null;
function art(k){ return (S[k]||'').replace(/#(0B2545|5F8F35|1D4E89)/g, 'currentColor'); }
function charFace(c, o){
  o = o || {};
  var col = COLOR[c.n] || 'blue';
  return '<div class="face f-'+col+'">'
   +'<div class="tl"><span class="tn">'+c.n+'</span><span class="gem spd'+(o.spdCls||'')+'" title="Speed">'+(o.spd!=null?o.spd:c.spd)+'</span></div>'
   +'<div class="art a-'+col+'">'+art(c.i)+'</div>'
   +(o.bar||'')
   +'<div class="ty">Specimen &mdash; '+c.r+'</div>'
   +'<div class="tx"><p><b>Power &mdash; '+c.an+':</b> '+c.a+'</p><p class="fl">'+c.f+'</p></div>'
   +'<div class="gem atk'+(o.atkCls||'')+'" title="Attack">'+(o.atk!=null?o.atk:c.atk)+'</div>'
   +'<div class="gem hp'+(o.hpCls||'')+'" title="Health">'+(o.hp!=null?o.hp:c.hp)+'</div>'
   +'</div>';
}
function actFace(n){
  var a = ACTD[n];
  return '<div class="face f-gold">'
   +'<div class="tl"><span class="tn">'+n+'</span><span class="gem spd" title="Action card">&#9889;</span></div>'
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
  if(u.skip>0) c.push(['Skips turn','r']);
  if(u.cancelled) c.push(['No Power','r']);
  return c.map(function(x){ return '<span class="chip '+x[1]+'">'+x[0]+'</span>'; }).join('');
}
function isZoom(k, v){ return G.zoom && G.zoom.k===k && (G.zoom.id===v || G.zoom.uid===v || G.zoom.ci===v); }
function unitCard(u){
  var w = G.wait, pick = w && w.kind==='unit' && w.ids.indexOf(u.id)>=0;
  var dim = w && w.kind==='unit' && !pick;
  var hid = hidden(u), f = fxFor('u'+u.id), body;
  var cls = 'card mini unit t'+u.team+(u.ko?' ko':'')+(G.cur===u?' cur':'')+(pick?' pick':'')+(dim?' dim':'')
    +(u.acted && !u.ko && G.cur!==u ? ' tapped' : '')+(isZoom('u',u.id)?' zoomed':'')+f.cls;
  if(hid){
    var dmg = u.max-u.hp;
    body = backFace() + (dmg>0 && !u.ko ? '<span class="dmgb">&minus;'+dmg+'</span>' : '');
  } else {
    var a = effAtk(u), pct = Math.max(0, Math.min(100, u.hp/u.max*100));
    body = charFace(u.c, {atk:a, hp:u.hp, spd:effSpd(u), atkCls:a>u.atk?' bu':a<u.atk?' bd':'',
      hpCls:u.hp<u.max?' hurt':'', bar:'<div class="hpb"><i style="width:'+pct+'%"></i></div>'});
  }
  return '<button class="'+cls+'" style="'+f.style+'" data-a="unit" data-v="'+u.id+'" aria-label="'+(hid?'Face-down card':u.c.n)+'">'
   + body + '<div class="chips">'+chips(u)+'</div>' + (u.ko ? '<div class="kotag">Knocked out</div>' : '') + f.fl + '</button>';
}
function handTeam(){
  if(CFG.mode!=='hot') return 0;
  if(G.cur && !isCPU(G.cur.team)) return G.cur.team;
  return G.lastHuman==null ? 0 : G.lastHuman;
}
function canPlayNow(c){
  var w = G.wait, u = G.cur, t = viewer();
  return !!(w && w.kind==='cmd' && u && u.team===t && canPlayCards(u) && playable(t, c, u));
}
function fanStyle(i, n, spread){
  var off = i-(n-1)/2;
  return '--r:'+(off*spread)+'deg;--y:'+(Math.abs(off)*Math.abs(off)*4)+'px;z-index:'+(i+1);
}
function handHtml(t){
  var h = G.hands[t];
  if(!h.length) return '<div class="hand empty"><span>No cards in hand</span></div>';
  return '<div class="hand">'+h.map(function(c,i){
    var f = fxFor('c'+c.uid), ok = canPlayNow(c);
    return '<button class="card hc'+(ok?' ok':'')+(G.sel===c.uid?' sel':'')+f.cls+'" style="'+fanStyle(i,h.length,6)+';'+f.style+'" data-a="hand" data-v="'+c.uid+'" aria-label="'+c.n+'">'+actFace(c.n)+'</button>';
  }).join('')+'</div>';
}
function oppHand(t){
  var n = G.hands[t].length;
  var backs = ''; for(var i=0;i<n;i++) backs += '<div class="card ob" style="'+fanStyle(i,n,9)+'">'+backFace()+'</div>';
  return '<div class="ohand" title="'+n+' cards in hand">'+backs+'<span class="ocount">'+n+'</span></div>';
}
function plate(t, side){
  var alive = living(t).length, act = G.cur && G.cur.team===t && !G.over;
  return '<div class="plate '+side+' t'+t+(act?' active':'')+'"><span class="av">'+art(t?'lseal':'seal')+'</span>'
   +'<span class="pinfo"><b>'+pname(t)+'</b><small>'+alive+' of '+G.teams[t].length+' standing</small></span>'
   + (side==='top' ? oppHand(t) : '') + '</div>';
}
function statusLine(){
  var w = G.wait;
  if(G.over) return G.winner<0 ? 'A draw.' : pname(G.winner)+(CFG.mode==='cpu'&&G.winner===0?' win!':' wins!');
  if(w && w.kind==='unit') return '<span class="who t'+w.team+'">'+pname(w.team)+':</span> '+w.prompt+(w.cancel?' <button class="lnk" data-a="cancel">Cancel</button>':'');
  if(w && w.kind==='opt') return '<span class="who t'+w.team+'">'+pname(w.team)+'</span> is choosing&hellip;';
  if(G.cur && w && w.kind==='cmd'){
    var u = G.cur;
    if(!G.acted) return nm(u)+'&rsquo;s turn. <b>Tap an enemy</b> to attack it, or use its Power.'+(canPlayCards(u)?' You can also play one card.':'');
    return 'Done! Play a card, or tap End Turn.';
  }
  if(G.cur && isCPU(G.cur.team)) return nm(G.cur)+' <span class="muted">&mdash; the CPU is thinking&hellip;</span>';
  return '&nbsp;';
}
function pile(kind){
  if(kind==='deck'){
    var n = G.deck.length;
    return '<div class="pile deck'+(n?'':' gone')+'" title="Action deck"><div class="card">'+backFace()+'</div><span class="pc">'+n+'</span><small>Deck</small></div>';
  }
  var top = G.discard[G.discard.length-1];
  return '<div class="pile disc" title="Discard pile">'+(top ? '<div class="card">'+actFace(top.n)+'</div>' : '<div class="slot"></div>')+'<span class="pc">'+G.discard.length+'</span><small>Discard</small></div>';
}
function actionBar(){
  var w = G.wait, u = G.cur;
  if(!(w && w.kind==='cmd' && u && u.team===viewer())) return '<div class="actions idle"></div>';
  var dis = function(b){ return b ? ' disabled' : ''; };
  var r = abilReason(u);
  return '<div class="actions">'
   +'<button class="btn act"'+dis(G.acted||!strikeTargets(u).length)+' data-a="cmd" data-v="strike"><i>&#9876;</i><b>Attack</b><small>Deal '+effAtk(u)+' damage</small></button>'
   +'<button class="btn act abil"'+dis(G.acted||!canAbil(u))+' data-a="cmd" data-v="ability"><i>&#10022;</i><b>Power: '+u.c.an+'</b><small>'+(r||'Once per game')+'</small></button>'
   +'<button class="btn end" data-a="cmd" data-v="end"><b>'+(G.acted?'End Turn':'Pass')+'</b></button>'
   +'</div>';
}
/* Buttons shown under an inspected character, so tapping a card is enough to act on it (mobile-friendly). */
function unitActions(u){
  var w = G.wait, cur = G.cur, btn = '', cap = '';
  if(!(w && w.kind==='cmd' && cur && cur.team===viewer()) || G.acted || u.ko) return {btn:btn, cap:cap};
  if(u.team!==cur.team){
    btn += '<button class="btn gold" data-a="strikeat" data-v="'+u.id+'">&#9876; Attack it with '+cur.c.n+' ('+effAtk(cur)+' damage)</button>';
  } else if(u===cur){
    cap = 'Tap an enemy card to attack it'+(canAbil(u)?', or:':'.');
    if(canAbil(u)) btn += '<button class="btn abil" data-a="cmd" data-v="ability">&#10022; Use Power: '+u.c.an+'</button>';
  }
  return {btn:btn, cap:cap};
}
function cardReason(c){
  var w = G.wait, u = G.cur, t = viewer();
  if(!u || u.team!==t || !w || w.kind!=='cmd') return 'You can play this during one of your turns.';
  if(G.cardPlayed) return 'You already played a card this turn (one per turn).';
  return 'There&rsquo;s no valid target for this card right now.';
}
function zoomBlock(){
  var z = G.zoom, html = '', cap = '', btn = '';
  if(z && z.k==='u'){
    var u = unitById(z.id);
    if(u && hidden(u)){ html = '<div class="card big">'+backFace()+'</div>'; cap = 'Face-down. Revealed when it first acts.'; }
    else if(u){
      var a = effAtk(u);
      html = '<div class="card big'+(u.ko?' ko':'')+'">'+charFace(u.c, {atk:a, hp:u.hp, spd:effSpd(u), atkCls:a>u.atk?' bu':a<u.atk?' bd':'', hpCls:u.hp<u.max?' hurt':''})+'</div>';
      cap = pname(u.team)+' &middot; HP '+u.hp+'/'+u.max+(u.ko?' &middot; knocked out':u.cancelled?' &middot; Power blocked':u.used?' &middot; Power used':' &middot; Power ready');
    }
    if(u){ var ua = unitActions(u); btn = ua.btn; if(ua.cap) cap = ua.cap; }
  } else if(z && z.k==='c'){
    var c = G.hands[viewer()].filter(function(c){ return c.uid===z.uid; })[0];
    if(c){
      html = '<div class="card big">'+actFace(c.n)+'</div>';
      btn = canPlayNow(c) ? '<button class="btn gold" data-a="play" data-v="'+c.uid+'">Play this card</button>' : '';
      cap = canPlayNow(c) ? '' : cardReason(c);
    }
  } else if(z && z.k==='ci'){
    html = '<div class="card big">'+charFace(chars[z.ci])+'</div>';
  }
  if(!html) return '<div class="zoom empty"><div class="card big ghost">'+backFace()+'</div><p class="cap">Tap any card to inspect it.</p></div>';
  return '<div class="zoom">'+html+(cap?'<p class="cap">'+cap+'</p>':'')+btn+'</div>';
}
function orderHtml(){
  var q = queue();
  var items = (G.cur && !G.cur.ko ? [G.cur] : []).concat(q.filter(function(u){ return u!==G.cur; }));
  return items.map(function(u){
    var hid = hidden(u);
    return '<li class="t'+u.team+(u===G.cur?' now':'')+'"><span>'+(hid?'Face-down card':u.c.n)+'</span><b>'+(hid?'?':effSpd(u))+'</b></li>';
  }).join('') || '<li class="muted">Round complete</li>';
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
    var you = CFG.mode==='cpu', title, sub;
    if(G.winner<0){ title='Stalemate'; sub='Nobody claims the grant.'; }
    else if(you){ title = G.winner===0 ? 'Victory' : 'Defeat'; sub = G.winner===0 ? 'The grant is yours.' : 'The CPU takes the grant.'; }
    else { title = pname(G.winner)+' Wins'; sub = 'The grant is theirs.'; }
    o += '<div class="ov soft"><div class="panel over'+(you&&G.winner===1?' lose':'')+'"><div class="eyebrow">Round '+G.round+'</div><h2 class="vt">'+title+'</h2><p>'+sub+'</p>'
      +'<div class="row"><button class="btn gold big" data-a="start">Shuffle Up Again</button><button class="lnk" data-a="close">View board</button><button class="lnk" data-a="menu">Menu</button></div></div></div>';
  }
  if(G.zoomOpen && !o) o += '<div class="ov zoomov" data-a="unzoom">'+zoomBlock()+'</div>';
  return o;
}
function rulesHtml(){
  if(!G.showRules) return '';
  return '<div class="ov" data-a="rulesoff"><div class="panel rules" data-a="noop"><div class="eyebrow">How to play</div><h2>Travis: The Game</h2><ol>'
   +'<li><b>Goal:</b> knock out every one of your opponent&rsquo;s characters.</li>'
   +'<li><b>The deal:</b> each player gets '+CFG.size+' random characters, face-down. Flip yours over. Enemy cards flip when they take their first turn.</li>'
   +'<li><b>Turns:</b> each round, every character takes one turn. The fastest go first (the number in the top corner).</li>'
   +'<li><b>On a turn, do one thing:</b><br>&#9876; <b>Attack</b>: tap an enemy to deal damage equal to the red number.<br>&#10022; <b>Power</b>: use the special move written on the card. Each character can only use it once per game.</li>'
   +'<li><b>Action cards:</b> you draw one each turn (you can hold 3). You may play one per turn, as well as attacking.</li>'
   +'<li><b>Health:</b> the green number. At 0, that character is knocked out.</li></ol>'
   +'<p class="kw"><b>Shield</b> blocks all damage from the next hit. <b>Skip</b> means that character misses its next turn.</p>'
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
   +'<div class="side"><div class="sl">Turn order</div><ol class="order">'+orderHtml()+'</ol></div>'
   +'<div class="side"><div class="sl">Battle log</div><div class="log">'+G.log.map(function(l){ return '<p class="'+l.cls+'">'+l.h+'</p>'; }).join('')+'</div></div>'
   +'</aside></div>'
   +(G.error?'<pre class="err">'+G.error+'</pre>':'')
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
   +'<div class="side"><div class="sl">Quick rules</div><ul class="how"><li>On each turn a character <b>Attacks</b> (red number = damage) or uses its <b>Power</b> (once per game).</li><li>Fastest characters go first (top-corner number).</li><li>Green number is health. Knock out all enemies to win.</li><li>Enemy cards stay face-down until they act.</li></ul><button class="btn sm" data-a="rules">Full rules</button></div>'
   +'</aside></div>' + o;
}
function renderMenu(){
  var on = function(k,v){ return String(CFG[k])===String(v) ? ' on' : ''; };
  var o = function(k,v,label,sub){ return '<button class="choice'+on(k,v)+'" data-a="cfg" data-k="'+k+'" data-v="'+v+'"><b>'+label+'</b><span>'+sub+'</span></button>'; };
  var hero = ['Beer Frog Knox','Blue Suit Knox','Doctor Knox','Leopard Seal Knox','Family Man Knox'].map(function(n,i){
    return '<div class="card hero" style="'+fanStyle(i,5,11)+'">'+charFace(chars[CHAR[n]])+'</div>';
  }).join('');
  return '<div class="menu"><div class="fan">'+hero+'</div>'
   +'<h1 class="logo"><span class="l1">Travis</span><span class="l2">The Game</span></h1>'
   +'<p class="tag">Sixteen specimens of Travis Knox. A shuffled deck. You never know who you&rsquo;ll get.</p>'
   +'<div class="group"><div class="gl">Opponent</div><div class="choices">'
   + o('mode','cpu','Versus CPU','Battle the computer') + o('mode','hot','Two Players','Pass the device')
   +'</div></div>'
   +'<div class="group"><div class="gl">Format</div><div class="choices">'
   + o('size','6','6 v 6','Full squad') + o('size','4','4 v 4','Medium') + o('size','3','3 v 3','Quick game')
   +'</div></div>'
   +'<button class="btn gold big" data-a="start">Shuffle Up &amp; Deal</button>'
   +'<p class="foot"><button class="lnk" data-a="rules">How to play</button> <a href="index.html" target="_blank" rel="noopener">Printable deck</a></p>'
   +'</div>';
}

function paint(){
  var t = now();
  G.fx = (G.fx||[]).filter(function(f){ return t-f.t0 <= f.dur; });
  root.innerHTML = (G.phase==='deal' ? renderDeal() : G.phase==='battle' ? renderBattle() : renderMenu()) + rulesHtml();
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
    case 'cfg': CFG[el.getAttribute('data-k')] = el.getAttribute('data-k')==='size' ? +v : v; render(); break;
    case 'start': startGame(); break;
    case 'menu': G = {phase:'menu', log:[], fx:[]}; render(); break;
    case 'close': G.hideOver = true; render(); break;
    case 'unzoom': G.zoomOpen = false; render(); break;
    case 'dealpass': G.deal.pass = false; G.deal.picks[G.deal.turn].forEach(function(_,i){ fxc('d'+G.deal.turn+'_'+i, 'dealt', 650, i*160); }); render(); break;
    case 'flip': flipDealt(+v); break;
    case 'revealall': revealAll(); break;
    case 'mull': mulligan(); break;
    case 'dealdone': dealDone(); break;
    case 'unit':
      if(w && w.kind==='unit' && w.ids.indexOf(+v)>=0){ G.zoomOpen = false; w.res(unitById(+v)); }
      else { G.zoom = {k:'u', id:+v}; G.zoomOpen = true; render(); }
      break;
    case 'hand': {
      var uid = +v, h = G.hands[viewer()], i = h.map(function(c){ return c.uid; }).indexOf(uid);
      if(i<0) break;
      if(G.sel===uid && canPlayNow(h[i]) && w && w.kind==='cmd'){ G.sel=null; G.zoom=null; G.zoomOpen=false; w.res({t:'card', i:i}); }
      else { G.sel = uid; G.zoom = {k:'c', uid:uid}; G.zoomOpen = true; render(); }
      break;
    }
    case 'play': {
      var h2 = G.hands[viewer()], j = h2.map(function(c){ return c.uid; }).indexOf(+v);
      if(j>=0 && w && w.kind==='cmd' && canPlayNow(h2[j])){ G.sel=null; G.zoom=null; G.zoomOpen=false; w.res({t:'card', i:j}); }
      break;
    }
    case 'cmd': if(w && w.kind==='cmd'){ G.zoomOpen = false; w.res({t:v}); } break;
    case 'strikeat': if(w && w.kind==='cmd'){ G.zoomOpen = false; w.res({t:'strike', target:+v}); } break;
    case 'opt': if(w && w.kind==='opt') w.res(+v); break;
    case 'cancel': if(w && w.cancel) w.res(w.kind==='opt' ? -1 : null); break;
    case 'pass': if(w && w.kind==='pass') w.res(); break;
    case 'rules': G.showRules = true; render(); break;
    case 'rulesoff': G.showRules = false; render(); break;
    case 'noop': break;
  }
}

var api = {CFG:CFG, state:function(){ return G; }, startGame:startGame,
  mount:function(el){ root = el; el.addEventListener('click', onClick); render(); }};
if(typeof window!=='undefined') window.TravisGame = api;
})();
