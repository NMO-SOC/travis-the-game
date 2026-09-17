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
  A.loadPacks();
  A.loadEvents();
  try{
    var s = await c.auth.getSession();
    A.user = s.data.session ? s.data.session.user : null;
    if(A.user){ await A.load(); A.touch(); await A.claimChairmanGift(); await A.claimAustralianaGift(); }
  }catch(e){ A.user = null; }
  A.ready = true; changed();
};
/* A once-only free Chairman Knox for every player, past and future, the first time they're ever
   signed in after this shipped — server-enforced (profiles.chairman_gifted), so it can only ever be
   granted once no matter how many times this runs. Sets A.justGiftedChairman so the UI can show the
   one-time explanation; missing until upgrade-14 is run, in which case this silently does nothing. */
A.justGiftedChairman = false;
A.claimChairmanGift = async function(){
  if(!A.user) return;
  try{
    var got = await call(client().rpc('claim_chairman_gift'));
    if(got){ A.justGiftedChairman = true; await A.refresh(); }
  }catch(e){}
};
/* A once-only free Australiana pack (a specific-type pack, not a generic token) for every player,
   past and future, the first time they're signed in after upgrade-16 — same server-enforced,
   run-as-many-times-as-you-like pattern as claimChairmanGift above. */
A.claimAustralianaGift = async function(){
  if(!A.user) return;
  try{ var got = await call(client().rpc('claim_australiana_gift')); if(got) await A.refresh(); }catch(e){}
};
A.signUp = async function(username, password){
  var u = clean(username);
  if(!USERNAME_RE.test(u)) throw new Error('Usernames are 3&ndash;20 characters: letters, numbers or _.');
  if(String(password).length < 6) throw new Error('Passwords need at least 6 characters.');
  var free = await call(client().rpc('username_available', {u:u}));
  if(!free) throw new Error('That username is taken.');
  var d = await call(client().auth.signUp({email:emailFor(u), password:password, options:{data:{username:u}}}));
  if(!d.session) throw new Error('Account made, but sign-in is waiting on email confirmation. Ask the admin to turn off &ldquo;Confirm email&rdquo; in Supabase.');
  A.user = d.user; await A.load(); A.touch(); await A.claimChairmanGift(); await A.claimAustralianaGift(); changed();
};
A.signIn = async function(username, password){
  var u = clean(username);
  var d = await call(client().auth.signInWithPassword({email:emailFor(u), password:password}));
  A.user = d.user; await A.load(); A.touch(); await A.claimChairmanGift(); await A.claimAustralianaGift(); changed();
};
A.signOut = async function(){
  A.leaveLobby();
  if(activityCh){ try{ client().removeChannel(activityCh); }catch(e){} activityCh = null; }
  if(battleCh){ try{ client().removeChannel(battleCh); }catch(e){} battleCh = null; }
  try{ await client().auth.signOut(); }catch(e){}
  A.user = null; A.profile = null; A.collection = []; A.decks = []; A.stock = {}; changed();
};
A.load = async function(){
  var c = client();
  var r = await Promise.all([
    call(c.from('profiles').select('*').eq('id', A.user.id).maybeSingle()),
    // 'gold' is missing until upgrade-15 is run; fall back to reading without it rather than failing
    // login for everyone in the meantime (every row is then just treated as not-gold).
    c.from('collection').select('card_id,foil,gold,qty').then(function(x){
      if(!x.error) return x.data;
      return c.from('collection').select('card_id,foil,qty').then(function(y){ return (y.data||[]).map(function(r){ r.gold = false; return r; }); });
    }, function(){ return []; }),
    call(c.from('decks').select('*').order('updated_at', {ascending:false})),
    // Missing until upgrade-4 is run; treat that as "no specific-type packs" rather than failing the login.
    c.from('pack_stock').select('pack_id,qty').then(function(x){ return x.error ? [] : x.data; }, function(){ return []; })
  ]);
  A.profile = r[0]; A.collection = r[1] || []; A.decks = r[2] || [];
  A.stock = {}; (r[3] || []).forEach(function(s){ if(s.qty>0) A.stock[s.pack_id] = s.qty; });
  if(!A.profile) throw new Error('This login has no player profile. Ask the admin to check the database setup.');
  A.joinLobby();
  A.watchActivity();
  A.watchBattleFeed();
};
/* Packs come in two kinds: any-type packs (profile.packs, from wins), opened as whichever pack you
   choose, and packs of one specific type (A.stock[packId], given by an admin). */
