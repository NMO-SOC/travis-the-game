/* Travis: The Game — browser engine. Depends on cards.js (S, chars, acts). */
(function(){
'use strict';

var HAND_LIMIT = 3;
var ABORT_ROUND = {abort:'round'}, ABORT_OVER = {abort:'over'}, ABORT_DEAD = {abort:'dead'};
var CFG = {mode:'cpu', size:6, speed:1};
var G = {phase:'menu', log:[], fx:[]};

var CHAR = {}; chars.forEach(function(c,i){ CHAR[c.n] = i; });
var ACTD = {}; acts.forEach(function(a){ ACTD[a.n] = a; });

/* ---------------- helpers ---------------- */
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function d6(){ return 1+Math.floor(Math.random()*6); }
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

function effAtk(u){ return Math.max(1, u.atk + u.atkGame + u.atkRound - 2*G.lowTide); }
function effSpd(u){ return u.spd + u.spdRound; }
function living(t){ return G.teams[t].filter(function(u){ return !u.ko; }); }
function foes(u){ return living(1-u.team); }
function allUnits(){ return G.teams[0].concat(G.teams[1]); }
function unitById(id){ return allUnits().filter(function(u){ return u.id===id; })[0]; }
function queue(){
  return allUnits().filter(function(u){ return !u.ko && !u.acted; })
    .sort(function(a,b){ return effSpd(b)-effSpd(a) || b.hp-a.hp || b.tie-a.tie; });
}
function unacted(t){ return living(t).filter(function(u){ return !u.acted; }); }
function maxMissing(t){ return living(t).reduce(function(m,u){ return Math.max(m, u.max-u.hp); }, 0); }
function now(){ return Date.now(); }

function newUnit(ci, team, hp){
  var c = chars[ci];
  return {id:++G.uid, ci:ci, c:c, team:team, max:c.hp, hp:hp==null?c.hp:hp, atk:c.atk, spd:c.spd,
    ko:false, used:false, cancelled:false, revealed:false, shield:c.n==='The Blue Suit', braced:false, reduce1:false,
    atkGame:0, atkRound:0, spdRound:0, skip:0, detained:false, dlc:false, territorial:false, acted:false, tie:Math.random()};
}

/* ---------------- async plumbing ---------------- */
function delay(ms){
  var g = G;
  var p = CFG.speed ? new Promise(function(r){ setTimeout(r, ms*CFG.speed); }) : Promise.resolve();
  return p.then(function(){ if(g!==G) throw ABORT_DEAD; });
}
function checkInt(){
  if(G.over) throw ABORT_OVER;
  if(G.interrupt){ G.interrupt=false; throw ABORT_ROUND; }
}
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
function pickOpt(team, prompt, opts, ai, cancel){
  if(!opts.length) return Promise.resolve(-1);
  if(isCPU(team)) return sleep(350).then(function(){ return bestIdx(opts, ai); });
  return wait('opt', {team:team, prompt:prompt, opts:opts, cancel:!!cancel});
}

/* ---------------- log & fx ---------------- */
function log(h, cls){
  h = h.replace(/(>You<\/b>) (plays|discards|draws)/g, function(m, you, verb){ return you+' '+verb.slice(0,-1); });
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
function damage(t, amt, src){
  if(t.ko) return Promise.resolve(0);
  if(t.dlc){ log(nm(t)+' is sheltering in the DLC &mdash; no damage.'); fx(t,'0','blk'); return Promise.resolve(0); }
  if(t.shield && !t.cancelled){ t.shield=false; log('<i>Cut of the Cloth</i> &mdash; '+nm(t)+' takes no damage. Not a wrinkle.'); fx(t,'0','blk'); return Promise.resolve(0); }
  var red = 0, d = amt;
  if(t.braced){ red+=3; t.braced=false; }
  if(t.reduce1) red+=1;
  if(red) d = Math.max(1, d-red);
  t.hp -= d;
  fx(t, '&minus;'+d, 'dmg');
  log(nm(t)+' takes <b>'+d+'</b> damage'+(red?' (reduced from '+amt+')':'')+'.');
  if(t.hp<=0) return knockOut(t, src).then(function(){ return d; });
  return Promise.resolve(d);
}
function heal(u, n){
  if(u.ko || u.hp>=u.max) return 0;
  var before = u.hp; u.hp = Math.min(u.max, u.hp+n);
  fx(u, '+'+(u.hp-before), 'heal');
  log(nm(u)+' heals <b>'+(u.hp-before)+'</b> HP.');
  return u.hp-before;
}
function clearBuffs(u){
  u.braced=false; u.reduce1=false; u.atkGame=0; u.atkRound=0; u.spdRound=0;
  u.territorial=false; u.skip=0; u.detained=false; u.dlc=false; u.shield=false;
}
async function knockOut(t, src){
  reveal(t);
  t.ko=true; t.hp=0; clearBuffs(t);
  fxc('u'+t.id, 'die', 900);
  log(nm(t)+' is <b>knocked out</b>.', 'ko');
  var passive = !t.cancelled;
  if(passive && t.c.n==='Knox Emeritus' && src && !src.ko){
    log('<i>Tenure</i> &mdash; '+nm(t)+' has the last word.');
    await damage(src, 6, t);
  }
  if(passive && t.c.n==='Tadpole'){
    var cands = G.teams[t.team].filter(function(u){ return u.ko && u!==t; });
    if(cands.length){
      var r = await pickUnit(t.team, '<i>Metamorphosis</i> &mdash; '+pname(t.team)+', bring back which character with 8 HP?', cands, function(u){ return u.max+u.atk*2; }, false);
      r.ko=false; r.hp=8; r.acted=true;
      fx(r,'+8','heal');
      log('<i>Metamorphosis</i> &mdash; '+nm(r)+' is back with 8 HP.');
    }
  }
  checkOver();
}
function checkOver(){
  var a = living(0).length, b = living(1).length;
  if(a && b) return;
  G.over = true; G.winner = a ? 0 : b ? 1 : -1;
  G.cur = null;
  log(G.winner<0 ? 'Both teams are knocked out. A draw &mdash; the grant is split.' : pn(G.winner)+' '+(CFG.mode==='cpu'&&G.winner===0?'win':'wins')+' the grant!', 'win');
  throw ABORT_OVER;
}
function strikeTargets(u){
  var f = foes(u);
  var terr = f.filter(function(e){ return e.territorial && !e.cancelled; });
  return terr.length ? terr : f;
}
function strike(u, e){
  fxc('u'+u.id, 'lunge', 450);
  log(nm(u)+' strikes '+nm(e)+'.');
  return damage(e, effAtk(u), u);
}
function brace(u){
  log(nm(u)+' braces.');
  heal(u, 2); u.braced = true; render();
}
function strikeScore(u, e){
  var a = effAtk(u);
  return (e.dlc?-50:0) + (e.shield&&!e.cancelled?-6:0) + (e.hp<=a?40+effAtk(e):0) + effAtk(e)*1.5 - e.hp*0.4;
}

/* ---------------- abilities ---------------- */
function aName(n){ return '<i>'+chars[CHAR[n]].an+'</i>'; }
var PASSIVE_THREATS = ['Tadpole','Knox Emeritus'];

var AB = {
 'Dr. Travis Knox':{
  can:function(u){ return foes(u).some(function(e){ return !e.cancelled; }); },
  ai:function(u){ return foes(u).some(function(e){ return !e.cancelled && (!e.used || PASSIVE_THREATS.indexOf(e.c.n)>=0 || e.shield); }) ? 5 : 0; },
  run:async function(u){
   var t = await pickUnit(u.team, 'Peer Review &mdash; cancel which enemy&rsquo;s ability?', foes(u).filter(function(e){ return !e.cancelled; }),
     function(e){ return (e.used?0:5)+(PASSIVE_THREATS.indexOf(e.c.n)>=0?4:0)+(e.shield?3:0)+effAtk(e)*0.3; }, true);
   if(!t) return false;
   t.cancelled=true; t.shield=false;
   log(nm(u)+' &mdash; '+aName('Dr. Travis Knox')+': '+nm(t)+'&rsquo;s ability is cancelled for the rest of the game.');
   return true;
  }},
 'Director of Students':{
  can:function(u){ return foes(u).length>0; },
  ai:function(){ return 4.5; },
  run:async function(u){
   var t = await pickUnit(u.team, 'See Me After Class &mdash; who skips their next turn?', foes(u), function(e){ return effAtk(e)*2 + (e.skip?-10:0); }, true);
   if(!t) return false;
   t.skip++;
   log(nm(u)+' &mdash; '+aName('Director of Students')+': '+nm(t)+' will skip its next turn.');
   return true;
  }},
 'The Blue Suit':{
  can:function(){ return true; },
  ai:function(){ return G.round<=4 ? 6 : 3; },
  run:async function(u){ u.atkGame+=2; log(nm(u)+' &mdash; '+aName('The Blue Suit')+': +2 ATK for the rest of the game.'); return true; }},
 'Beer Frog':{
  can:function(u){ return foes(u).length>0; },
  ai:function(u){ return foes(u).length*2.2 + (u.hp<u.max?1:0); },
  run:async function(u){
   log(nm(u)+' &mdash; '+aName('Beer Frog')+': 2 damage to every enemy.');
   var list = foes(u);
   for(var i=0;i<list.length;i++) await damage(list[i], 2, u);
   heal(u, 2);
   return true;
  }},
 'Family Man Knox':{
  can:function(){ return true; },
  ai:function(u){ return Math.max(living(u.team).length*2.2, Math.min(8, maxMissing(u.team)))*0.9; },
  run:async function(u){
   var i = await pickOpt(u.team, 'Huddy &amp; Charlotte &mdash; choose one', [
     {label:'Huddy', sub:'Every character on your team gains +1 ATK for the rest of the game.'},
     {label:'Charlotte', sub:'Heal one friendly character 8 HP.'}],
     function(o,i){ return i===0 ? living(u.team).length*2.2 : Math.min(8, maxMissing(u.team)); }, true);
   if(i<0) return false;
   if(i===0){
     living(u.team).forEach(function(f){ f.atkGame++; });
     log(nm(u)+' &mdash; <i>Huddy</i>: the whole team gains +1 ATK.');
   } else {
     var t = await pickUnit(u.team, 'Charlotte &mdash; heal whom?', living(u.team), function(f){ return f.max-f.hp; }, true);
     if(!t) return false;
     log(nm(u)+' &mdash; <i>Charlotte</i> patches up '+nm(t)+'.');
     heal(t, 8);
   }
   return true;
  }},
 'The Seal Whisperer':{
  can:function(){ return true; },
  ai:function(u){ return living(u.team).filter(function(f){ return !f.reduce1; }).length*1.8; },
  run:async function(u){ living(u.team).forEach(function(f){ f.reduce1=true; }); log(nm(u)+' &mdash; '+aName('The Seal Whisperer')+': your team takes 1 less damage from each source.'); return true; }},
 'The Mixtape':{
  copies:function(u){
   var seen = {};
   return G.usedLog.filter(function(r){
     var n = chars[r.ci].n;
     if(seen[n] || r.owner.cancelled || n==='The Mixtape' || !AB[n] || !AB[n].can(u)) return false;
     seen[n]=true; return true;
   }).map(function(r){ return chars[r.ci].n; });
  },
  can:function(u){ return AB['The Mixtape'].copies(u).length>0; },
  ai:function(u){ return Math.max.apply(null, AB['The Mixtape'].copies(u).map(function(n){ return AB[n].ai(u); }).concat([0])); },
  run:async function(u){
   var list = AB['The Mixtape'].copies(u);
   var i = await pickOpt(u.team, 'Track Seven &mdash; copy which ability?', list.map(function(n){ return {label:chars[CHAR[n]].an, sub:'<b>'+n+'</b> &mdash; '+chars[CHAR[n]].a}; }),
     function(o,i){ return AB[list[i]].ai(u); }, true);
   if(i<0) return false;
   log(nm(u)+' puts on '+aName('The Mixtape')+' and plays '+aName(list[i])+'.');
   return AB[list[i]].run(u);
  }},
 'Chaperone Knox':{
  can:function(){ return true; },
  ai:function(u){ return unacted(1-u.team).filter(function(e){ return AB[e.c.n] && !e.used && !e.cancelled; }).length*1.6; },
  run:async function(u){ G.noAbil=true; log(nm(u)+' &mdash; '+aName('Chaperone Knox')+': no abilities for the rest of this round.'); return true; }},
 'Field Researcher Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(){ return 7; },
  run:async function(u){
   var t = await pickUnit(u.team, 'Tag and Release &mdash; 4 damage and a skipped turn to whom?', foes(u), function(e){ return strikeScore({atk:4,atkGame:0,atkRound:0}, e) + effAtk(e); }, true);
   if(!t) return false;
   log(nm(u)+' &mdash; '+aName('Field Researcher Knox')+' on '+nm(t)+'.');
   await damage(t, 4, u);
   if(!t.ko){ t.skip++; log(nm(t)+' is being &ldquo;processed&rdquo; and will skip its next turn.'); }
   return true;
  }},
 'Fire Drill Knox':{
  can:function(){ return true; },
  ai:function(u){ return (unacted(1-u.team).length - unacted(u.team).length)*2.5; },
  run:async function(u){ log(nm(u)+' &mdash; '+aName('Fire Drill Knox')+'! Everyone out. The round ends now.'); G.roundEnding=true; throw ABORT_ROUND; }},
 'Elephant Seal Knox':{
  can:function(){ return true; },
  ai:function(u){ return living(u.team).length>1 ? 5 : 1; },
  run:async function(u){ u.territorial=true; log(nm(u)+' &mdash; '+aName('Elephant Seal Knox')+': enemy Strikes must target it.'); return true; }},
 'Leopard Seal Knox':{
  can:function(u){ return foes(u).some(function(e){ return !e.acted; }); },
  ai:function(u){ return effAtk(u)*2; },
  run:async function(u){
   var dmg = 2*effAtk(u);
   var t = await pickUnit(u.team, 'Ambush &mdash; '+dmg+' damage to an enemy that hasn&rsquo;t acted yet', foes(u).filter(function(e){ return !e.acted; }),
     function(e){ return strikeScore({atk:dmg,atkGame:0,atkRound:0}, e); }, true);
   if(!t) return false;
   log(nm(u)+' &mdash; '+aName('Leopard Seal Knox')+' on '+nm(t)+'.');
   await damage(t, dmg, u);
   return true;
  }},
 'Staff Meeting Knox':{
  can:function(){ return true; },
  ai:function(u){ return foes(u).length*1.8; },
  run:async function(u){ G.agenda[1-u.team]={from:G.round+1, to:G.round+2}; log(nm(u)+' &mdash; '+aName('Staff Meeting Knox')+': for the next 2 rounds, every enemy takes 1 damage at the start of its turn.'); return true; }},
 'Parent-Teacher Knox':{
  can:function(u){ return foes(u).length>0; },
  ai:function(u){
   var lo = Math.min.apply(null, living(u.team).map(function(f){ return f.hp; }));
   var hi = Math.max.apply(null, foes(u).map(function(e){ return e.hp; }));
   return (hi-lo)/1.5;
  },
  run:async function(u){
   var f = await pickUnit(u.team, 'Concerns Raised &mdash; pick the friendly character to swap', living(u.team), function(f){ return -f.hp; }, true);
   if(!f) return false;
   var e = await pickUnit(u.team, 'Concerns Raised &mdash; swap '+f.c.n+'&rsquo;s HP with which enemy?', foes(u), function(e){ return e.hp; }, true);
   if(!e) return false;
   var h = f.hp; f.hp = e.hp; e.hp = h;
   log(nm(u)+' &mdash; '+aName('Parent-Teacher Knox')+': '+nm(f)+' and '+nm(e)+' swap HP ('+f.hp+' / '+e.hp+').');
   return true;
  }}
};
function canAbil(u){ var a = AB[u.c.n]; return !!a && !u.used && !u.cancelled && !G.noAbil && a.can(u); }
function abilReason(u){
  if(!AB[u.c.n]) return 'Passive only';
  if(u.cancelled) return 'Cancelled';
  if(u.used) return 'Already used';
  if(G.noAbil) return 'Chaperoned this round';
  if(!AB[u.c.n].can(u)) return 'No valid use';
  return '';
}
async function useAbility(u){
  u.used = true;
  fxc('u'+u.id, 'cast', 900);
  var ok;
  try{ ok = await AB[u.c.n].run(u); }
  catch(e){ recordUse(u); throw e; }
  if(ok===false){ u.used=false; return false; }
  recordUse(u); render();
  return true;
}
function recordUse(u){ if(u.c.n!=='The Mixtape') G.usedLog.push({ci:u.ci, owner:u}); }

/* ---------------- action cards ---------------- */
var CARDVAL = {'CAT':5,'Toilet Break (Diary Approved)':3,'Canteen':4,'Low Tide':2,'Detention':1.5,'Excursion':3.5,'DLC':3,'The Great Flood':1.5,
  'Photo Day':2,'Reports':2.5,'CRT':5,'Sports Carnival':1,'Assembly':1.5,'Uniform Check':2,'Yard Duty':3};
function cardOpt(c){ return {label:c.n, sub:ACTD[c.n].a, act:c.n}; }
function buffed(e){ return e.atkGame>0 || e.reduce1 || e.territorial; }

var ACT = {
 'CAT':{
  can:function(t){ return living(1-t).length>0; },
  ai:function(t){ return living(1-t).some(function(e){ return e.hp<=3 && !e.dlc; }) ? 8 : 3.5; },
  run:async function(t){
   var e = await pickUnit(t, 'CAT &mdash; deal 3 damage to whom?', living(1-t), function(e){ return strikeScore({atk:3,atkGame:0,atkRound:0}, e); }, true);
   if(!e) return false;
   log(pn(t)+' plays '+card('CAT')+' on '+nm(e)+'.');
   await damage(e, 3, null); return true;
  }},
 'Toilet Break (Diary Approved)':{
  can:function(t){ return living(t).some(function(f){ return !f.acted && f!==G.cur; }); },
  ai:function(t){ return unacted(t).length ? 3.2 : 0; },
  run:async function(t){
   var f = await pickUnit(t, 'Toilet Break &mdash; which character acts right now?', living(t).filter(function(f){ return !f.acted && f!==G.cur; }), function(f){ return effAtk(f)+(canAbil(f)?3:0); }, true);
   if(!f) return false;
   log(pn(t)+' plays '+card('Toilet Break (Diary Approved)')+': '+nm(f)+' acts out of order.');
   f.acted = true;
   await subTurn(f); return true;
  }},
 'Canteen':{
  can:function(t){ return living(t).length>0; },
  ai:function(t){ return Math.min(6, maxMissing(t)) - 0.5; },
  run:async function(t){
   var f = await pickUnit(t, 'Canteen &mdash; heal whom 6 HP?', living(t), function(f){ return f.max-f.hp; }, true);
   if(!f) return false;
   log(pn(t)+' plays '+card('Canteen')+' for '+nm(f)+'.');
   heal(f, 6); return true;
  }},
 'Low Tide':{
  can:function(){ return true; },
  ai:function(t){
   var sum = function(l){ return l.reduce(function(s,u){ return s+effAtk(u); }, 0); };
   return (sum(unacted(1-t)) - sum(unacted(t)) - (G.acted?0:effAtk(G.cur)))*0.5;
  },
  run:async function(t){ G.lowTide++; log(pn(t)+' plays '+card('Low Tide')+': every character has &minus;2 ATK this round.'); return true; }},
 'Detention':{
  can:function(t){ return living(1-t).length>0; },
  ai:function(t){ return G.hands[1-t].length ? 1.8 : 0.5; },
  run:async function(t){
   var e = await pickUnit(t, 'Detention &mdash; who can&rsquo;t play action cards on their next turn?', living(1-t), function(e){ return e.acted?0:1; }, true);
   if(!e) return false;
   e.detained = true;
   log(pn(t)+' plays '+card('Detention')+' on '+nm(e)+'.'); return true;
  }},
 'Excursion':{
  can:function(t){ return living(t).length>0; },
  ai:function(t){ return (unacted(t).length + (G.acted?0:1))*1.8; },
  run:async function(t){ living(t).forEach(function(f){ f.atkRound+=2; }); log(pn(t)+' plays '+card('Excursion')+': your team has +2 ATK this round.'); return true; }},
 'DLC':{
  can:function(t){ return living(t).length>0; },
  ai:function(t){ var lo = Math.min.apply(null, living(t).map(function(f){ return f.hp; })); return unacted(1-t).length && lo<=8 ? 5 : 0.5; },
  run:async function(t){
   var f = await pickUnit(t, 'DLC &mdash; who shelters this round?', living(t), function(f){ return -f.hp; }, true);
   if(!f) return false;
   f.dlc = true;
   log(pn(t)+' plays '+card('DLC')+': '+nm(f)+' takes no damage this round.'); return true;
  }},
 'The Great Flood':{
  can:function(){ return true; },
  ai:function(t){ return (unacted(1-t).length - unacted(t).length)*1.2; },
  run:async function(t){ log(pn(t)+' plays '+card('The Great Flood')+'. The round ends.'); G.roundEnding=true; throw ABORT_ROUND; }},
 'Photo Day':{
  can:function(t,u){ return !!G.lastCard && G.lastCard!=='Photo Day' && ACT[G.lastCard].can(t,u); },
  ai:function(t,u){ return ACT[G.lastCard].ai(t,u) - 0.5; },
  run:async function(t,u){ log(pn(t)+' plays '+card('Photo Day')+', copying '+card(G.lastCard)+'.'); return ACT[G.lastCard].run(t,u); }},
 'Reports':{
  can:function(t){ return G.hands[1-t].length>0; },
  ai:function(){ return 2.5; },
  run:async function(t){
   var h = G.hands[1-t];
   var i = await pickOpt(t, 'Reports &mdash; '+possessive(1-t)+' hand. Choose one to discard.', h.map(cardOpt), function(o,i){ return CARDVAL[h[i].n]; }, true);
   if(i<0) return false;
   var c = h.splice(i,1)[0]; G.discard.push(c);
   log(pn(t)+' plays '+card('Reports')+': '+pn(1-t)+' discards '+card(c.n)+'.'); return true;
  }},
 'CRT':{
  can:function(t){ return G.teams[t].some(function(u){ return u.ko; }) && G.charDeck.length>0; },
  ai:function(){ return 7; },
  run:async function(t){
   var k = await pickUnit(t, 'CRT &mdash; replace which knocked-out character? A random specimen comes off the top of the deck.', G.teams[t].filter(function(u){ return u.ko; }), null, true);
   if(!k) return false;
   var ci = G.charDeck.shift();
   var nu = newUnit(ci, t, Math.floor(chars[ci].hp/2)); nu.acted = true;
   G.teams[t][G.teams[t].indexOf(k)] = nu;
   fxc('u'+nu.id, 'dealt', 700);
   log(pn(t)+' plays '+card('CRT')+': '+nm(k)+' is replaced by '+nm(nu)+', face-down, with half HP.'); return true;
  }},
 'Sports Carnival':{
  can:function(){ return true; },
  ai:function(){ return 0.6; },
  run:async function(t){ allUnits().forEach(function(u){ if(!u.ko) u.spdRound+=3; }); log(pn(t)+' plays '+card('Sports Carnival')+': +3 SPD for everyone this round.'); return true; }},
 'Assembly':{
  can:function(){ return true; },
  ai:function(t){ return unacted(1-t).length > unacted(t).length+1 ? 2.8 : 0.5; },
  run:async function(t){ G.noStrike=true; log(pn(t)+' plays '+card('Assembly')+': no Strikes for the rest of this round.'); return true; }},
 'Uniform Check':{
  can:function(t){ return living(1-t).some(buffed); },
  ai:function(){ return 3; },
  run:async function(t){
   var e = await pickUnit(t, 'Uniform Check &mdash; strip whose rest-of-game buffs?', living(1-t).filter(buffed), function(e){ return e.atkGame*2+(e.reduce1?2:0)+(e.territorial?3:0); }, true);
   if(!e) return false;
   e.atkGame=0; e.reduce1=false; e.territorial=false;
   log(pn(t)+' plays '+card('Uniform Check')+': '+nm(e)+' loses its buffs.'); return true;
  }},
 'Yard Duty':{
  can:function(){ return G.deck.length>0; },
  ai:function(){ return 3; },
  run:async function(t){
   var drawn = G.deck.splice(-2).reverse();
   if(drawn.length===2){
     var i = await pickOpt(t, 'Yard Duty &mdash; give which card to '+pname(1-t)+'? You keep the other.', drawn.map(cardOpt), function(o,i){ return -CARDVAL[drawn[i].n]; }, false);
     G.hands[1-t].push(drawn[i]); G.hands[t].push(drawn[1-i]);
   } else G.hands[t].push(drawn[0]);
   log(pn(t)+' plays '+card('Yard Duty')+': draws '+drawn.length+(drawn.length===2?' and hands one to '+pn(1-t):'')+'.'); return true;
  }}
};
async function playCard(t, i, u){
  var c = G.hands[t][i];
  G.hands[t].splice(i,1);
  var ok;
  try{ ok = await ACT[c.n].run(t,u); }
  catch(e){ G.discard.push(c); if(c.n!=='Photo Day') G.lastCard=c.n; throw e; }
  if(ok===false){ G.hands[t].splice(i,0,c); render(); return false; }
  G.discard.push(c); if(c.n!=='Photo Day') G.lastCard=c.n;
  render(); return true;
}
function canPlayCards(u){ return !G.cardPlayed && !u.detained && !u.ko; }
function playable(t, c, u){ return ACT[c.n].can(t, u); }

function canFlood(t){
  if(G.phase!=='battle' || G.over || !G.cur || G.cur.team===t || isCPU(t)) return false;
  if(!G.hands[t].some(function(c){ return c.n==='The Great Flood'; })) return false;
  if(G.wait) return G.wait.kind!=='pass' && G.wait.team!==t;
  return isCPU(G.cur.team);
}
function floodInterrupt(t){
  if(!canFlood(t)) return;
  var h = G.hands[t], i = h.map(function(c){ return c.n; }).indexOf('The Great Flood');
  G.discard.push(h.splice(i,1)[0]); G.lastCard='The Great Flood';
  G.roundEnding = true;
  log(pn(t)+' plays '+card('The Great Flood')+' out of turn! The round ends.');
  if(G.wait) G.wait.rej(ABORT_ROUND); else G.interrupt = true;
}

/* ---------------- turns ---------------- */
async function humanTurn(u, sub){
  while(true){
    if(u.ko || G.over) return;
    var cardsOk = !sub && canPlayCards(u) && G.hands[u.team].some(function(c){ return playable(u.team,c,u); });
    if(G.acted && !cardsOk) return;
    var cmd = await wait('cmd', {team:u.team, sub:sub});
    if(cmd.t==='end') return;
    if(cmd.t==='strike' && !G.acted && !G.noStrike){
      var e = await pickUnit(u.team, 'Strike with '+u.c.n+' for '+effAtk(u)+' &mdash; choose a target', strikeTargets(u), null, true);
      if(!e) continue;
      G.acted = true; await strike(u, e);
    } else if(cmd.t==='brace' && !G.acted){
      G.acted = true; brace(u);
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
  var opts = [];
  if(canAbil(u)) opts.push({k:'ab', s:AB[u.c.n].ai(u)});
  var tg = strikeTargets(u);
  if(!G.noStrike && tg.length){
    var a = effAtk(u), kill = tg.some(function(e){ return e.hp<=a && !e.dlc; });
    opts.push({k:'st', s:a+(kill?6:0)});
  }
  // Late in the game the CPU stops bracing, so two tanky survivors can't stall forever.
  if(G.round<12 || G.noStrike || !tg.length) opts.push({k:'br', s:(u.hp<=6 && u.hp<u.max && !u.braced) ? 4 : (G.noStrike ? 2 : 0.5)});
  opts.forEach(function(o){ o.s += Math.random()*1.5; });
  opts.sort(function(a,b){ return b.s-a.s; });
  for(var i=0;i<opts.length;i++){
    var o = opts[i];
    if(o.k==='ab'){ if(await useAbility(u)) return; }
    else if(o.k==='st'){ await strike(u, best(tg, function(e){ return strikeScore(u,e); })); return; }
    else { brace(u); return; }
  }
}
async function cpuTurn(u){
  await sleep(650);
  await cpuCard(u, 3);
  if(!G.acted && !u.ko){ G.acted = true; await cpuAct(u); }
  await cpuCard(u, 2.6);
}
async function subTurn(f){
  var s = {cur:G.cur, acted:G.acted, card:G.cardPlayed};
  G.cur=f; G.acted=false; G.cardPlayed=true; G.sub=true;
  reveal(f);
  try{
    if(f.skip>0){ f.skip--; log(nm(f)+' was due to skip, so it does nothing.'); }
    else if(isCPU(f.team)) await cpuAct(f);
    else await humanTurn(f, true);
  } finally { G.cur=s.cur; G.acted=s.acted; G.cardPlayed=s.card; G.sub=false; }
}
async function cleanup(u){
  u.detained = false;
  var t = u.team, h = G.hands[t];
  while(h.length>HAND_LIMIT){
    var i = await pickOpt(t, 'Hand limit is '+HAND_LIMIT+' &mdash; discard a card', h.map(cardOpt), function(o,i){ return -CARDVAL[h[i].n]; }, false);
    var c = h.splice(i,1)[0]; G.discard.push(c);
    log(pn(t)+' discards down to '+HAND_LIMIT+'.');
  }
}
async function passScreen(t){
  if(CFG.mode!=='hot' || G.lastHuman===t) return;
  G.lastHuman = t;
  await wait('pass', {team:t});
}
function draw(t){
  if(!G.deck.length) return;
  var c = G.deck.pop();
  G.hands[t].push(c); fxc('c'+c.uid, 'drawn', 650);
  render();
}

async function takeTurn(u){
  G.cur=u; G.acted=false; G.cardPlayed=false; u.acted=true; G.sel=null;
  if(!isCPU(u.team)) await passScreen(u.team);
  checkInt();
  reveal(u);
  if(!hidden(u)) G.zoom = {k:'u', id:u.id};
  log(pn(u.team)+' &middot; '+nm(u)+' is up.', 'turn');
  var ag = G.agenda[u.team];
  if(ag && G.round>=ag.from && G.round<=ag.to){ log('<i>Agenda Item 14</i> drags on&hellip;'); await damage(u, 1, null); }
  if(!u.ko){
    draw(u.team);
    if(u.skip>0){ u.skip--; G.acted=true; log(nm(u)+' skips this turn.'); }
    if(isCPU(u.team)) await cpuTurn(u); else await humanTurn(u, false);
  }
  await cleanup(u);
  G.cur = null;
  if(!u.ko) fxc('u'+u.id, 'tapanim', 450);
}
function startRound(){
  G.round++;
  allUnits().forEach(function(u){ if(u.acted && !u.ko) fxc('u'+u.id, 'untap', 450); u.acted=false; u.tie=Math.random(); });
  log('Round '+G.round, 'round');
}
function endRound(){
  allUnits().forEach(function(u){ u.atkRound=0; u.spdRound=0; u.dlc=false; });
  G.noAbil=false; G.noStrike=false; G.lowTide=0; G.roundEnding=false; G.interrupt=false;
}
async function gameLoop(){
  var g = G;
  try{
    while(true){
      startRound();
      await delay(250);
      while(!G.roundEnding){
        var u = queue()[0];
        if(!u) break;
        try{ await takeTurn(u); }
        catch(e){
          if(e!==ABORT_ROUND) throw e;
          G.roundEnding = true; G.interrupt = false;
          try{ await cleanup(u); } catch(e2){ if(e2!==ABORT_ROUND) throw e2; }
          G.cur = null;
        }
      }
      endRound();
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
  G.discard=[]; G.hands=[[],[]]; G.usedLog=[]; G.agenda=[null,null]; G.lastCard=null;
  G.lowTide=0; G.noAbil=false; G.noStrike=false; G.roundEnding=false; G.interrupt=false; G.lastHuman=null;
  var n = CFG.size>=4 ? 3 : 2;
  for(var k=0;k<n;k++){ for(var t=0;t<2;t++){ var c=G.deck.pop(); G.hands[t].push(c); fxc('c'+c.uid, 'drawn', 650, k*200); } }
  log('The specimens take the field, face-down. Each is revealed when it first acts.');
  gameLoop();
}

/* ---------------- card faces ---------------- */
var COLOR = {
  'Dr. Travis Knox':'blue','The Seal Whisperer':'blue','Field Researcher Knox':'blue','Elephant Seal Knox':'blue',
  'Director of Students':'white','Chaperone Knox':'white','Staff Meeting Knox':'white','Parent-Teacher Knox':'white',
  'The Blue Suit':'black','Leopard Seal Knox':'black','Knox Emeritus':'black',
  'Family Man Knox':'red','The Mixtape':'red','Fire Drill Knox':'red',
  'Beer Frog':'green','Tadpole':'green'
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
   +'<div class="tx"><p><b>'+c.an+'.</b> '+c.a+'</p><p class="fl">'+c.f+'</p></div>'
   +'<div class="gem atk'+(o.atkCls||'')+'" title="Attack">'+(o.atk!=null?o.atk:c.atk)+'</div>'
   +'<div class="gem hp'+(o.hpCls||'')+'" title="Health">'+(o.hp!=null?o.hp:c.hp)+'</div>'
   +'</div>';
}
function actFace(n){
  var a = ACTD[n], inst = a.t==='Instant';
  return '<div class="face f-gold">'
   +'<div class="tl"><span class="tn">'+n+'</span><span class="gem spd" title="'+a.t+'">'+(inst?'&#9889;':'&#8635;')+'</span></div>'
   +'<div class="art a-gold">'+art(a.i)+'</div>'
   +'<div class="ty">'+(inst?'Instant':'Round Effect')+' &mdash; Action</div>'
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
  if(u.shield && !u.cancelled && !hidden(u)) c.push(['Suit intact','g']);
  if(u.braced) c.push(['Braced','g']);
  if(u.reduce1) c.push(['Blubber','g']);
  if(u.dlc) c.push(['In the DLC','g']);
  if(u.territorial) c.push(['Territorial','b']);
  if(u.skip>0) c.push(['Skips turn','r']);
  if(u.detained) c.push(['Detention','r']);
  if(u.cancelled) c.push(['Peer-reviewed','r']);
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
    body = charFace(u.c, {atk:a, hp:u.hp, spd:effSpd(u), atkCls:a>u.atk?' bu':a<u.atk?' bd':'', spdCls:u.spdRound?' bu':'',
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
  return !!(w && w.kind==='cmd' && u && u.team===t && !G.sub && canPlayCards(u) && playable(t, c, u));
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
  var flood = canFlood(t) ? '<button class="btn flood" data-a="flood" data-v="'+t+'">&#127754; Play The Great Flood</button>' : '';
  var ag = G.agenda[t] && G.round<=G.agenda[t].to ? '<span class="chip r">Agenda Item 14 &middot; rounds '+G.agenda[t].from+'&ndash;'+G.agenda[t].to+'</span>' : '';
  return '<div class="plate '+side+' t'+t+(act?' active':'')+'"><span class="av">'+art(t?'lseal':'seal')+'</span>'
   +'<span class="pinfo"><b>'+pname(t)+'</b><small>'+alive+' of '+G.teams[t].length+' standing</small></span>'
   + ag + flood + (side==='top' ? oppHand(t) : '') + '</div>';
}
function flags(){
  var f = [];
  if(G.lowTide) f.push('Low Tide &minus;'+(2*G.lowTide)+' ATK');
  if(G.noStrike) f.push('Assembly: no Strikes');
  if(G.noAbil) f.push('Chaperoned: no abilities');
  return f.map(function(x){ return '<span class="flag">'+x+'</span>'; }).join('');
}
function statusLine(){
  var w = G.wait;
  if(G.over) return G.winner<0 ? 'A draw.' : pname(G.winner)+(CFG.mode==='cpu'&&G.winner===0?' win!':' wins!');
  if(w && w.kind==='unit') return '<span class="who t'+w.team+'">'+pname(w.team)+':</span> '+w.prompt+(w.cancel?' <button class="lnk" data-a="cancel">Cancel</button>':'');
  if(w && w.kind==='opt') return '<span class="who t'+w.team+'">'+pname(w.team)+'</span> is choosing&hellip;';
  if(G.cur && w && w.kind==='cmd'){
    var u = G.cur;
    if(G.sub) return nm(u)+' acts out of order. Choose its action.';
    if(!G.acted) return nm(u)+' is ready. Choose an action'+(canPlayCards(u)?' and play up to one card.':'.');
    return 'Action done. Play a card or end the turn.';
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
   +'<button class="btn act"'+dis(G.acted||G.noStrike||!strikeTargets(u).length)+' data-a="cmd" data-v="strike"><i>&#9876;</i><b>Strike</b><small>'+(G.noStrike?'Assembly':'Deal '+effAtk(u))+'</small></button>'
   +'<button class="btn act"'+dis(G.acted)+' data-a="cmd" data-v="brace"><i>&#128737;</i><b>Brace</b><small>Heal 2 &middot; &minus;3 next hit</small></button>'
   +'<button class="btn act abil"'+dis(G.acted||!canAbil(u))+' data-a="cmd" data-v="ability"><i>&#10022;</i><b>'+u.c.an+'</b><small>'+(r||'Once per game')+'</small></button>'
   +'<button class="btn end" data-a="cmd" data-v="end"><b>'+(G.acted?'End Turn':'Pass')+'</b></button>'
   +'</div>';
}
function zoomBlock(){
  var z = G.zoom, html = '', cap = '', btn = '';
  if(z && z.k==='u'){
    var u = unitById(z.id);
    if(u && hidden(u)){ html = '<div class="card big">'+backFace()+'</div>'; cap = 'Face-down. Revealed when it first acts.'; }
    else if(u){
      var a = effAtk(u);
      html = '<div class="card big'+(u.ko?' ko':'')+'">'+charFace(u.c, {atk:a, hp:u.hp, spd:effSpd(u), atkCls:a>u.atk?' bu':a<u.atk?' bd':'', hpCls:u.hp<u.max?' hurt':''})+'</div>';
      cap = pname(u.team)+' &middot; HP '+u.hp+'/'+u.max+(u.ko?' &middot; knocked out':u.cancelled?' &middot; ability cancelled':u.used?' &middot; ability used':AB[u.c.n]?' &middot; ability ready':' &middot; passive');
    }
  } else if(z && z.k==='c'){
    var c = G.hands[viewer()].filter(function(c){ return c.uid===z.uid; })[0];
    if(c){
      html = '<div class="card big">'+actFace(c.n)+'</div>';
      btn = canPlayNow(c) ? '<button class="btn gold" data-a="play" data-v="'+c.uid+'">Play '+c.n+'</button>' : '';
      cap = canPlayNow(c) ? '' : 'Playable on your turn, one card per turn.';
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
function topbar(extra){
  return '<header class="bar"><div class="brand">Travis <span>The Game</span></div><div class="meta">'+(extra||'')+'</div>'
   +'<div class="btns"><a class="btn sm" href="index.html" target="_blank" rel="noopener">Rules</a><button class="btn sm" data-a="menu">Menu</button></div></header>';
}
function renderBattle(){
  var me = viewer(), op = 1-me;
  return topbar('Round <b>'+G.round+'</b>'+flags())
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
   +'<div class="side"><div class="sl">How it works</div><ul class="how"><li>Specimens are shuffled and dealt at random.</li><li>Your opponent&rsquo;s cards stay face-down until each one first acts.</li><li>Each round, everyone acts once, fastest (the gem in the corner) first.</li><li>Knock out all of their specimens to win.</li></ul></div>'
   +'</aside></div>' + o;
}
function renderMenu(){
  var on = function(k,v){ return String(CFG[k])===String(v) ? ' on' : ''; };
  var o = function(k,v,label,sub){ return '<button class="choice'+on(k,v)+'" data-a="cfg" data-k="'+k+'" data-v="'+v+'"><b>'+label+'</b><span>'+sub+'</span></button>'; };
  var hero = ['Beer Frog','The Blue Suit','Dr. Travis Knox','Leopard Seal Knox','Family Man Knox'].map(function(n,i){
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
   +'<p class="foot"><a href="index.html" target="_blank" rel="noopener">Rules &amp; printable deck</a></p>'
   +'</div>';
}

function paint(){
  var t = now();
  G.fx = (G.fx||[]).filter(function(f){ return t-f.t0 <= f.dur; });
  var y = typeof window!=='undefined' && window.scrollY;
  root.innerHTML = G.phase==='deal' ? renderDeal() : G.phase==='battle' ? renderBattle() : renderMenu();
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
    case 'opt': if(w && w.kind==='opt') w.res(+v); break;
    case 'cancel': if(w && w.cancel) w.res(w.kind==='opt' ? -1 : null); break;
    case 'pass': if(w && w.kind==='pass') w.res(); break;
    case 'flood': floodInterrupt(+v); break;
  }
}

var api = {CFG:CFG, state:function(){ return G; }, startGame:startGame,
  mount:function(el){ root = el; el.addEventListener('click', onClick); render(); }};
if(typeof window!=='undefined') window.TravisGame = api;
})();
