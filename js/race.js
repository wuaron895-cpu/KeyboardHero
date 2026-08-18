/* ============================================================
   race.js —— 打字赛车（竞速模式）。
   1000 米赛道：每局 30 个高频词，打对一词 +33.3 米，
   打错一词倒扣 16.7 米（下限 0）；幽灵车按历史最佳 WPM
   匀速前进，先冲线者胜。训练点：单词连打节奏与 WPM 冲刺
   （对应第 17 关）。
   依赖 data.js 与 app.js（须在二者之后加载）。
   ============================================================ */
(function () {
  'use strict';

  var KF = window.KeyForce, D = window.KeyForceData;
  var store = KF.store, audio = KF.audio;

  function $(id) { return document.getElementById(id); }

  var TOTAL_WORDS = 30;   // 每局词数（写死）
  var DIST = 1000;        // 赛道米数（写死）

  // 模块状态
  var C = {
    built: false,
    running: false,       // 本局进行中（rAF 开关）
    finished: false,      // 已冲线（胜或负），停止输入与推进
    words: [], wi: 0,     // 本局词表 / 当前词下标
    pos: 0,               // 词内字符光标
    wronged: false,       // 当前词是否已记过一次错误（一词只扣一次）
    switching: false,     // 切词过渡中（词打完的短暂停顿，忽略输入）
    correctWords: 0, wrongWords: 0, correctChars: 0,
    elapsed: 0,
    hasGhost: false, ghostSpeed: 0, ghostM: 0,
    lastTs: 0, rafId: 0,
    token: 0              // 局令牌：作废残留 setTimeout
  };

  /* ==================== 屏幕 DOM（运行时动态构建） ==================== */
  function buildScreens() {
    if (C.built) { return; }
    C.built = true;

    var s = document.createElement('section');
    s.id = 'screen-race';
    s.className = 'screen';
    s.innerHTML =
      '<header class="bar">' +
        '<button id="rc-btn-back" class="btn btn-back">← 返回</button>' +
        '<h2>打字赛车</h2>' +
        '<span class="hud-item rc-hud">WPM <b id="rc-wpm">0</b></span>' +
        '<span class="hud-item rc-hud" id="rc-lead-wrap">🏁 <b id="rc-lead">—</b></span>' +
      '</header>' +
      '<div class="rc-wrap">' +
        '<div id="rc-word" class="rc-word"></div>' +
        '<div class="rc-track" id="rc-track">' +
          '<div class="rc-lane-line"></div>' +
          '<div class="rc-finish">🏁</div>' +
          '<div id="rc-ghost" class="rc-car rc-ghost"><span class="rc-car-in">🏎️</span><span class="rc-ghost-badge">👻</span></div>' +
          '<div id="rc-player" class="rc-car rc-player"><span class="rc-car-in">🏎️</span></div>' +
        '</div>' +
        '<div class="rc-dash">' +
          '<span class="ts-item">里程 <b id="rc-meters">0</b> / 1000m</span>' +
          '<span class="ts-item">单词 <b id="rc-wcount">0</b>/' + TOTAL_WORDS + '</span>' +
          '<span class="ts-item" id="rc-ghost-tip">—</span>' +
        '</div>' +
        '<p class="rc-tip">💡 单词打完会自动冲向下一词，打错字母会倒退一点</p>' +
      '</div>' +
      '<div id="rc-intro" class="overlay hidden">' +
        '<div class="panel pop">' +
          '<h3>🏎️ 打字赛车</h3>' +
          '<div class="result-rows">30 个单词跑完 1000 米：打对加速，打错倒退。<br>单词打完自动冲向下一词，和幽灵车比谁先冲线！</div>' +
          '<div class="panel-btns"><button id="rc-btn-start" class="btn btn-primary">发车</button></div>' +
        '</div>' +
      '</div>' +
      '<div id="rc-result" class="overlay hidden">' +
        '<div class="panel pop">' +
          '<h3 id="rc-res-title">🏆 冠军！</h3>' +
          '<div id="rc-res-msg" class="unlock-msg ok"></div>' +
          '<div class="result-rows">' +
            '<div>用时：<b id="rc-res-time">0 s</b></div>' +
            '<div>WPM：<b id="rc-res-wpm">0</b></div>' +
            '<div id="rc-res-cups" class="unlock-msg ok"></div>' +
          '</div>' +
          '<div class="panel-btns">' +
            '<button id="rc-btn-retry" class="btn btn-primary">↻ 再来一局</button>' +
            '<button id="rc-btn-menu" class="btn">返回</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(s);

    $('rc-btn-back').addEventListener('click', function () {
      if (C.running && !confirm('确定退出本场比赛吗？')) { return; }
      cleanup();
      KF.refreshMenu();
    });
    $('rc-btn-start').addEventListener('click', beginRound);
    $('rc-btn-retry').addEventListener('click', beginRound);
    $('rc-btn-menu').addEventListener('click', function () { cleanup(); KF.refreshMenu(); });
  }

  /* ==================== 开始 / 清理 ==================== */
  function start() {
    buildScreens();
    KF.show('screen-race');
    beginRound();
  }

  // 中途退出：停止一切，回到模块自身入口（发车面板）
  function abort() {
    cleanup();
    if (C.built) {
      KF.show('screen-race');
      $('rc-intro').classList.remove('hidden');
    }
  }

  function cleanup() {
    C.token++;
    C.running = false;
    C.finished = false;
    cancelAnimationFrame(C.rafId);
    if (!C.built) { return; }
    $('rc-result').classList.add('hidden');
    $('rc-intro').classList.add('hidden');
  }

  function beginRound() {
    buildScreens();
    cleanup();
    // 随机抽 30 个词，同局不重复
    var pool = D.WORDS.slice();
    C.words = [];
    while (C.words.length < TOTAL_WORDS && pool.length) {
      C.words.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    C.wi = 0; C.pos = 0; C.wronged = false; C.switching = false;
    C.correctWords = 0; C.wrongWords = 0; C.correctChars = 0;
    C.elapsed = 0;
    // 幽灵车 =「按历史最佳 WPM 完赛的自己」：30 词 ≈ 24 标准词当量，
    // 完赛时间 ≈ 1440/WPM 秒 → 速度 = 1000×WPM/1440 ≈ 0.7×WPM 米/秒（赢它 ≈ 刷纪录）
    var bestWpm = (store.get('stats', {}) || {}).bestWpm || 0;
    C.hasGhost = bestWpm > 0;
    C.ghostSpeed = Math.max(2.0, bestWpm * 0.7); // 米/秒
    C.ghostM = 0;
    $('rc-ghost').style.display = C.hasGhost ? '' : 'none';
    $('rc-ghost-tip').textContent = C.hasGhost ? '幽灵车配速 ' + bestWpm + ' WPM' : '暂无纪录，暂无幽灵车';
    $('rc-lead').textContent = C.hasGhost ? '并驾齐驱' : '—';
    renderWord();
    placeCars();
    updateHud();
    KF.show('screen-race');
    C.running = true;
    C.lastTs = 0; // 首帧再建立时间基准（不混用 performance.now 与 rAF 时间戳）
    cancelAnimationFrame(C.rafId);
    C.rafId = requestAnimationFrame(tick);
  }

  /* ==================== 进度模型（规格写死） ==================== */
  function playerMeters() {
    return Math.max(0, C.correctWords - C.wrongWords * 0.5) / TOTAL_WORDS * DIST;
  }

  /* ==================== 主循环（rAF，步长钳制） ==================== */
  function tick(ts) {
    if (!C.running) { return; }
    if (!C.lastTs) { C.lastTs = ts; }
    var dt = Math.max(0, Math.min(0.05, (ts - C.lastTs) / 1000));
    C.lastTs = ts;
    C.elapsed += dt;
    // 幽灵车连续推进；先冲线则玩家落败
    if (C.hasGhost && !C.finished) {
      C.ghostM = C.elapsed * C.ghostSpeed;
      if (C.ghostM >= DIST) { lose(); return; }
    }
    placeCars();
    updateHud();
    C.rafId = requestAnimationFrame(tick);
  }

  // 里程 → 赛道横向定位（左右各留 4%/8% 边距）
  function placeCars() {
    var pm = Math.min(playerMeters(), DIST);
    $('rc-player').style.left = (4 + pm / DIST * 88) + '%';
    if (C.hasGhost) {
      var gm = Math.min(C.ghostM, DIST);
      $('rc-ghost').style.left = (4 + gm / DIST * 88) + '%';
      var diff = Math.round(pm - gm);
      $('rc-lead').textContent = diff >= 0 ? '领先 ' + diff + ' 米' : '落后 ' + (-diff) + ' 米';
    }
  }

  function updateHud() {
    var min = C.elapsed / 60;
    $('rc-wpm').textContent = min > 0 ? Math.round(C.correctChars / 5 / min) : 0;
    $('rc-meters').textContent = Math.round(Math.min(playerMeters(), DIST));
    $('rc-wcount').textContent = C.correctWords;
  }

  /* ==================== 目标词渲染 ==================== */
  function renderWord() {
    var box = $('rc-word');
    box.innerHTML = '';
    var w = C.words[C.wi] || '';
    for (var i = 0; i < w.length; i++) {
      var ch = document.createElement('span');
      ch.className = 'rc-ch' + (i === 0 ? ' cur' : '');
      ch.textContent = w.charAt(i);
      box.appendChild(ch);
    }
  }

  function markCur() {
    var kids = $('rc-word').querySelectorAll('.rc-ch'); // 只圈字符，不含提示胶囊
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('cur', i === C.pos);
    }
  }

  // 打错：当前字符红闪 + 车尾刹车红光；一个词只记一次错误
  function markWrong() {
    if (!C.wronged) { C.wronged = true; C.wrongWords++; }
    var kids = $('rc-word').querySelectorAll('.rc-ch');
    var cur = kids[Math.min(C.pos, kids.length - 1)];
    if (cur) {
      cur.classList.add('badflash');
      setTimeout(function () { cur.classList.remove('badflash'); }, 350);
    }
    var car = $('rc-player');
    car.classList.add('braking');
    setTimeout(function () { car.classList.remove('braking'); }, 300);
  }

  /* ==================== 输入处理 ==================== */
  // 词内敲字母：必须打对才前进；打完自动切下一词（试玩反馈：不再要求按空格）
  function typeChar(lk) {
    if (C.switching) { return; } // 切词停顿中，忽略输入
    var w = C.words[C.wi];
    if (!w) { return; }
    if (lk === w.charAt(C.pos)) {
      var kids = $('rc-word').querySelectorAll('.rc-ch');
      if (kids[C.pos]) { kids[C.pos].classList.add('done'); }
      C.pos++;
      C.correctChars++;
      audio.correct();
      if (C.pos >= w.length) { wordDone(); return; }
      markCur();
    } else {
      audio.error();
      markWrong();
    }
    updateHud();
  }

  // 单词打完：计进里程 + 冲刺动画，稍作停顿自动切换；末词直接冲线结算
  function wordDone() {
    C.correctWords++;
    C.switching = true;
    audio.item(); // 轻快上扬音
    var car = $('rc-player');
    car.classList.remove('boost');
    void car.offsetWidth; // 强制重排，让动画可重复触发
    car.classList.add('boost');
    placeCars();
    updateHud();
    var token = C.token;
    if (playerMeters() >= DIST || C.wi + 1 >= C.words.length) {
      setTimeout(function () { if (token === C.token) { win(); } }, 350);
      return;
    }
    setTimeout(function () {
      if (token !== C.token) { return; }
      C.wi++;
      C.pos = 0;
      C.wronged = false;
      C.switching = false;
      renderWord();
      updateHud();
    }, 250); // 停顿 250ms：让玩家看到整词变绿的完成感
  }

  /* ==================== 冲线结算 ==================== */
  function settle(win_) {
    C.finished = true;
    C.running = false;
    cancelAnimationFrame(C.rafId);
    var timeR = Math.round(C.elapsed * 10) / 10;
    var min = C.elapsed / 60;
    var wpm = min > 0 ? Math.round(C.correctChars / 5 / min) : 0;
    $('rc-res-time').textContent = timeR + ' s';
    $('rc-res-wpm').textContent = wpm;
    if (win_) {
      var cups = 15;
      // 刷新历史最快用时：额外 +10 杯
      var prev = store.get('race_best', 0);
      var isNew = !prev || C.elapsed < prev;
      if (isNew) { store.set('race_best', Math.round(C.elapsed * 10) / 10); cups += 10; }
      KF.addCups(cups);
      $('rc-res-title').textContent = '🏆 冠军！';
      $('rc-res-msg').textContent = isNew ? '新纪录！' : '率先冲线！';
      $('rc-res-msg').className = 'unlock-msg ok';
      $('rc-res-cups').textContent = '+' + cups + ' 🏆' + (isNew ? '（含新纪录 +10）' : '');
      audio.ach();
      confetti();
    } else {
      $('rc-res-title').textContent = '💨 惜败';
      $('rc-res-msg').textContent = '幽灵车先冲线了，再快一点！';
      $('rc-res-msg').className = 'unlock-msg no';
      $('rc-res-cups').textContent = '+0 🏆';
      audio.error();
    }
    var token = C.token;
    setTimeout(function () {
      if (token !== C.token) { return; }
      $('rc-result').classList.remove('hidden');
    }, win_ ? 900 : 400); // 胜利时先看一眼彩带
  }
  function win() { settle(true); }
  function lose() { settle(false); }

  // 冲线彩带：🎉 飘落（令牌防残留）
  function confetti() {
    var track = $('rc-track');
    var token = C.token;
    for (var i = 0; i < 18; i++) {
      (function (i2) {
        setTimeout(function () {
          if (token !== C.token) { return; }
          var d = document.createElement('div');
          d.className = 'rc-confetti';
          d.textContent = '🎉';
          d.style.left = (4 + Math.random() * 90) + '%';
          track.appendChild(d);
          setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 2300);
        }, i2 * 90);
      })(i);
    }
  }

  /* ==================== 键盘输入 ==================== */
  document.addEventListener('keydown', function (ev) {
    if (!C.running || C.finished) { return; }
    if (!$('screen-race').classList.contains('active')) { return; }
    if (!$('rc-result').classList.contains('hidden')) { return; }
    if (!$('rc-intro').classList.contains('hidden')) { return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
    var k = ev.key;
    if (!k) { return; }
    if (k === ' ') { ev.preventDefault(); return; } // 空格已不参与玩法，仅防页面滚动
    var lk = k.toLowerCase(); // 单词全小写，统一转小写比较
    if (lk.length !== 1 || lk < 'a' || lk > 'z') { return; }
    ev.preventDefault();
    typeChar(lk);
  });

  /* ==================== 对外接口 ==================== */
  KF.race = { start: start, abort: abort };
})();