A.stock = {};
A.anyPacks = function(){ return A.profile ? A.profile.packs : 0; };
A.typedPacks = function(id){ return A.stock[id] || 0; };
A.totalPacks = function(){ var n = A.anyPacks(); for(var k in A.stock) n += A.stock[k]; return n; };
A.isExpired = function(id){ var p = A.packs.filter(function(x){ return x.id===id; })[0]; return !!(p && p.validUntil && new Date(p.validUntil) < new Date()); };
A.canOpen = function(id){
  if(A.isExpired(id)) return false;
  var p = A.packs.filter(function(x){ return x.id===id; })[0];
  return A.typedPacks(id) > 0 || (A.anyPacks() > 0 && (!p || p.openWithAny));
};
A.refresh = async function(){ if(A.user){ await A.load(); changed(); } };

/* ---------------- ownership ----------------
   finish: 'normal' (default), 'foil' or 'gold'. Foil and gold are two different rare finishes any
   character can have — never both on the same copy — and, since upgrade-15, neither is purchasable:
   the only way to get either is a pack (Holo guarantees a foil, Legendary guarantees a gold). */
function qty(id, foil){ return A.collection.filter(function(r){ return r.card_id===id && !!r.foil===!!foil && !r.gold; }).reduce(function(s,r){ return s+r.qty; }, 0); }
function qtyGold(id){ return A.collection.filter(function(r){ return r.card_id===id && r.gold; }).reduce(function(s,r){ return s+r.qty; }, 0); }
A.qty = qty;
A.qtyGold = qtyGold;
/* Total copies owned across all three finishes. Only Chairman Knox counts copies this way — every
   other character just needs one copy to be "owned", with foil/gold as a cosmetic finish on top (see
   bestFinish in play.js) — but Chairman's own mechanic (own three, any finish, and every copy you
   hold empowers) cares about the raw count, not which finish each copy came in. */
A.qtyTotal = function(id){ return qty(id,false) + qty(id,true) + qtyGold(id); };
A.ownsChar = function(c){ return c.set==='base' || qty(c.id,false)>0; };
A.ownsFoil = function(id){ return qty(id,true)>0; };
A.ownsGold = function(id){ return qtyGold(id)>0; };
/* Most copies of an action card a deck may hold: 3, and never more than you own for pack cards. */
A.actionLimit = function(a){ return a.set==='base' ? 3 : Math.min(3, qty(a.id,false)); };
A.price = function(c){ return c.set==='base' ? 0 : chars.indexOf(c)>=0 ? 20 : 8; };
A.canBuy = function(c, finish){
  if(!A.profile || finish==='foil' || finish==='gold') return false;   // pull- or gift-only, never for sale
  if(c.set==='base' || c.id==='chairman-knox' || c.set==='australiana') return false;  // pack-only, never for sale
  return chars.indexOf(c)>=0 ? qty(c.id,false)<1 : qty(c.id,false)<3;
};
/* Sell price is half the buy price. Starter (base, normal) cards can't be sold — everyone already owns them free. */
A.sellPrice = function(c, finish){ return (finish==='foil' || finish==='gold') ? 7 : c.set==='base' ? 0 : chars.indexOf(c)>=0 ? 10 : 4; };
A.canSell = function(c, finish){
  if(!A.profile || c.id==='chairman-knox') return false;
  if(finish==='foil') return A.ownsFoil(c.id);
  if(finish==='gold') return A.ownsGold(c.id);
  return c.set!=='base' && qty(c.id,false)>0;
};
A.sellCard = async function(id, finish){ await call(client().rpc('sell_card', {card:id, is_foil:finish==='foil', is_gold:finish==='gold'})); await A.refresh(); };

/* ---------------- packs ----------------
   Pack names and odds come from the database (packs, pack_odds) so the odds shown are the odds used.
   A.packs: [{id, name, blurb, odds, openWithAny, validUntil}], or [] if not set up yet.
   openWithAny false = admin-gift only (Holo, Legendary): an any-type pack can't open it, only a
   matching specific pack (from A.stock) can. validUntil, when set, is when a limited pack stops
   being openable (e.g. End of Year) — columns added by upgrade-6; missing gracefully as true/null. */
