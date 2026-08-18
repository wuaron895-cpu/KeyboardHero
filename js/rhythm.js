/* ============================================================
   rhythm.js —— 节奏模式（打字版太鼓达人）。
   选歌后音符从顶部向判定线匀速下落，音符上标键名与简谱；
   敲对应键：±150ms Perfect；提前 600ms ~ 延后 350ms 为 Good，
   错键、空敲或过线 350ms 未敲均为 Miss。曲终按准确率
   评级 S/A/B/C 发杯数，刷新单曲最高评级有加成。
   依赖 data.js 与 app.js（须在二者之后加载）。
   ============================================================ */
(function () {
  'use strict';

  var KF = window.KeyForce, D = window.KeyForceData;
  var store = KF.store, audio = KF.audio;

  function $(id) { return document.getElementById(id); }

  /* ==================== 键位映射（规格书写死，勿改） ==================== */
  // 简谱 → 键盘键：基准行 a s d f g h j k l ; + 上排 r t + 空格（休止）
  // 高音简谱 = 数字 + U+0307（组合上加点），与 data.js SONG_SCALE 的键一致
  var DEG_KEY = {
    '1': 'a', '2': 's', '3': 'd', '4': 'f', '5': 'g', '6': 'h', '7': 'j',
    '1̇': 'k', '2̇': 'l', '3̇': ';', '4̇': 'r', '5̇': 't',
    '0': ' '
  };
  var VALID_KEYS = 'asdfghjkl;rt '; // 模块可响应的全部键

  /* ==================== 曲库（写死在本文件，勿动 data.js） ==================== */
  // [简谱, 拍数]；1 = 一拍；bpm 为每分钟拍数
  var SONGS = [
    // 试玩反馈「入门反应不过来」：六首歌拉成 55→100 的渐进梯度，第一首足够慢
    { name: '小星星', bpm: 55, notes: [
      ['1',1],['1',1],['5',1],['5',1],['6',1],['6',1],['5',2],['0',1],
      ['4',1],['4',1],['3',1],['3',1],['2',1],['2',1],['1',2],['0',1],
      ['5',1],['5',1],['4',1],['4',1],['3',1],['3',1],['2',2],['0',1],
      ['5',1],['5',1],['4',1],['4',1],['3',1],['3',1],['2',2],['0',1],
      ['1',1],['1',1],['5',1],['5',1],['6',1],['6',1],['5',2],['0',1],
      ['4',1],['4',1],['3',1],['3',1],['2',1],['2',1],['1',3]
    ]},
    { name: '欢乐颂', bpm: 75, notes: [
      ['3',1],['3',1],['4',1],['5',1],['5',1],['4',1],['3',1],['2',1],
      ['1',1],['1',1],['2',1],['3',1],['3',1.5],['2',0.5],['2',2],
      ['3',1],['3',1],['4',1],['5',1],['5',1],['4',1],['3',1],['2',1],
      ['1',1],['1',1],['2',1],['3',1],['2',1.5],['1',0.5],['1',2]
    ]},
    { name: '两只老虎', bpm: 85, notes: [
      ['1',1],['2',1],['3',1],['1',1],['1',1],['2',1],['3',1],['1',1],
      ['3',1],['4',1],['5',2],['3',1],['4',1],['5',2],
      ['5',0.5],['6',0.5],['5',0.5],['4',0.5],['3',1],['1',1],
      ['5',0.5],['6',0.5],['5',0.5],['4',0.5],['3',1],['1',1],
      ['1',1],['5',1],['1',2],['1',1],['5',1],['1',2]
    ]},
    { name: '生日快乐', bpm: 90, notes: [
      ['5',0.75],['5',0.25],['6',1],['5',1],['1̇',1],['7',2],
      ['5',0.75],['5',0.25],['6',1],['5',1],['2̇',1],['1̇',2],
      ['5',0.75],['5',0.25],['5̇',1],['3̇',1],['1̇',1],['7',1],['6',2],
      ['4̇',0.75],['4̇',0.25],['3̇',1],['1̇',1],['2̇',1],['1̇',2]
    ]},
    { name: '铃儿响叮当', bpm: 95, notes: [
      ['3',1],['3',1],['3',2],['3',1],['3',1],['3',2],['3',1],['5',1],['1',1],['2',1],['3',3],
      ['4',1],['4',1],['4',1],['4',1],['4',1],['3',1],['3',1],['3',1],['3',1],['2',1],['2',1],['3',1],['2',1],['5',2],
      ['3',1],['3',1],['3',2],['3',1],['3',1],['3',2],['3',1],['5',1],['1',1],['2',1],['3',3],
      ['4',1],['4',1],['4',1],['4',1],['4',1],['3',1],['3',1],['3',1],['5',1],['5',1],['4',1],['2',1],['1',3]
    ]},
    { name: '新年好', bpm: 100, notes: [
      ['1',0.5],['1',0.5],['1',1],['5',1],['3',0.5],['3',0.5],['3',1],['1',1],
      ['1',0.5],['3',0.5],['5',0.5],['5',0.5],['5',2],
      ['2',0.5],['2',0.5],['2',1],['4',1],['3',0.5],['2',0.5],['5',2],
      ['3',0.5],['3',0.5],['2',0.5],['2',0.5],['1',2]
    ]}
  ];

  /* ==================== 判定常量 ==================== */
  // 试玩反馈「入门反应不过来」：大宽容窗口 + 更长预览；
  // 早敲宽容（提前 600ms 内都算 Good）、晚敲适度（延后 350ms），
  // 符合孩子「看见音符就先下手」的习惯
  var WIN_PERFECT = 0.15;   // ±150ms
  var WIN_GOOD_EARLY = 0.6; // 最早可提前 600ms 敲（Good）
  var WIN_GOOD_LATE = 0.35; // 最晚可延后 350ms 敲（超过则漏击）
  var LEAD = 2.4;           // 音符从顶部落到判定线的秒数（匀速）
  var NOTE_H = 64;         // 音符圆盘高度（与 CSS 一致）
  var LINE_BOTTOM = 82;    // 判定线距下落区底部的像素（与 CSS 一致）

  // 游戏状态
  var R = {
    built: false,        // 屏幕 DOM 是否已建
    running: false,      // 本曲进行中（rAF 开关）
    songIdx: 0, song: null,
    notes: [],           // {deg,key,time,judged,el,fadeAt}
    elapsed: 0,          // 曲子进行秒（钳制步长累计）
    total: 0,            // 末音符判定线时刻
    score: 0, combo: 0, maxCombo: 0,
    perfect: 0, good: 0, miss: 0,
    lastTs: 0, rafId: 0,
    token: 0,            // 局令牌：作废残留 setTimeout
    lineTop: 0, speed: 0,
    nextKey: ''          // 当前 .next 高亮的键（避免重复 DOM 操作）
  };

  /* ==================== 屏幕 DOM（运行时动态构建） ==================== */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (html !== undefined) { e.innerHTML = html; }
    return e;
  }

  function buildScreens() {
    if (R.built) { return; }
    R.built = true;

    // —— 选曲屏 ——
    var sel = el('section', 'screen');
    sel.id = 'screen-rhythm';
    sel.innerHTML =
      '<header class="bar">' +
        '<button id="rh-btn-back" class="btn btn-back">← 返回</button>' +
        '<h2>节奏模式</h2>' +
      '</header>' +
      '<p class="rh-tip">🎵 键盘即琴键：音符落到黄线的一瞬，敲下对应的键！</p>' +
      '<div id="rh-songs" class="level-grid"></div>' +
      '<p class="rh-keys-hint">键位 <b>A S D F G H J K L ; R T ␣</b>（空格 = 休止符）</p>';
    document.body.appendChild(sel);

    // —— 游戏屏 ——
    var play = el('section', 'screen');
    play.id = 'screen-rhythm-play';
    play.innerHTML =
      '<header class="bar">' +
        '<button id="rh-btn-quit" class="btn btn-back">← 返回</button>' +
        '<h2 id="rh-song-name">—</h2>' +
        '<span class="hud-item rh-hud">得分 <b id="rh-score">0</b></span>' +
        '<span class="hud-item rh-hud">连击 <b id="rh-combo">0</b></span>' +
        '<span class="rh-goal">S：≥95% 且 0 Miss · A：≥90% · B：≥75%</span>' +
      '</header>' +
      '<div id="rh-stage">' +
        '<div id="rh-progress"><div id="rh-progress-fill"></div></div>' +
        '<div id="rh-fall">' +
          '<div id="rh-notes"></div>' +
          '<div id="rh-judge-line"></div>' +
          '<div id="rh-hint" class="rh-hint hidden">' +
            '<div class="rh-hint-cap"><span id="rh-hint-key">A</span></div>' +
            '<div id="rh-hint-deg" class="rh-hint-deg">1</div>' +
          '</div>' +
        '</div>' +
        '<div id="rh-kb" class="kb rh-kb"></div>' +
      '</div>' +
      '<div id="rh-result" class="overlay hidden">' +
        '<div class="panel pop">' +
          '<h3>演奏完成</h3>' +
          '<div id="rh-res-rank" class="rh-rank">S</div>' +
          '<div class="result-rows">' +
            '<div>得分：<b id="rh-res-score">0</b></div>' +
            '<div>准确率：<b id="rh-res-acc">0%</b></div>' +
            '<div>Perfect / Good / Miss：<b id="rh-res-pgm">0 / 0 / 0</b></div>' +
            '<div>最大连击：<b id="rh-res-combo">0</b></div>' +
            '<div id="rh-res-cups" class="unlock-msg ok"></div>' +
          '</div>' +
          '<div class="panel-btns">' +
            '<button id="rh-btn-retry" class="btn btn-primary">↻ 再来一局</button>' +
            '<button id="rh-btn-songs" class="btn">返回选曲</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(play);

    buildKb();

    // 按钮绑定
    $('rh-btn-back').addEventListener('click', function () { KF.refreshMenu(); });
    $('rh-btn-quit').addEventListener('click', function () {
      if (R.running && !confirm('确定要中途退出吗？本曲将没有杯数奖励。')) { return; }
      abort();
    });
    $('rh-btn-retry').addEventListener('click', function () { startSong(R.songIdx); });
    $('rh-btn-songs').addEventListener('click', function () { abort(); });
  }

  // 底部 13 键简化键盘（自建 DOM，复用全局 .kb/.key 样式与手指配色）
  var KB_ROWS = [
    ['r', 't'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
    [' ']
  ];
  var KEY_FINGER = {
    a: 'lp', s: 'lr', d: 'lm', f: 'li', g: 'li',
    h: 'ri', j: 'ri', k: 'rm', l: 'rr', ';': 'rp',
    r: 'li', t: 'li', ' ': 'thumb'
  };
  var kbMap = {};
  function buildKb() {
    var kb = $('rh-kb');
    KB_ROWS.forEach(function (row) {
      var r = el('div', 'kb-row');
      row.forEach(function (ch) {
        var k = el('div', 'key f-' + KEY_FINGER[ch]);
        k.setAttribute('data-key', ch);
        k.textContent = (ch === ' ') ? '␣' : ch.toUpperCase();
        if (ch === ' ') { k.classList.add('rh-key-space'); }
        if (ch === 'f' || ch === 'j') { k.classList.add('bump'); }
        kbMap[ch] = k;
        r.appendChild(k);
      });
      kb.appendChild(r);
    });
  }

  /* ==================== 选曲屏 ==================== */
  function renderSongs() {
    var grid = $('rh-songs');
    grid.innerHTML = '';
    var best = store.get('rhythm_best', {});
    SONGS.forEach(function (s, i) {
      var card = el('button', 'level-card');
      var b = best[s.name];
      card.innerHTML =
        '<div class="lv-num">BPM ' + s.bpm + ' · ' + s.notes.length + ' 音</div>' +
        '<div class="lv-name">' + s.name + '</div>' +
        '<div class="lv-stars">' + (b ? '最高评级 ' + b : '尚未演奏') + '</div>';
      card.addEventListener('click', function () { startSong(i); });
      grid.appendChild(card);
    });
  }

  /* ==================== 开始 / 退出 ==================== */
  function start() {
    buildScreens();
    renderSongs();
    KF.show('screen-rhythm');
  }

  // 中途退出：清理本曲状态，回到模块自身入口（选曲屏）
  function abort() {
    R.token++;
    R.running = false;
    cancelAnimationFrame(R.rafId);
    R.notes = [];
    if (R.built) {
      $('rh-notes').innerHTML = '';
      $('rh-result').classList.add('hidden');
      $('rh-hint').classList.add('hidden');
      clearNext();
      renderSongs();
      KF.show('screen-rhythm');
    }
  }

  function startSong(idx) {
    buildScreens();
    R.token++;
    R.songIdx = idx;
    R.song = SONGS[idx];
    R.notes = [];
    R.elapsed = 0;
    R.score = 0; R.combo = 0; R.maxCombo = 0;
    R.perfect = 0; R.good = 0; R.miss = 0;
    R.nextKey = '';
    // 排程：首音 LEAD 秒后到线（此时它刚好从顶部出现），逐音累加拍数
    var spb = 60 / R.song.bpm, t = LEAD;
    R.song.notes.forEach(function (n) {
      R.notes.push({ deg: n[0], key: DEG_KEY[n[0]], time: t, judged: null, el: null, fadeAt: 0 });
      t += n[1] * spb;
    });
    R.total = t; // 末音到线时刻
    $('rh-song-name').textContent = '♪ ' + R.song.name;
    $('rh-result').classList.add('hidden');
    $('rh-notes').innerHTML = '';
    updateHud();
    KF.show('screen-rhythm-play');
    // 可见后才能量尺寸：判定线 y 与下落速度
    var h = $('rh-fall').clientHeight;
    R.lineTop = h - LINE_BOTTOM - NOTE_H / 2; // 音符顶部位于此值时，圆心压线
    R.speed = (R.lineTop + NOTE_H) / LEAD;
    R.running = true;
    R.lastTs = 0; // 首帧再建立时间基准（不混用 performance.now 与 rAF 时间戳）
    cancelAnimationFrame(R.rafId);
    R.rafId = requestAnimationFrame(tick);
  }

  /* ==================== 主循环（rAF，步长钳制） ==================== */
  function tick(ts) {
    if (!R.running) { return; }
    if (!R.lastTs) { R.lastTs = ts; }
    var dt = Math.max(0, Math.min(0.05, (ts - R.lastTs) / 1000)); // 钳制，防切后台跳变
    R.lastTs = ts;
    R.elapsed += dt;

    var layer = $('rh-notes');
    var i, n, y;
    for (i = 0; i < R.notes.length; i++) {
      n = R.notes[i];
      var rel = n.time - R.elapsed; // >0：尚未到线
      // 已判定：淡出后移除
      if (n.judged) {
        if (n.el && R.elapsed >= n.fadeAt) {
          if (n.el.parentNode) { n.el.parentNode.removeChild(n.el); }
          n.el = null;
        }
        continue;
      }
      // 漏击：过线 350ms 未敲
      if (rel < -WIN_GOOD_LATE) { judgeMiss(n, true); continue; }
      // 即将进入可视区：创建 DOM
      if (!n.el && rel <= LEAD + 0.1) {
        n.el = el('div', 'rh-note');
        n.el.setAttribute('data-key', n.key);
        n.el.innerHTML =
          '<span class="rh-note-key">' + (n.key === ' ' ? '␣' : n.key.toUpperCase()) + '</span>' +
          '<span class="rh-note-deg">' + n.deg + '</span>';
        layer.appendChild(n.el);
      }
      // 匀速下落（transform 更新）
      if (n.el) {
        y = R.lineTop - rel * R.speed;
        n.el.style.transform = 'translate(-50%,' + y + 'px)';
      }
    }

    updateHint();
    $('rh-progress-fill').style.width = Math.min(100, R.elapsed / R.total * 100) + '%';

    // 曲终：过末音且全部判定完毕
    if (R.elapsed > R.total && allJudged()) { finish(); return; }
    R.rafId = requestAnimationFrame(tick);
  }

  function allJudged() {
    for (var i = 0; i < R.notes.length; i++) {
      if (!R.notes[i].judged) { return false; }
    }
    return true;
  }

  /* ==================== 判定 ==================== */
  // 找「最靠前未判定且在判定窗口内」的音符（音符按时间升序，首个命中即最靠前）
  function findHittable() {
    for (var i = 0; i < R.notes.length; i++) {
      var n = R.notes[i];
      if (n.judged) { continue; }
      var diff = R.elapsed - n.time; // <0 未到判定时刻（早敲），>0 已过线（晚敲）
      if (diff >= -WIN_GOOD_EARLY && diff <= WIN_GOOD_LATE) { return n; }
      if (diff < -WIN_GOOD_EARLY) { break; } // 后面的音符离得更远，不必再看
    }
    return null;
  }

  function judgeMiss(n, silent) {
    n.judged = 'miss';
    n.fadeAt = R.elapsed + 0.3;
    if (n.el) { n.el.classList.add('j-miss'); }
    R.miss++;
    R.combo = 0;
    if (!silent) { audio.error(); }
    pop('Miss', 'j-miss-txt');
    updateHud();
  }

  function handleKey(k) {
    flashKey(k);
    var n = findHittable();
    if (n && n.key === k) {
      var dt = Math.abs(R.elapsed - n.time);
      var perfect = dt <= WIN_PERFECT;
      n.judged = perfect ? 'perfect' : 'good';
      if (perfect) { R.perfect++; } else { R.good++; }
      n.fadeAt = R.elapsed + 0.18;
      if (n.el) { n.el.classList.add(perfect ? 'j-perfect' : 'j-good'); }
      R.score += perfect ? 100 : 60;
      R.combo++;
      if (R.combo > R.maxCombo) { R.maxCombo = R.combo; }
      // 奏响该音；休止符只给极轻 tick
      var freq = D.SONG_SCALE[n.deg] || 0;
      if (freq > 0) { audio.note(freq); } else { audio.tick(); }
      pop(perfect ? 'Perfect' : 'Good', perfect ? 'j-perfect-txt' : 'j-good-txt');
      if (R.combo > 0 && R.combo % 20 === 0) { comboPop('COMBO ×' + R.combo); }
    } else if (n) {
      judgeMiss(n, false); // 窗口内敲错键：该音符判 Miss
    } else {
      // 空敲（时机偏差过大）：Miss 反馈 + 连击清零，不消耗音符
      R.miss++;
      R.combo = 0;
      audio.error();
      pop('Miss', 'j-miss-txt');
    }
    updateHud();
  }

  /* ==================== 提示与反馈 ==================== */
  // 判定线下方的巨型键帽：只在下一个音符到线前 800ms 内显示
  function updateHint() {
    var next = null;
    for (var i = 0; i < R.notes.length; i++) {
      if (!R.notes[i].judged) { next = R.notes[i]; break; }
    }
    var hint = $('rh-hint');
    if (next) {
      var rel = next.time - R.elapsed;
      if (rel >= 0 && rel <= 0.8) {
        $('rh-hint-key').textContent = (next.key === ' ' ? '␣' : next.key.toUpperCase());
        $('rh-hint-deg').textContent = next.deg;
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
      setNext(next.key);
    } else {
      hint.classList.add('hidden');
      clearNext();
    }
  }

  function setNext(k) {
    if (R.nextKey === k) { return; }
    clearNext();
    var el2 = kbMap[k];
    if (el2) { el2.classList.add('next'); R.nextKey = k; }
  }
  function clearNext() {
    if (R.nextKey && kbMap[R.nextKey]) { kbMap[R.nextKey].classList.remove('next'); }
    R.nextKey = '';
  }

  // 敲键时的键帽按压闪烁（键位常驻 DOM，延时移除 class 无残留风险）
  function flashKey(k) {
    var el2 = kbMap[k];
    if (!el2) { return; }
    el2.classList.add('press');
    setTimeout(function () { el2.classList.remove('press'); }, 100);
  }

  // 判定反馈字：在判定线位置弹出淡出（复用全局 floatUp 动画）
  function pop(text, cls) {
    var fall = $('rh-fall');
    if (!fall) { return; }
    var d = el('div', 'j-pop ' + cls);
    d.textContent = text;
    fall.appendChild(d);
    setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 820);
  }

  // 连击大字（复用全局 .combo-pop 样式）
  function comboPop(text) {
    var fall = $('rh-fall');
    if (!fall) { return; }
    var d = el('div', 'combo-pop');
    d.textContent = text;
    fall.appendChild(d);
    setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 900);
  }

  function updateHud() {
    $('rh-score').textContent = R.score;
    $('rh-combo').textContent = R.combo;
  }

  /* ==================== 曲终结算 ==================== */
  function finish() {
    R.running = false;
    cancelAnimationFrame(R.rafId);
    clearNext();
    $('rh-hint').classList.add('hidden');

    var judgedTotal = R.perfect + R.good + R.miss;
    var acc = judgedTotal > 0 ? (R.perfect + R.good) / judgedTotal * 100 : 0;
    var rank, cups;
    if (R.miss === 0 && acc >= 95) { rank = 'S'; cups = 30; }
    else if (acc >= 90) { rank = 'A'; cups = 20; }
    else if (acc >= 75) { rank = 'B'; cups = 10; }
    else { rank = 'C'; cups = 5; }

    // 刷新该曲历史最高评级：额外 +10 杯
    var ORDER = { S: 4, A: 3, B: 2, C: 1 };
    var best = store.get('rhythm_best', {});
    var prev = best[R.song.name];
    var isNew = !prev || ORDER[rank] > ORDER[prev];
    if (isNew) { best[R.song.name] = rank; store.set('rhythm_best', best); cups += 10; }
    KF.addCups(cups);

    var accR = Math.round(acc * 10) / 10;
    $('rh-res-rank').textContent = rank;
    $('rh-res-rank').className = 'rh-rank rk-' + rank;
    $('rh-res-score').textContent = R.score;
    $('rh-res-acc').textContent = accR + '%';
    $('rh-res-pgm').textContent = R.perfect + ' / ' + R.good + ' / ' + R.miss;
    $('rh-res-combo').textContent = R.maxCombo;
    $('rh-res-cups').textContent = '+' + cups + ' 🏆' + (isNew ? '（含新纪录 +10）' : '');
    audio.unlock();
    var token = R.token;
    setTimeout(function () {
      if (token !== R.token) { return; }
      $('rh-result').classList.remove('hidden');
    }, 600); // 稍等最后一个音符的击中动画播完
  }

  /* ==================== 键盘输入 ==================== */
  document.addEventListener('keydown', function (ev) {
    if (!R.running) { return; }
    if (!$('screen-rhythm-play').classList.contains('active')) { return; }
    if (!$('rh-result').classList.contains('hidden')) { return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
    var k = (ev.key === ' ') ? ' ' : (ev.key || '').toLowerCase();
    if (k.length !== 1 || VALID_KEYS.indexOf(k) < 0) { return; }
    ev.preventDefault();
    handleKey(k);
  });

  /* ==================== 对外接口 ==================== */
  KF.rhythm = { start: start, abort: abort };
})();
