/* Travis: The Game — persistent site-wide music player.
   Survives page navigation via localStorage (track/position/volume/open state). */
(function () {
  var TRACKS = [
    { title: 'Blue Suit, Long Day', file: 'CD/1 - Blue Suit, Long Day.mp3' },
    { title: 'Cold Water Quiet Fallout', file: 'CD/2 - Cold Water Quiet Fallout.mp3' },
    { title: 'Holding It Together (Yeah Nah)', file: 'CD/3 - Holding It Together (Yeah Nah).mp3' },
    { title: 'Fort Knox', file: 'CD/4 - Fort Knox.mp3' },
    { title: 'Office Hours (Bill & Pete)', file: 'CD/5 - Office Hours (Bill & Pete).mp3' },
    { title: 'Saturday Punt', file: 'CD/6 - Saturday Punt.mp3' },
    { title: 'Detention Bell Blues', file: 'CD/7 - Detention Bell Blues.mp3' },
    { title: 'Travis Knox, We Love You!', file: 'CD/8 - Travis Knox, We Love You!.mp3' }
  ];
  var FALLBACK_COVER = 'CD/cover.jpg';
  var STATE_KEY = 'travisMusicState';

  function loadState() {
    var d = { trackIndex: 0, currentTime: 0, paused: true, volume: 0.7, open: false };
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (raw) { var s = JSON.parse(raw); for (var k in d) if (s[k] !== undefined) d[k] = s[k]; }
    } catch (e) {}
    return d;
  }
  function saveState(patch) {
    try {
      var s = loadState();
      for (var k in patch) s[k] = patch[k];
      localStorage.setItem(STATE_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  var state = loadState();
  if (state.trackIndex < 0 || state.trackIndex >= TRACKS.length) state.trackIndex = 0;

  /* ---------- ID3v2 APIC (cover art) extraction ---------- */
  var coverCache = {};
  function synchsafe(dv, off) {
    return ((dv.getUint8(off) & 0x7f) << 21) | ((dv.getUint8(off + 1) & 0x7f) << 14) |
           ((dv.getUint8(off + 2) & 0x7f) << 7) | (dv.getUint8(off + 3) & 0x7f);
  }
  function bytesToStr(bytes, start, end) {
    var s = '';
    for (var i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
  function extractAPIC(buffer) {
    var dv = new DataView(buffer);
    if (buffer.byteLength < 10 || dv.getUint8(0) !== 0x49 || dv.getUint8(1) !== 0x44 || dv.getUint8(2) !== 0x33) return null;
    var verMajor = dv.getUint8(3);
    var flags = dv.getUint8(5);
    var tagSize = synchsafe(dv, 6);
    var end = Math.min(10 + tagSize, buffer.byteLength);
    var offset = 10;
    if (flags & 0x40) {
      var extSize = verMajor === 4 ? synchsafe(dv, offset) : dv.getUint32(offset);
      offset += (verMajor === 4 ? extSize : extSize + 4);
    }
    while (offset < end - 10) {
      var frameId = bytesToStr(new Uint8Array(buffer), offset, offset + 4);
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
      var frameSize = verMajor === 4 ? synchsafe(dv, offset + 4) : dv.getUint32(offset + 4);
      var frameStart = offset + 10;
      if (frameId === 'APIC' && frameSize > 0 && frameStart + frameSize <= buffer.byteLength) {
        var bytes = new Uint8Array(buffer, frameStart, frameSize);
        var p = 1; // skip text-encoding byte
        var mimeEnd = p;
        while (mimeEnd < bytes.length && bytes[mimeEnd] !== 0) mimeEnd++;
        var mime = bytesToStr(bytes, p, mimeEnd) || 'image/jpeg';
        p = mimeEnd + 1;
        p += 1; // picture type byte
        var encoding = bytes[0];
        if (encoding === 1 || encoding === 2) {
          while (p < bytes.length - 1 && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
          p += 2;
        } else {
          while (p < bytes.length && bytes[p] !== 0) p++;
          p += 1;
        }
        var imgData = bytes.slice(p);
        try { return URL.createObjectURL(new Blob([imgData], { type: mime })); } catch (e) { return null; }
      }
      offset = frameStart + frameSize;
      if (frameSize === 0) break;
    }
    return null;
  }
  function coverFor(file, cb) {
    if (coverCache[file]) return cb(coverCache[file]);
    fetch(file, { headers: { Range: 'bytes=0-1500000' } }).then(function (r) {
      return r.arrayBuffer();
    }).then(function (buf) {
      var url = extractAPIC(buf) || FALLBACK_COVER;
      coverCache[file] = url;
      cb(url);
    }).catch(function () { cb(FALLBACK_COVER); });
  }

  /* ---------- audio element ---------- */
  var audio = document.getElementById('travisAudio');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'travisAudio';
    audio.preload = 'metadata';
    document.body.appendChild(audio);
  }
  audio.volume = state.volume;

  var restoredTime = state.currentTime;
  function loadTrack(idx, autoplay) {
    state.trackIndex = idx;
    var t = TRACKS[idx];
    var wasSrcSet = audio.getAttribute('data-file') === t.file;
    if (!wasSrcSet) {
      audio.src = t.file;
      audio.setAttribute('data-file', t.file);
    }
    renderTrackList();
    updateNowPlaying();
    if (restoredTime && !wasSrcSet) {
      audio.addEventListener('loadedmetadata', function once() {
        audio.currentTime = restoredTime;
        restoredTime = 0;
        audio.removeEventListener('loadedmetadata', once);
      });
    }
    if (autoplay) {
      audio.play().catch(function () { setNeedsTap(true); });
    }
    saveState({ trackIndex: idx });
  }

  /* ---------- UI ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#travisMusicBtn{position:fixed;bottom:18px;right:18px;z-index:99999;width:52px;height:52px;border-radius:50%;',
    'background:#10202C;color:#EFF2F1;border:2px solid rgba(255,255,255,.15);font-size:22px;cursor:pointer;',
    'box-shadow:0 8px 20px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;transition:transform .15s;}',
    '#travisMusicBtn:hover{transform:scale(1.06);}',
    '#travisMusicBtn.needsTap{animation:travisPulse 1.4s infinite;}',
    '@keyframes travisPulse{0%,100%{box-shadow:0 0 0 0 rgba(201,180,138,.55);}50%{box-shadow:0 0 0 10px rgba(201,180,138,0);}}',
    '#travisMusicPanel{position:fixed;bottom:82px;right:18px;z-index:99999;width:300px;max-width:calc(100vw - 36px);',
    'background:#10202C;color:#EFF2F1;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.45);',
    'font-family:Georgia,serif;overflow:hidden;display:none;border:1px solid rgba(255,255,255,.1);}',
    '#travisMusicPanel.open{display:block;}',
    '#travisMusicPanel .tm-top{display:flex;gap:12px;padding:14px 14px 10px;align-items:center;}',
    '#travisMusicPanel .tm-cover{width:56px;height:56px;border-radius:8px;object-fit:cover;background:#0B2545;flex:0 0 auto;}',
    '#travisMusicPanel .tm-meta{min-width:0;}',
    '#travisMusicPanel .tm-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '#travisMusicPanel .tm-sub{font-size:10.5px;color:#8FB3D9;margin-top:2px;letter-spacing:.05em;text-transform:uppercase;font-family:"IBM Plex Mono",monospace;}',
    '#travisMusicPanel .tm-controls{display:flex;align-items:center;justify-content:center;gap:14px;padding:2px 14px 10px;}',
    '#travisMusicPanel .tm-controls button{background:none;border:none;color:#EFF2F1;font-size:18px;cursor:pointer;padding:6px;}',
    '#travisMusicPanel .tm-controls button.tm-play{font-size:24px;}',
    '#travisMusicPanel .tm-seek{padding:0 14px;}',
    '#travisMusicPanel .tm-seek input[type=range]{width:100%;accent-color:#C9B48A;}',
    '#travisMusicPanel .tm-times{display:flex;justify-content:space-between;font-size:10px;color:#8FB3D9;padding:0 14px;font-family:"IBM Plex Mono",monospace;}',
    '#travisMusicPanel .tm-vol{display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:11px;color:#8FB3D9;}',
    '#travisMusicPanel .tm-vol input{flex:1;accent-color:#C9B48A;}',
    '#travisMusicPanel .tm-list{max-height:170px;overflow-y:auto;border-top:1px solid rgba(255,255,255,.1);}',
    '#travisMusicPanel .tm-track{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:none;',
    'color:#EFF2F1;padding:8px 14px;font-size:11.5px;cursor:pointer;}',
    '#travisMusicPanel .tm-track:hover{background:rgba(255,255,255,.05);}',
    '#travisMusicPanel .tm-track.active{background:rgba(201,180,138,.15);color:#C9B48A;}',
    '#travisMusicPanel .tm-track img{width:26px;height:26px;border-radius:4px;object-fit:cover;flex:0 0 auto;}',
    '#travisMusicPanel .tm-track span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
  ].join('');
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.id = 'travisMusicBtn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Music player');
  btn.textContent = '🎵';
  document.body.appendChild(btn);

  var panel = document.createElement('div');
  panel.id = 'travisMusicPanel';
  panel.innerHTML =
    '<div class="tm-top">' +
      '<img class="tm-cover" id="tmCover" alt="">' +
      '<div class="tm-meta"><div class="tm-title" id="tmTitle"></div><div class="tm-sub">Travis: The Game OST</div></div>' +
    '</div>' +
    '<div class="tm-controls">' +
      '<button id="tmPrev" aria-label="Previous">⏮</button>' +
      '<button class="tm-play" id="tmPlay" aria-label="Play">▶</button>' +
      '<button id="tmNext" aria-label="Next">⏭</button>' +
    '</div>' +
    '<div class="tm-seek"><input id="tmSeek" type="range" min="0" max="100" value="0"></div>' +
    '<div class="tm-times"><span id="tmCur">0:00</span><span id="tmDur">0:00</span></div>' +
    '<div class="tm-vol">🔉<input id="tmVol" type="range" min="0" max="1" step="0.01"></div>' +
    '<div class="tm-list" id="tmList"></div>';
  document.body.appendChild(panel);

  var els = {
    cover: panel.querySelector('#tmCover'),
    title: panel.querySelector('#tmTitle'),
    play: panel.querySelector('#tmPlay'),
    prev: panel.querySelector('#tmPrev'),
    next: panel.querySelector('#tmNext'),
    seek: panel.querySelector('#tmSeek'),
    cur: panel.querySelector('#tmCur'),
    dur: panel.querySelector('#tmDur'),
    vol: panel.querySelector('#tmVol'),
    list: panel.querySelector('#tmList')
  };
  els.vol.value = state.volume;

  function fmt(sec) {
    if (!isFinite(sec)) return '0:00';
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setNeedsTap(v) { btn.classList.toggle('needsTap', !!v); }

  function updateNowPlaying() {
    var t = TRACKS[state.trackIndex];
    els.title.textContent = t.title;
    els.cover.src = FALLBACK_COVER;
    coverFor(t.file, function (url) { els.cover.src = url; });
  }

  function renderTrackList() {
    els.list.innerHTML = '';
    TRACKS.forEach(function (t, i) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'tm-track' + (i === state.trackIndex ? ' active' : '');
      var img = document.createElement('img');
      img.src = FALLBACK_COVER;
      coverFor(t.file, function (url) { img.src = url; });
      var span = document.createElement('span');
      span.textContent = (i + 1) + '. ' + t.title;
      row.appendChild(img);
      row.appendChild(span);
      row.addEventListener('click', function () { loadTrack(i, true); });
      els.list.appendChild(row);
    });
  }

  function updatePlayIcon() {
    els.play.textContent = audio.paused ? '▶' : '⏸';
    els.play.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
  }

  btn.addEventListener('click', function () {
    var open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    saveState({ open: open });
    setNeedsTap(false);
    if (audio.paused && !state.paused) {
      audio.play().catch(function () {});
    }
  });

  els.play.addEventListener('click', function () {
    if (audio.paused) {
      if (!audio.getAttribute('data-file')) loadTrack(state.trackIndex, true);
      else audio.play().catch(function () {});
    } else {
      audio.pause();
    }
  });
  els.prev.addEventListener('click', function () {
    loadTrack((state.trackIndex - 1 + TRACKS.length) % TRACKS.length, true);
  });
  els.next.addEventListener('click', function () {
    loadTrack((state.trackIndex + 1) % TRACKS.length, true);
  });
  els.seek.addEventListener('input', function () {
    if (audio.duration) audio.currentTime = (els.seek.value / 100) * audio.duration;
  });
  els.vol.addEventListener('input', function () {
    audio.volume = Number(els.vol.value);
    saveState({ volume: audio.volume });
  });

  audio.addEventListener('play', function () { updatePlayIcon(); setNeedsTap(false); saveState({ paused: false }); });
  audio.addEventListener('pause', function () { updatePlayIcon(); saveState({ paused: true, currentTime: audio.currentTime }); });
  audio.addEventListener('loadedmetadata', function () { els.dur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', function () {
    if (audio.duration) els.seek.value = (audio.currentTime / audio.duration) * 100;
    els.cur.textContent = fmt(audio.currentTime);
    saveState({ currentTime: audio.currentTime });
  });
  audio.addEventListener('ended', function () {
    loadTrack((state.trackIndex + 1) % TRACKS.length, true);
  });

  window.addEventListener('pagehide', function () {
    saveState({ currentTime: audio.currentTime, paused: audio.paused });
  });

  /* ---------- init ---------- */
  panel.classList.toggle('open', !!state.open);
  loadTrack(state.trackIndex, false);
  if (!state.paused) {
    audio.addEventListener('loadedmetadata', function once() {
      audio.play().catch(function () { setNeedsTap(true); });
      audio.removeEventListener('loadedmetadata', once);
    });
  }

  /* Lets play.js's in-battle theme system duck this player out of the way when an Australiana
     battle theme starts. Resuming afterwards is left to the player tapping play again. */
  window.TravisMusic = {
    duck: function () { if (!audio.paused) audio.pause(); }
  };
})();