A.packs = [];
A.loadPacks = async function(){
  try{
    var r = await Promise.all([call(client().from('packs').select('*').eq('active', true).order('sort')),
                               call(client().from('pack_odds').select('*'))]);
    A.packs = (r[0]||[]).map(function(p){
      var rows = (r[1]||[]).filter(function(o){ return o.pack_id===p.id; }), total = rows.reduce(function(s,o){ return s+o.weight; }, 0), odds = {};
      rows.forEach(function(o){ odds[o.slot] = total ? o.weight/total : 0; });
      return {id:p.id, name:p.name, blurb:p.blurb, odds:odds, openWithAny:p.open_with_any!==false, validUntil:p.valid_until||null, winWeight:p.win_weight||0, gpPrice:p.gp_price||null};
    });
  }catch(e){ A.packs = []; }
  changed();
};
/* ---------------- special events ----------------
   Every saved event (admins see them all to switch on and off); players only get offered live ones.
   [] until upgrade-16 is run. */
A.events = [];
A.loadEvents = async function(){
  try{ A.events = await call(client().from('events').select('*').order('created_at', {ascending:false})) || []; }catch(e){ A.events = []; }
  changed();
};
A.liveEvents = function(){
  var me = A.profile && A.profile.username;
  return A.events.filter(function(e){ return e.live && (!e.allowed_usernames || !e.allowed_usernames.length || (me && e.allowed_usernames.indexOf(me)>=0)); });
};
A.saveEvent = async function(row){ await call(client().from('events').insert(row)); await A.loadEvents(); };
A.setEventLive = async function(id, live){ await call(client().from('events').update({live:live}).eq('id', id)); await A.loadEvents(); };
A.deleteEvent = async function(id){ await call(client().from('events').delete().eq('id', id)); await A.loadEvents(); };

A.openPack = async function(packId){
  var cards = await call(client().rpc('open_pack', {p_pack:packId}));
  await A.refresh();
  return (cards||[]).map(function(x){ return {id:x.id, foil:x.foil, gold:x.gold, dupe:x.dupe, starter:!!x.starter, points:x.points, card:CARD[x.id]}; });
};
/* Buying a pack always grants a token of that exact pack (pack_stock), never a generic any-type
   token — see upgrade-17-buy-packs.sql. Missing gracefully (gpPrice null) until that migration runs. */
A.canBuyPack = function(id){
  var p = A.packs.filter(function(x){ return x.id===id; })[0];
  return !!(p && p.gpPrice && !A.isExpired(id) && A.profile && A.profile.grant_points >= p.gpPrice);
};
A.buyPack = async function(packId){ await call(client().rpc('buy_pack', {p_pack:packId})); await A.refresh(); };
A.buyCard = async function(id, foil){ await call(client().rpc('buy_card', {card:id, want_foil:!!foil})); await A.refresh(); };
/* Resolves to the id of the pack just won (e.g. 'term-one'), 'any' if no pack is configured to be
   won, or null if today's five win-packs are already claimed. */
A.recordWin = async function(difficulty){ if(!A.user) return null; try{ var got = await call(client().rpc('record_win', {p_difficulty:difficulty||null})); await A.refresh(); return got; }catch(e){ return null; } };
/* High Stakes: a second, uncapped way to earn a pack, at the cost of the Grant Points staked on a loss.
   Resolves to {won, pack} on a win or {won:false, lost, grant_points} on a loss. */
/* Chairman Knox's only other source: a 1-in-100 chance whenever a pack is actually won from an
   online battle (a free daily win or a High Stakes win alike) — never CPU, never purchasable, never
   part of any pack's normal odds table. Resolves to true only on the rare hit. */
A.rollChairmanWin = async function(){
  if(!A.user) return false;
  try{ var got = await call(client().rpc('roll_chairman_win')); if(got) await A.refresh(); return !!got; }catch(e){ return false; }
};
A.wager = async function(stake, won, mode, difficulty){
  var got = await call(client().rpc('wager_battle', {p_stake:stake, p_won:!!won, p_mode:mode, p_difficulty:difficulty||null}));
  await A.refresh();
  return got;
};

/* ---------------- decks ---------------- */
A.saveDeck = async function(d){
  var row = {name:d.name, characters:d.characters, actions:d.actions, foils:d.foils||[], golds:d.golds||[]};
  if(d.id) await call(client().from('decks').update(row).eq('id', d.id));
  else await call(client().from('decks').insert(row));
  await A.refresh();
};
A.deleteDeck = async function(id){ await call(client().from('decks').delete().eq('id', id)); await A.refresh(); };

/* ---------------- play history ----------------
   Stats are best-effort: a failed write (offline, or upgrade-1-admin-stats.sql not run yet) must
   never interrupt the game, so errors are swallowed. */
