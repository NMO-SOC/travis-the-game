/* Travis: The Game — browser engine. Depends on cards.js (S, chars, acts). */
(function(){
'use strict';

var HAND_LIMIT = 3;
var ABORT_ROUND = {abort:'round'}, ABORT_OVER = {abort:'over'}, ABORT_DEAD = {abort:'dead'};
var CFG = {mode:'cpu', size:3, speed:1};
var G = {phase:'menu', log:[]};

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
function nm(u){ return '<b class="t'+u.team+'">'+u.c.n+'</b>'; }
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
function box(){ return chars.map(function(_,i){ return i; }).filter(function(i){ return !G.drafted[i]; }); }

function newUnit(ci, team, hp){
  var c = chars[ci];
  return {id:++G.uid, ci:ci, c:c, team:team, max:c.hp, hp:hp==null?c.hp:hp, atk:c.atk, spd:c.spd,
    ko:false, used:false, cancelled:false, shield:c.n==='The Blue Suit', braced:false, reduce1:false,
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
function fx(u, text, kind){ (G.fx=G.fx||[]).push({id:u.id, text:text, kind:kind}); }

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
  t.ko=true; t.hp=0; clearBuffs(t);
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
function cardOpt(c){ return {label:c.n, sub:ACTD[c.n].a, icon:ACTD[c.n].i}; }
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
  can:function(t){ return G.teams[t].some(function(u){ return u.ko; }) && box().length>0; },
  ai:function(){ return 7; },
  run:async function(t){
   var k = await pickUnit(t, 'CRT &mdash; replace which knocked-out character?', G.teams[t].filter(function(u){ return u.ko; }), null, true);
   if(!k) return false;
   var b = box();
   var i = await pickOpt(t, 'CRT &mdash; who comes in from the box at half HP?', b.map(function(ci){ var c=chars[ci]; return {label:c.n, sub:'HP '+Math.floor(c.hp/2)+' &middot; ATK '+c.atk+' &middot; SPD '+c.spd+' &mdash; <b>'+c.an+'</b>: '+c.a, icon:c.i}; }),
     function(o,i){ var c=chars[b[i]]; return c.hp*0.3+c.atk*2+c.spd*0.5; }, true);
   if(i<0) return false;
   var nu = newUnit(b[i], t, Math.floor(chars[b[i]].hp/2)); nu.acted = true;
   G.teams[t][G.teams[t].indexOf(k)] = nu; G.drafted[b[i]] = true;
   log(pn(t)+' plays '+card('CRT')+': '+nm(nu)+' replaces '+nm(k)+' with '+nu.hp+' HP.'); return true;
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
  opts.push({k:'br', s:(u.hp<=6 && u.hp<u.max && !u.braced) ? 4 : (G.noStrike ? 2 : 0.5)});
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
function draw(t){ if(G.deck.length){ G.hands[t].push(G.deck.pop()); render(); } }

async function takeTurn(u){
  G.cur=u; G.acted=false; G.cardPlayed=false; u.acted=true; G.inspect=u.id;
  if(!isCPU(u.team)) await passScreen(u.team);
  checkInt();
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
}
function startRound(){
  G.round++;
  allUnits().forEach(function(u){ u.acted=false; u.tie=Math.random(); });
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

/* ---------------- setup & draft ---------------- */
function charVal(ci){ var c=chars[ci]; return c.hp*0.6 + c.atk*2.2 + c.spd*0.6 + Math.random()*4; }
function startDraft(){
  var r0, r1; do { r0=d6(); r1=d6(); } while(r0===r1);
  G = {phase:'draft', log:[], uid:0,
       draft:{pool:chars.map(function(_,i){ return i; }), picks:[[],[]], turn:r0>r1?0:1, rolls:[r0,r1]}};
  render(); cpuDraft();
}
function cpuDraft(){
  var g = G, d = G.draft;
  if(!d || !isCPU(d.turn)) return;
  setTimeout(function(){ if(g===G && G.phase==='draft') draftPick(best(d.pool, charVal)); }, 650*CFG.speed);
}
function draftPick(ci){
  var d = G.draft;
  if(d.pool.indexOf(ci)<0) return;
  d.pool = d.pool.filter(function(x){ return x!==ci; });
  d.picks[d.turn].push(ci);
  if(d.picks[0].length>=CFG.size && d.picks[1].length>=CFG.size) return beginBattle();
  d.turn = 1-d.turn;
  if(d.picks[d.turn].length>=CFG.size) d.turn = 1-d.turn;
  render(); cpuDraft();
}
function beginBattle(){
  var d = G.draft;
  G.phase='battle'; G.round=0; G.over=false; G.winner=null;
  G.teams = d.picks.map(function(p,t){ return p.map(function(ci){ return newUnit(ci,t); }); });
  G.drafted = {}; d.picks[0].concat(d.picks[1]).forEach(function(ci){ G.drafted[ci]=true; });
  G.deck = []; acts.forEach(function(a){ for(var k=0;k<a.x;k++) G.deck.push({uid:G.deck.length, n:a.n}); });
  shuffle(G.deck);
  G.discard=[]; G.hands=[[],[]]; G.usedLog=[]; G.agenda=[null,null]; G.lastCard=null;
  G.lowTide=0; G.noAbil=false; G.noStrike=false; G.roundEnding=false; G.interrupt=false; G.lastHuman=null;
  var deal = CFG.size===4 ? 3 : 2;
  for(var k=0;k<deal;k++){ G.hands[0].push(G.deck.pop()); G.hands[1].push(G.deck.pop()); }
  log('The specimens take the field. Fastest acts first.');
  gameLoop();
}

/* ---------------- rendering ---------------- */
var root = null;
function h(s){ return s; }
function icon(k){ return S[k] || ''; }

function renderMenu(){
  var o = function(k,v,label,sub){ return '<button class="choice'+(CFG[k]===v?' on':'')+'" data-a="cfg" data-k="'+k+'" data-v="'+v+'"><b>'+label+'</b><span>'+sub+'</span></button>'; };
  return '<div class="menu">'
   +'<div class="eyebrow">Field Deck No. 1 &middot; Browser Edition</div>'
   +'<h1>Travis:<br><em>The Game</em></h1>'
   +'<p class="dek">Sixteen documented specimens of Travis Knox square off in turn-based combat. Draft a team, then knock out every one of your opponent&rsquo;s Knoxes to win the grant.</p>'
   +'<div class="group"><div class="gl">Opponent</div><div class="choices">'
   + o('mode','cpu','Computer','Play against the CPU') + o('mode','hot','Two players','Pass-and-play on one screen')
   +'</div></div>'
   +'<div class="group"><div class="gl">Team size</div><div class="choices">'
   + o('size','3','3 v 3','20&ndash;30 minutes') + o('size','4','4 v 4','The longer game')
   +'</div></div>'
   +'<button class="go" data-a="start">Begin the draft &rarr;</button>'
   +'<div class="quick"><div class="gl">How a turn works</div><ul>'
   +'<li>Every living character acts once per round, <b>highest SPD first</b>.</li>'
   +'<li>On a turn you draw an action card, then <b>Strike</b> (deal ATK), <b>Brace</b> (heal 2, next hit &minus;3) or use the character&rsquo;s <b>Ability</b> (once per game).</li>'
   +'<li>You may also play <b>one action card</b> per turn, before or after acting. Hand limit 3.</li>'
   +'<li>Click a character any time to read its card.</li></ul>'
   +'<p><a href="index.html" target="_blank" rel="noopener">Full rules &amp; printable deck &rarr;</a></p></div>'
   +'</div>';
}
function charTile(ci, extra){
  var c = chars[ci];
  return '<div class="plate">'+icon(c.i)+'</div>'
   +'<div class="ct"><div class="cn">'+c.n+'</div><div class="cr">'+c.r+'</div></div>'
   +'<div class="cs"><span>HP <b class="hpv">'+c.hp+'</b></span><span>ATK <b>'+c.atk+'</b></span><span>SPD <b>'+c.spd+'</b></span></div>'
   +'<div class="ca"><b>'+c.an+'</b> '+c.a+'</div>'+(extra||'');
}
function renderDraft(){
  var d = G.draft, human = !isCPU(d.turn);
  var picks = function(t){
    return '<div class="dp t'+t+(d.turn===t?' now':'')+'"><div class="dpn">'+pname(t)+' <span>rolled '+d.rolls[t]+'</span></div><div class="dpl">'
      + (d.picks[t].map(function(ci){ return '<span class="pill">'+chars[ci].n+'</span>'; }).join('') || '<span class="muted">No picks yet</span>')
      + '</div></div>';
  };
  var owner = function(ci){ return d.picks[0].indexOf(ci)>=0 ? 0 : d.picks[1].indexOf(ci)>=0 ? 1 : -1; };
  var tiles = chars.map(function(c,ci){
    var o = owner(ci), free = o<0;
    return '<button class="dt'+(free?'':' taken t'+o)+'" '+(free&&human?'data-a="draft" data-v="'+ci+'"':'disabled')+'>'
      + charTile(ci, free?'':'<div class="own">'+pname(o)+'</div>') + '</button>';
  }).join('');
  return '<div class="draft"><header class="bar"><div class="brand">Travis: <em>The Game</em></div><div class="meta">The Draft</div>'
   +'<div class="btns"><button data-a="menu">Menu</button></div></header>'
   +'<div class="dhead">'+picks(0)+'<div class="dmsg">'+(human ? '<b>'+pname(d.turn)+'</b>, pick a specimen ('+(d.picks[d.turn].length+1)+' of '+CFG.size+')' : 'CPU is choosing&hellip;')+'</div>'+picks(1)+'</div>'
   +'<div class="dgrid">'+tiles+'</div></div>';
}
function chips(u){
  var c = [];
  if(u.ko) return '';
  if(u.shield && !u.cancelled) c.push(['Suit intact','g']);
  if(u.braced) c.push(['Braced &minus;3','g']);
  if(u.reduce1) c.push(['Blubber &minus;1','g']);
  if(u.dlc) c.push(['In the DLC','g']);
  if(u.territorial) c.push(['Territorial','b']);
  if(u.atkGame>0) c.push(['+'+u.atkGame+' ATK','b']);
  if(u.skip>0) c.push(['Skips next turn','r']);
  if(u.detained) c.push(['Detention','r']);
  if(u.cancelled) c.push(['Peer-reviewed','r']);
  else if(u.used) c.push(['Ability used','m']);
  return c.map(function(x){ return '<span class="chip '+x[1]+'">'+x[0]+'</span>'; }).join('');
}
function unitHtml(u){
  var w = G.wait, pick = w && w.kind==='unit' && w.ids.indexOf(u.id)>=0;
  var dim = w && w.kind==='unit' && !pick;
  var a = effAtk(u), am = a>u.atk ? ' bu' : a<u.atk ? ' bd' : '';
  var pct = Math.max(0, Math.min(100, u.hp/u.max*100));
  var cls = 'u t'+u.team+(u.ko?' ko':'')+(G.cur===u?' cur':'')+(pick?' pick':'')+(dim?' dim':'')+(u.acted&&!u.ko&&G.cur!==u?' done':'')+(G.inspect===u.id?' insp':'');
  return '<button class="'+cls+'" data-a="unit" data-v="'+u.id+'" data-id="'+u.id+'">'
   +'<div class="uh">'+u.c.n+'</div>'
   +'<div class="up">'+icon(u.c.i)+'</div>'
   +'<div class="hpb'+(u.hp>u.max?' over':'')+'"><i style="width:'+pct+'%"></i><b>'+u.hp+' / '+u.max+'</b></div>'
   +'<div class="us"><span>ATK <b class="'+am+'">'+a+'</b></span><span>SPD <b'+(u.spdRound?' class="bu"':'')+'>'+effSpd(u)+'</b></span></div>'
   +'<div class="chips">'+chips(u)+'</div>'
   +(u.ko?'<div class="kotag">Knocked out</div>':'')
   +'</button>';
}
function teamRow(t){
  var flood = canFlood(t) ? '<button class="flood" data-a="flood" data-v="'+t+'">Play The Great Flood now</button>' : '';
  var ag = G.agenda[t] && G.round<=G.agenda[t].to ? '<span class="chip r">Agenda Item 14: rounds '+G.agenda[t].from+'&ndash;'+G.agenda[t].to+'</span>' : '';
  return '<section class="team t'+t+'"><div class="th"><span class="pn">'+pname(t)+'</span><span class="hc">'+G.hands[t].length+' card'+(G.hands[t].length===1?'':'s')+' in hand</span>'+ag+flood+'</div>'
   +'<div class="units">'+G.teams[t].map(unitHtml).join('')+'</div></section>';
}
function flags(){
  var f = [];
  if(G.lowTide) f.push('Low Tide: &minus;'+(2*G.lowTide)+' ATK');
  if(G.noStrike) f.push('Assembly: no Strikes');
  if(G.noAbil) f.push('Chaperoned: no abilities');
  return f.map(function(x){ return '<span class="flag">'+x+'</span>'; }).join('');
}
function statusLine(){
  var w = G.wait;
  if(G.over) return G.winner<0 ? 'A draw.' : pname(G.winner)+(CFG.mode==='cpu'&&G.winner===0?' win!':' wins!');
  if(w && w.kind==='unit') return '<span class="who t'+w.team+'">'+pname(w.team)+'</span> '+w.prompt+(w.cancel?' <button class="lnk" data-a="cancel">Cancel</button>':'');
  if(w && w.kind==='opt') return '<span class="who t'+w.team+'">'+pname(w.team)+'</span> is choosing&hellip;';
  if(G.cur && w && w.kind==='cmd'){
    var u = G.cur;
    if(G.sub) return nm(u)+' acts out of order &mdash; choose its action.';
    if(!G.acted) return '<span class="who t'+u.team+'">'+pname(u.team)+'</span> &mdash; '+nm(u)+'&rsquo;s turn. Choose an action'+(canPlayCards(u)?', and optionally play a card.':'.');
    return 'Action done. Play a card or end the turn.';
  }
  if(G.cur && isCPU(G.cur.team)) return nm(G.cur)+' <span class="muted">&mdash; CPU is thinking&hellip;</span>';
  return '&nbsp;';
}
function actionPanel(){
  var w = G.wait;
  if(!(w && w.kind==='cmd' && G.cur)) return '';
  var u = G.cur, ab = AB[u.c.n];
  var dis = function(b){ return b ? ' disabled' : ''; };
  var noTg = !strikeTargets(u).length;
  var r = abilReason(u);
  return '<div class="actions">'
   +'<button class="ab strike"'+dis(G.acted||G.noStrike||noTg)+' data-a="cmd" data-v="strike"><b>Strike</b><span>'+(G.noStrike?'Assembly &mdash; no Strikes':'Deal '+effAtk(u)+' to one enemy')+'</span></button>'
   +'<button class="ab"'+dis(G.acted)+' data-a="cmd" data-v="brace"><b>Brace</b><span>Heal 2 &middot; next hit &minus;3</span></button>'
   +'<button class="ab ability"'+dis(G.acted||!canAbil(u))+' data-a="cmd" data-v="ability"><b>'+u.c.an+'</b><span>'+(r || 'Ability &middot; once per game')+'</span></button>'
   +'<button class="ab end" data-a="cmd" data-v="end"><b>'+(G.acted?'End turn':'Pass')+'</b><span>'+(G.acted?'Next character':'Skip the action')+'</span></button>'
   +'</div>'
   +(ab||u.c.n==='Tadpole'||u.c.n==='Knox Emeritus' ? '<p class="abtext"><b>'+u.c.an+':</b> '+u.c.a+'</p>' : '');
}
function handTeam(){
  if(CFG.mode==='cpu') return 0;
  if(CFG.mode==='sim') return 0;
  if(G.cur && !isCPU(G.cur.team)) return G.cur.team;
  return G.lastHuman==null ? 0 : G.lastHuman;
}
function handHtml(){
  var t = handTeam(), w = G.wait, u = G.cur;
  var canNow = w && w.kind==='cmd' && u && u.team===t && !G.sub && canPlayCards(u);
  var note = !u || u.team!==t ? 'Your cards (playable on your turn)' : G.sub ? 'Cards can&rsquo;t be played during a Toilet Break action' : u.detained ? 'Detention &mdash; no cards this turn' : G.cardPlayed ? 'Card already played this turn' : 'Play one card per turn';
  var cards = G.hands[t].map(function(c,i){
    var ok = canNow && playable(t,c,u), a = ACTD[c.n];
    return '<button class="hc-card'+(ok?' ok':'')+'"'+(ok?' data-a="card" data-v="'+i+'"':' disabled')+'>'
      +'<div class="hci">'+icon(a.i)+'</div><div class="hcn">'+c.n+'</div><div class="hct">'+a.t+'</div><div class="hca">'+a.a+'</div></button>';
  }).join('') || '<div class="muted empty">No cards in hand.</div>';
  return '<section class="hand"><div class="th"><span class="pn">'+possessive(t)+' hand</span><span class="hc">'+note+' &middot; deck '+G.deck.length+'</span></div><div class="cards">'+cards+'</div></section>';
}
function inspectHtml(){
  var u = unitById(G.inspect) || G.cur;
  if(!u) return '<div class="muted">Click a character to read its card.</div>';
  var c = u.c;
  return '<div class="insp-card t'+u.team+'"><div class="ih"><div class="ino">'+pname(u.team)+'</div><h3>'+c.n+'</h3><div class="ir">'+c.r+'</div></div>'
   +'<div class="ip">'+icon(c.i)+'</div>'
   +'<div class="is"><div><span>HP</span><b class="hpv">'+u.hp+'/'+u.max+'</b></div><div><span>ATK</span><b>'+effAtk(u)+'</b></div><div><span>SPD</span><b>'+effSpd(u)+'</b></div></div>'
   +'<div class="ib"><div class="ian">'+c.an+(u.cancelled?' <em>&middot; cancelled</em>':u.used?' <em>&middot; used</em>':'')+'</div><p>'+c.a+'</p><p class="ifl">'+c.f+'</p></div></div>';
}
function orderHtml(){
  var q = queue();
  var items = (G.cur && !G.cur.ko ? [G.cur] : []).concat(q.filter(function(u){ return u!==G.cur; }));
  return items.map(function(u,i){
    return '<li class="t'+u.team+(u===G.cur?' now':'')+'"><span>'+u.c.n+'</span><b>'+effSpd(u)+'</b></li>';
  }).join('') || '<li class="muted">Round over</li>';
}
function modalHtml(){
  var w = G.wait;
  if(w && w.kind==='pass'){
    return '<div class="ov solid"><div class="panel pass"><div class="eyebrow">Pass the device</div><h2 class="t'+w.team+'">'+pname(w.team)+'</h2><p>It&rsquo;s your move. Your hand is hidden until you continue.</p><button class="go" data-a="pass">I&rsquo;m '+pname(w.team)+' &mdash; show my hand</button></div></div>';
  }
  if(w && w.kind==='opt'){
    return '<div class="ov"><div class="panel"><div class="eyebrow t'+w.team+'">'+pname(w.team)+'</div><h2>'+w.prompt+'</h2><div class="opts">'
      + w.opts.map(function(o,i){ return '<button class="opt" data-a="opt" data-v="'+i+'">'+(o.icon?'<span class="oi">'+icon(o.icon)+'</span>':'')+'<span><b>'+o.label+'</b><span>'+o.sub+'</span></span></button>'; }).join('')
      + '</div>'+(w.cancel?'<button class="lnk" data-a="cancel">Cancel</button>':'')+'</div></div>';
  }
  if(G.over){
    var you = CFG.mode==='cpu';
    var title = G.winner<0 ? 'A draw' : you ? (G.winner===0 ? 'You win the grant' : 'The CPU wins the grant') : pname(G.winner)+' wins the grant';
    return '<div class="ov soft"><div class="panel"><div class="eyebrow">Round '+G.round+' &middot; Final</div><h2>'+title+'</h2>'
      +'<p>'+(G.winner<0?'Nobody is left standing.':G.teams[G.winner].filter(function(u){ return !u.ko; }).map(function(u){ return u.c.n; }).join(', ')+' '+(living(G.winner).length===1?'is':'are')+' still standing.')+'</p>'
      +'<div class="row"><button class="go" data-a="start">Rematch</button><button class="lnk" data-a="menu">Menu</button><button class="lnk" data-a="close">View board</button></div></div></div>';
  }
  return '';
}
function renderBattle(){
  var top = CFG.mode==='hot' && handTeam()===1 ? 0 : 1;
  return '<header class="bar"><div class="brand">Travis: <em>The Game</em></div>'
   +'<div class="meta">Round <b>'+G.round+'</b> &middot; Deck <b>'+G.deck.length+'</b> &middot; Discard <b>'+G.discard.length+'</b>'+flags()+'</div>'
   +'<div class="btns"><a href="index.html" target="_blank" rel="noopener">Rules</a><button data-a="menu">New game</button></div></header>'
   +'<div class="layout"><main>'
   + teamRow(top)
   +'<div class="status">'+statusLine()+'</div>'
   + teamRow(1-top)
   + actionPanel()
   + handHtml()
   +'</main><aside>'
   +'<div class="side"><div class="sl">Card</div>'+inspectHtml()+'</div>'
   +'<div class="side"><div class="sl">Turn order &middot; SPD</div><ol class="order">'+orderHtml()+'</ol></div>'
   +'<div class="side"><div class="sl">Field notes</div><div class="log">'+G.log.map(function(l){ return '<p class="'+l.cls+'">'+l.h+'</p>'; }).join('')+'</div></div>'
   +'</aside></div>'
   +(G.error?'<pre class="err">'+G.error+'</pre>':'')
   +(G.hideOver && G.over && !G.wait ? '' : modalHtml());
}
function render(){
  if(!root) return;
  var html = G.phase==='draft' ? renderDraft() : G.phase==='battle' ? renderBattle() : renderMenu();
  root.innerHTML = html;
  if(G.fx && G.fx.length){
    G.fx.forEach(function(f){
      var el = root.querySelector('[data-id="'+f.id+'"]');
      if(el){ var s=document.createElement('span'); s.className='float '+f.kind; s.innerHTML=f.text; el.appendChild(s); }
    });
    G.fx = [];
  }
}

function onClick(e){
  var el = e.target.closest('[data-a]');
  if(!el || el.disabled) return;
  var a = el.getAttribute('data-a'), v = el.getAttribute('data-v'), w = G.wait;
  switch(a){
    case 'cfg': CFG[el.getAttribute('data-k')] = el.getAttribute('data-k')==='size' ? +v : v; render(); break;
    case 'start': startDraft(); break;
    case 'menu': G = {phase:'menu', log:[]}; render(); break;
    case 'close': G.hideOver = true; render(); break;
    case 'draft': if(G.draft && !isCPU(G.draft.turn)) draftPick(+v); break;
    case 'unit':
      if(w && w.kind==='unit' && w.ids.indexOf(+v)>=0) w.res(unitById(+v));
      else { G.inspect = +v; render(); }
      break;
    case 'cmd': if(w && w.kind==='cmd') w.res({t:v}); break;
    case 'card': if(w && w.kind==='cmd') w.res({t:'card', i:+v}); break;
    case 'opt': if(w && w.kind==='opt') w.res(+v); break;
    case 'cancel': if(w && w.cancel) w.res(w.kind==='opt' ? -1 : null); break;
    case 'pass': if(w && w.kind==='pass') w.res(); break;
    case 'flood': floodInterrupt(+v); break;
  }
}

var api = {CFG:CFG, state:function(){ return G; }, startDraft:startDraft,
  mount:function(el){ root = el; el.addEventListener('click', onClick); render(); }};
if(typeof window!=='undefined') window.TravisGame = api;
})();
