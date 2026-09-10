/* Travis: The Game — accounts, collection, decks, packs and live online matches, backed by Supabase.
   Depends on cards.js and the supabase-js UMD build (window.supabase). Exposes window.TravisAccount. */
(function(){
'use strict';

/* The anon key is public by design: every table is protected by row-level security (supabase/schema.sql). */
var SUPABASE_URL = 'https://jzswvzodztjegfanshvi.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6c3d2em9kenRqZWdmYW5zaHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMzE3MzQsImV4cCI6MjEwNDYwNzczNH0.qgDKRsLazvD-CYNkIF7GtWgwKDqcXgbL2G6xMt-LnP4';
/* Supabase logins need an email, so each username maps to a made-up address that never receives mail. */
var EMAIL_DOMAIN = 'players.travis.local';
var USERNAME_RE = /^[a-z0-9_]{3,20}$/;

var CARD = {}; chars.concat(acts).forEach(function(c){ CARD[c.id] = c; });
var sb = null;
var A = {user:null, profile:null, collection:[], decks:[], ready:false, available:false, onChange:function(){}};

function client(){
  if(!sb && typeof window!=='undefined' && window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return sb;
}
function emailFor(u){ return u+'@'+EMAIL_DOMAIN; }
function clean(u){ return String(u||'').trim().toLowerCase(); }
function friendly(e){
  var m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if(/Invalid login credentials/i.test(m)) return 'Wrong username or password.';
  if(/already registered|already exists/i.test(m)) return 'That username is taken.';
  if(/Password should be/i.test(m)) return 'Passwords need at least 6 characters.';
  if(/rate limit/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  if(/Failed to fetch|NetworkError/i.test(m)) return 'Can&rsquo;t reach the server. Check your connection.';
  return m;
}
async function call(p){ var r = await p; if(r.error) throw new Error(friendly(r.error)); return r.data; }
function changed(){ try{ A.onChange(); }catch(e){} }

/* ---------------- session ---------------- */
A.init = async function(onChange){
  A.onChange = onChange || A.onChange;
  var c = client();
  if(!c){ A.ready = true; changed(); return; }
  A.available = true;
  try{
    var s = await c.auth.getSession();
    A.user = s.data.session ? s.data.session.user : null;
    if(A.user) await A.load();
  }catch(e){ A.user = null; }
  A.ready = true; changed();
};
A.signUp = async function(username, password){
  var u = clean(username);
  if(!USERNAME_RE.test(u)) throw new Error('Usernames are 3&ndash;20 characters: letters, numbers or _.');
  if(String(password).length < 6) throw new Error('Passwords need at least 6 characters.');
  var free = await call(client().rpc('username_available', {u:u}));
  if(!free) throw new Error('That username is taken.');
  var d = await call(client().auth.signUp({email:emailFor(u), password:password, options:{data:{username:u}}}));
  if(!d.session) throw new Error('Account made, but sign-in is waiting on email confirmation. Ask the admin to turn off &ldquo;Confirm email&rdquo; in Supabase.');
  A.user = d.user; await A.load(); changed();
};
A.signIn = async function(username, password){
  var u = clean(username);
  var d = await call(client().auth.signInWithPassword({email:emailFor(u), password:password}));
  A.user = d.user; await A.load(); changed();
};
A.signOut = async function(){
  try{ await client().auth.signOut(); }catch(e){}
  A.user = null; A.profile = null; A.collection = []; A.decks = []; changed();
};
A.load = async function(){
  var c = client();
  var r = await Promise.all([
    call(c.from('profiles').select('*').eq('id', A.user.id).maybeSingle()),
    call(c.from('collection').select('card_id,foil,qty')),
    call(c.from('decks').select('*').order('updated_at', {ascending:false}))
  ]);
  A.profile = r[0]; A.collection = r[1] || []; A.decks = r[2] || [];
  if(!A.profile) throw new Error('This login has no player profile. Ask the admin to check the database setup.');
};
A.refresh = async function(){ if(A.user){ await A.load(); changed(); } };

/* ---------------- ownership ---------------- */
function qty(id, foil){ return A.collection.filter(function(r){ return r.card_id===id && !!r.foil===!!foil; }).reduce(function(s,r){ return s+r.qty; }, 0); }
A.qty = qty;
A.ownsChar = function(c){ return c.set==='base' || qty(c.id,false)>0; };
A.ownsFoil = function(id){ return qty(id,true)>0; };
/* Most copies of an action card a deck may hold: 3, and never more than you own for pack cards. */
A.actionLimit = function(a){ return a.set==='base' ? 3 : Math.min(3, qty(a.id,false)); };
A.price = function(c, foil){ return foil ? 15 : c.set==='base' ? 0 : chars.indexOf(c)>=0 ? 20 : 8; };
A.canBuy = function(c, foil){
  if(!A.profile) return false;
  if(foil) return c.set==='base' && chars.indexOf(c)>=0 && !A.ownsFoil(c.id);
  if(c.set==='base') return false;
  return chars.indexOf(c)>=0 ? qty(c.id,false)<1 : qty(c.id,false)<3;
};

/* ---------------- packs ---------------- */
A.claimDaily = async function(){ await call(client().rpc('claim_daily')); await A.refresh(); };
A.openPack = async function(){
  var cards = await call(client().rpc('open_pack'));
  await A.refresh();
  return (cards||[]).map(function(x){ return {id:x.id, foil:x.foil, dupe:x.dupe, points:x.points, card:CARD[x.id]}; });
};
A.buyCard = async function(id, foil){ await call(client().rpc('buy_card', {card:id, want_foil:!!foil})); await A.refresh(); };
A.recordWin = async function(){ if(!A.user) return false; try{ var got = await call(client().rpc('record_win')); await A.refresh(); return got; }catch(e){ return false; } };

/* ---------------- decks ---------------- */
A.saveDeck = async function(d){
  var row = {name:d.name, characters:d.characters, actions:d.actions, foils:d.foils||[]};
  if(d.id) await call(client().from('decks').update(row).eq('id', d.id));
  else await call(client().from('decks').insert(row));
  await A.refresh();
};
A.deleteDeck = async function(id){ await call(client().from('decks').delete().eq('id', id)); await A.refresh(); };

/* ---------------- live matches ----------------
   Both players' browsers run the same game with the same random seed. Each move is broadcast on a
   Realtime channel; messages carry a sequence number so a dropped one can be asked for again. */
A.makeCode = function(){
  var L = 'ABCDEFGHJKMNPQRSTUVWXYZ', s = '';
  for(var i=0;i<4;i++) s += L[Math.floor(Math.random()*L.length)];
  return s + '-' + (10 + Math.floor(Math.random()*90));
};
A.openMatch = function(code, role, handlers){
  var c = client();
  var ch = c.channel('match-'+code, {config:{broadcast:{self:false}, presence:{key:A.user.id}}});
  var sent = [], expect = 0, held = {}, closed = false;
  function deliver(m){
    if(m.s < expect) return;
    if(m.s > expect){ held[m.s] = m; ch.send({type:'broadcast', event:'nack', payload:{from:expect}}); return; }
    expect++; handlers.message(m.p);
    while(held[expect]){ var n = held[expect]; delete held[expect]; expect++; handlers.message(n.p); }
  }
  ch.on('broadcast', {event:'m'}, function(e){ deliver(e.payload); });
  ch.on('broadcast', {event:'nack'}, function(e){
    for(var i=e.payload.from;i<sent.length;i++) ch.send({type:'broadcast', event:'m', payload:sent[i]});
  });
  ch.on('presence', {event:'sync'}, function(){
    var st = ch.presenceState(), people = [];
    Object.keys(st).forEach(function(k){ if(st[k][0]) people.push(st[k][0]); });
    handlers.presence(people);
  });
  ch.subscribe(function(status){
    if(status==='SUBSCRIBED') ch.track({id:A.user.id, username:A.profile.username, role:role});
    else if((status==='CHANNEL_ERROR' || status==='TIMED_OUT') && !closed) handlers.error('Lost the connection to the game server.');
  });
  return {
    send:function(p){ var m = {s:sent.length, p:p}; sent.push(m); ch.send({type:'broadcast', event:'m', payload:m}); },
    close:function(){ closed = true; try{ c.removeChannel(ch); }catch(e){} }
  };
};

if(typeof window!=='undefined') window.TravisAccount = A;
})();