A.touch = function(){ if(A.user) client().rpc('touch_seen').then(function(){}, function(){}); };
A.logGame = function(g){
  if(!A.user) return;
  client().rpc('log_game', {p_mode:g.mode, p_difficulty:g.difficulty||null, p_size:g.size, p_result:g.result,
    p_rounds:g.rounds||0, p_seconds:g.seconds||0, p_opponent:g.opponent||null, p_deck:g.deck||null}).then(function(){}, function(){});
};
A.logGameStart = function(mode, difficulty, size, opponent){
  if(!A.user) return;
  client().rpc('log_game_start', {p_mode:mode, p_difficulty:difficulty||null, p_size:size, p_opponent:opponent||null}).then(function(){}, function(){});
};

/* ---------------- activity feed ----------------
   Everyone's packs, opens and battles, live. Only the security-definer functions above (record_win,
   open_pack, log_game, log_game_start, wager_battle) ever write a row — RLS blocks direct inserts,
   so nothing shown here can be a client-spoofed entry. Missing until upgrade-13 is run. */
var activityCh = null, onActivity = function(){};
A.loadActivity = async function(limit){
  try{ return await call(client().from('activity').select('*').order('created_at', {ascending:false}).order('id', {ascending:false}).limit(limit||30)); }
  catch(e){ return []; }
};
A.onActivity = function(fn){ onActivity = fn || function(){}; };
A.watchActivity = function(){
  if(activityCh || !client()) return;
  activityCh = client().channel('activity-feed')
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'activity'}, function(msg){
      try{ onActivity(msg.new); }catch(e){}
    })
    .subscribe();
};

/* ---------------- live battle feed ----------------
   Every line of every ongoing CPU/online battle, broadcast (not stored — there'd be far too many rows
   to keep, and nobody needs to replay a finished game's blow-by-blow) to anyone with the app open, so
   the home screen can show a genuinely live "what's happening right now" alongside the persisted feed. */
var battleCh = null, onBattleLine = function(){};
A.watchBattleFeed = function(){
  if(battleCh || !client()) return;
  battleCh = client().channel('battle-feed', {config:{broadcast:{self:false}}});
  battleCh.on('broadcast', {event:'line'}, function(e){ try{ onBattleLine(e.payload); }catch(err){} });
  battleCh.subscribe();
};
A.onBattleLine = function(fn){ onBattleLine = fn || function(){}; };
A.broadcastBattleLine = function(payload){ if(battleCh) battleCh.send({type:'broadcast', event:'line', payload:payload}); };

/* ---------------- admin ---------------- */
A.adminOverview = function(){ return call(client().rpc('admin_overview')); };
A.adminDecks = function(){ return call(client().rpc('admin_decks')); };
A.adminGames = function(limit){ return call(client().rpc('admin_games', {p_limit:limit||40})); };
A.adminPlayer = function(username){ return call(client().rpc('admin_player', {p_username:username})); };

/* ---------------- leaderboard ----------------
   Open to any signed-in player (not just admins): [{username, xp, wins, losses, draws, games}]. */
A.getLeaderboard = function(){ return call(client().rpc('leaderboard')); };
/* username null = every player; packId null = any-type packs. Resolves to the number of players who got packs. */
A.adminGivePacks = async function(username, count, packId){
  var n = await call(client().rpc('admin_give_packs', {p_username:username, p_count:count, p_pack:packId||null}));
  if(username==null || (A.profile && username===A.profile.username)) await A.refresh();
  return n;
};

/* ---------------- lobby presence ----------------
   A single shared channel every signed-in player joins while the app is open, so the home screen can
   show who else is around and let you send them a direct battle invite (a match code, delivered by
   broadcast rather than typed in). Separate from the per-match channel used once a game starts. */
var lobbyCh = null, lobbyPeople = [], onLobby = function(){}, onInvite = function(){};
A.joinLobby = function(){
  if(lobbyCh || !A.user || !A.profile) return;
  var c = client();
  lobbyCh = c.channel('lobby', {config:{broadcast:{self:false}, presence:{key:A.user.id}}});
  lobbyCh.on('presence', {event:'sync'}, function(){
    if(!lobbyCh) return;
    var st = lobbyCh.presenceState(), people = [];
    Object.keys(st).forEach(function(k){ if(st[k][0]) people.push(st[k][0]); });
    lobbyPeople = people.filter(function(p){ return p.id!==A.user.id; });
    try{ onLobby(lobbyPeople); }catch(e){}
  });
  lobbyCh.on('broadcast', {event:'invite'}, function(e){
    if(e.payload && e.payload.to===A.user.id) try{ onInvite(e.payload); }catch(e2){}
  });
  lobbyCh.subscribe(function(status){
    if(status==='SUBSCRIBED' && lobbyCh) lobbyCh.track({id:A.user.id, username:A.profile.username});
  });
};
A.leaveLobby = function(){
  if(lobbyCh){ try{ client().removeChannel(lobbyCh); }catch(e){} }
  lobbyCh = null; lobbyPeople = [];
};
A.onlinePlayers = function(){ return lobbyPeople; };
A.onLobbyChange = function(fn){ onLobby = fn || function(){}; };
A.onInvite = function(fn){ onInvite = fn || function(){}; };
/* Re-tracks this player's lobby presence with which match they're currently in, so other signed-in
   players browsing the lobby can spot and watch it without being told a code. Cleared (see
   clearMatchAnnounce) the moment the match ends or is left — see NET.close() in play.js, the single
   place every exit path already funnels through. */
A.announceMatch = function(code, info){
  if(!lobbyCh || !A.user || !A.profile) return;
  try{ lobbyCh.track({id:A.user.id, username:A.profile.username, match:code, info:info||null}); }catch(e){}
};
A.clearMatchAnnounce = function(){
  if(!lobbyCh || !A.user || !A.profile) return;
  try{ lobbyCh.track({id:A.user.id, username:A.profile.username}); }catch(e){}
};
/* code: a match code already created with A.makeCode() and opened with A.openMatch(code, 'host', ...). */
A.sendInvite = function(targetId, code, size){
  if(!lobbyCh || !A.user || !A.profile) return;
  lobbyCh.send({type:'broadcast', event:'invite', payload:{to:targetId, from:A.user.id, fromName:A.profile.username, code:code, size:size}});
};

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
  /* A spectator joining mid-game broadcasts 'spec-join' asking for a full catch-up; only forwarded
     here so play.js (which owns the actual game state/history) can decide how to answer. */
  if(handlers.specJoin) ch.on('broadcast', {event:'spec-join'}, function(e){ handlers.specJoin(e.payload); });
  /* Chat: open to everyone on the match channel — both players and any spectators — since it's just
     a broadcast, not part of the ordered/replayed game-move stream. */
  if(handlers.chat) ch.on('broadcast', {event:'chat'}, function(e){ handlers.chat(e.payload); });
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
    /* Unlike send(), not part of the ordered/nack'd 'm' stream — used only for the one-off spectator
       sync reply, which carries its own explicit backlog and doesn't need redelivery. */
    sendRaw:function(event, payload){ ch.send({type:'broadcast', event:event, payload:payload}); },
    chat:function(text){ ch.send({type:'broadcast', event:'chat', payload:{from:A.user.id, name:A.profile.username, role:role, text:String(text).slice(0,300), ts:Date.now()}}); },
    close:function(){ closed = true; try{ c.removeChannel(ch); }catch(e){} }
  };
};
/* Spectating: joins the same match channel as a non-participant (role 'spectator' in presence, so
   the two real players can tell them apart from an opponent — see onPresence in play.js). Never
   sends game moves; just asks for a catch-up snapshot on join, then listens for the same live move
   broadcasts the players exchange. */
A.openSpectate = function(code, handlers){
  var c = client();
  var ch = c.channel('match-'+code, {config:{broadcast:{self:false}, presence:{key:A.user.id}}});
  ch.on('broadcast', {event:'spec-sync'}, function(e){ if(e.payload && e.payload.to===A.user.id) handlers.sync(e.payload); });
  ch.on('broadcast', {event:'m'}, function(e){ if(e.payload && handlers.live) handlers.live(e.payload.p); });
  if(handlers.chat) ch.on('broadcast', {event:'chat'}, function(e){ handlers.chat(e.payload); });
  ch.on('presence', {event:'sync'}, function(){
    var st = ch.presenceState(), people = [];
    Object.keys(st).forEach(function(k){ if(st[k][0]) people.push(st[k][0]); });
    handlers.presence(people);
  });
  ch.subscribe(function(status){
    if(status==='SUBSCRIBED'){
      ch.track({id:A.user.id, username:A.profile.username, role:'spectator'});
      ch.send({type:'broadcast', event:'spec-join', payload:{from:A.user.id, name:A.profile.username}});
    } else if(status==='CHANNEL_ERROR' || status==='TIMED_OUT'){ handlers.error && handlers.error('Lost the connection to the game server.'); }
  });
  return {
    chat:function(text){ ch.send({type:'broadcast', event:'chat', payload:{from:A.user.id, name:A.profile.username, role:'spectator', text:String(text).slice(0,300), ts:Date.now()}}); },
    close:function(){ try{ c.removeChannel(ch); }catch(e){} }
  };
};

if(typeof window!=='undefined') window.TravisAccount = A;
})();
