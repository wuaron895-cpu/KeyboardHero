/* ============================================================
   bomb.js —— 拆弹专家（倒计时剪线）。
   90 秒倒计时内逐句敲对 3 句英文短句（含大写 + 句号），
   每句剪断一根线；3 句全对拆除成功，按剩余时间与准确率计分；
   归零则爆炸。训练点：短句在压力下的实战（对应第 18 关）。
   依赖 data.js 与 app.js（须在二者之后加载）。
   ============================================================ */
(function () {
  'use strict';

  var KF = window.KeyForce, D = window.KeyForceData;
  var store = KF.store, audio = KF.audio;

  function $(id) { return document.getElementById(id); }

  var TIME = 90;          // 倒计时秒数（试玩反馈：60s 新手必爆，放宽到 90s）
  var READY_MS = 1500;    // 开局「准备」横幅时长（不计时）

  // 模块状态
  var B = {
    built: false,
    running: false,       // 本局进行中（rAF 开关）
    started: false,       // 准备横幅结束、计时已开始
    sentences: [],        // 本局 3 句（取自 D.SENTENCES，不重复）
    si: 0, pos: 0,        // 当前句下标 / 句内字符光标
    errors: 0, correct: 0,
    remain: TIME,
    lastTs: 0, rafId: 0,
    token: 0,             // 局令牌：作废残留 setTimeout
    tickTimer: 0,         // 滴答 setTimeout 链句柄
    imeShown: false       // 输入法提示每局只弹一次
  };

  /* ==================== 自建音效（参考 app.js 写法，音量 ≤0.2） ==================== */
  var AC = null;
  function ac() {
    if (!AC) {
      var A = window.AudioContext || window.webkitAudioContext;
      AC = new A();
    }
    if (AC.state === 'suspended') { AC.resume(); }
    return AC;
  }
  function soundOn() { return !store.get('muted', false); }

  // 打错的尖锐警报「滴」
  function beep() {
    if (!soundOn()) { return; }
    try {
      var c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(880, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(620, c.currentTime + 0.09);
      g.gain.setValueAtTime(0.16, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.11);
    } catch (e) {}
  }

  // 剪线「咔嚓」：极短噪声爆破
  function snap() {
    if (!soundOn()) { return; }
    try {
      var c = ac();
      var len = Math.floor(c.sampleRate * 0.07);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * (1 - i / len); }
      var src = c.createBufferSource(); src.buffer = buf;
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
      var g = c.createGain();
      g.gain.setValueAtTime(0.18, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start();
    } catch (e) {}
  }

  /* ==================== 屏幕 DOM（运行时动态构建） ==================== */
  function buildScreens() {
    if (B.built) { return; }
    B.built = true;

    var s = document.createElement('section');
    s.id = 'screen-bomb';
    s.className = 'screen';
    s.innerHTML =
      '<header class="bar">' +
        '<button id="bmb-btn-back" class="btn btn-back">← 返回</button>' +
        '<h2>拆弹专家</h2>' +
        '<span class="hud-item bmb-hud">⏱ <b id="bmb-time">90.0</b> s</span>' +
        '<span class="hud-item bmb-hud">错误 <b id="bmb-errors">0</b></span>' +
        '<span class="hud-item bmb-hud">准确率 <b id="bmb-acc">100%</b></span>' +
      '</header>' +
      '<div class="bmb-wrap">' +
        '<div class="bmb-box" id="bmb-box">' +
          '<div class="bmb-timerbar"><div id="bmb-timer-fill"></div></div>' +
          '<div id="bmb-emoji" class="bmb-emoji">💣</div>' +
          '<div class="bmb-wires" id="bmb-wires"></div>' +
        '</div>' +
        '<div id="bmb-sentence" class="bmb-sentence"></div>' +
        '<div class="bmb-shift-row"><div id="bmb-shift-hint" class="bmb-shift-hint hidden"></div></div>' +
        '<p class="bmb-tip">逐句敲对即可剪线 · 打错不前进 · 大写请用另一侧小指按住 Shift</p>' +
      '</div>' +
      '<div id="bmb-ready" class="bmb-ready hidden"><span>💣 准备拆弹…</span></div>' +
      '<div id="bmb-ime" class="bmb-ime hidden">⚠ 输入法未关闭！按 Shift 切到英文</div>' +
      '<div id="bmb-flash" class="bmb-flash hidden"></div>' +
      '<div id="bmb-intro" class="overlay hidden">' +
        '<div class="panel pop">' +
          '<h3>💣 拆弹专家</h3>' +
          '<div class="result-rows">90 秒内敲对 3 句英文短句，剪断全部 3 根线。<br>打错不会前进，倒计时归零就爆炸！</div>' +
          '<div class="panel-btns"><button id="bmb-btn-start" class="btn btn-primary">开始拆弹</button></div>' +
        '</div>' +
      '</div>' +
      '<div id="bmb-result" class="overlay hidden">' +
        '<div class="panel pop">' +
          '<h3 id="bmb-res-title">拆除成功！</h3>' +
          '<div id="bmb-res-msg" class="unlock-msg ok"></div>' +
          '<div class="result-rows">' +
            '<div>得分：<b id="bmb-res-score">0</b></div>' +
            '<div>准确率：<b id="bmb-res-acc">0%</b></div>' +
            '<div>剩余时间：<b id="bmb-res-time">—</b></div>' +
            '<div id="bmb-res-cups" class="unlock-msg ok"></div>' +
          '</div>' +
          '<div class="panel-btns">' +
            '<button id="bmb-btn-retry" class="btn btn-primary">↻ 再来一局</button>' +
            '<button id="bmb-btn-menu" class="btn">返回</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(s);

    $('bmb-btn-back').addEventListener('click', function () {
      if (B.running && !confirm('确定放弃本次拆弹吗？')) { return; }
      cleanup();
      KF.refreshMenu();
    });
    $('bmb-btn-start').addEventListener('click', beginRound);
    $('bmb-btn-retry').addEventListener('click', beginRound);
    $('bmb-btn-menu').addEventListener('click', function () { cleanup(); KF.refreshMenu(); });
  }

  /* ==================== 开始 / 清理 ==================== */
  function start() {
    buildScreens();
    KF.show('screen-bomb');
    beginRound();
  }

  // 中途退出：停止一切，回到模块自身入口（开始面板）
  function abort() {
    cleanup();
    if (B.built) {
      KF.show('screen-bomb');
      $('bmb-intro').classList.remove('hidden');
    }
  }

  function cleanup() {
    B.token++;
    B.running = false;
    B.started = false;
    cancelAnimationFrame(B.rafId);
    clearTimeout(B.tickTimer);
    if (!B.built) { return; }
    $('bmb-result').classList.add('hidden');
    $('bmb-ready').classList.add('hidden');
    $('bmb-ime').classList.add('hidden');
    $('bmb-flash').classList.add('hidden');
  }

  function beginRound() {
    buildScreens();
    cleanup();
    // 随机抽 3 句，不重复
    var pool = D.SENTENCES.slice();
    B.sentences = [];
    while (B.sentences.length < 3 && pool.length) {
      B.sentences.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    B.si = 0; B.pos = 0;
    B.errors = 0; B.correct = 0;
    B.remain = TIME;
    B.imeShown = false;
    renderWires();
    renderSentence();
    updateHud();
    $('bmb-intro').classList.add('hidden');
    KF.show('screen-bomb');
    // 1.5s 准备横幅（不计时），令牌防残留
    $('bmb-ready').classList.remove('hidden');
    B.running = true;
    B.lastTs = 0; // 首帧再建立时间基准（不混用 performance.now 与 rAF 时间戳）
    cancelAnimationFrame(B.rafId);
    B.rafId = requestAnimationFrame(tick);
    var token = B.token;
    setTimeout(function () {
      if (token !== B.token) { return; }
      $('bmb-ready').classList.add('hidden');
      B.started = true;
      tickChain();
    }, READY_MS);
  }

  /* ==================== 主循环（rAF 倒计时，步长钳制） ==================== */
  function tick(ts) {
    if (!B.running) { return; }
    if (!B.lastTs) { B.lastTs = ts; }
    var dt = Math.max(0, Math.min(0.05, (ts - B.lastTs) / 1000));
    B.lastTs = ts;
    if (B.started) {
      B.remain -= dt;
      if (B.remain <= 0) { B.remain = 0; updateHud(); explode(); return; }
      updateHud();
    }
    B.rafId = requestAnimationFrame(tick);
  }

  // 滴答声链：越接近爆炸滴答越密（音量小，复用极轻 tick）
  function tickChain() {
    if (!B.running || !B.started) { return; }
    audio.tick();
    var interval = B.remain > 20 ? 1000 : B.remain > 10 ? 500 : 250;
    B.tickTimer = setTimeout(tickChain, interval);
  }

  /* ==================== 渲染 ==================== */
  var WIRES = [['w-red', '红线'], ['w-blue', '蓝线'], ['w-yellow', '黄线']];
  function renderWires() {
    var box = $('bmb-wires');
    box.innerHTML = '';
    WIRES.forEach(function (w) {
      var wire = document.createElement('div');
      wire.className = 'bmb-wire ' + w[0];
      wire.innerHTML =
        '<span class="whalf l"></span><span class="whalf r"></span>' +
        '<span class="bmb-wire-name">' + w[1] + '</span>';
      box.appendChild(wire);
    });
  }

  // 目标句：空格显示 ␣；光标下划线，打对变绿，打错红闪（train-text 视觉语言）
  function renderSentence() {
    var box = $('bmb-sentence');
    box.innerHTML = '';
    var s = B.sentences[B.si] || '';
    for (var i = 0; i < s.length; i++) {
      var ch = document.createElement('span');
      ch.className = 'bmb-ch' + (i === 0 ? ' cur' : '');
      ch.textContent = s.charAt(i) === ' ' ? '␣' : s.charAt(i);
      box.appendChild(ch);
    }
    updateShiftHint();
  }

  function markCur() {
    var kids = $('bmb-sentence').children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('cur', i === B.pos);
    }
    updateShiftHint();
  }

  // 大写 Shift 随行提示（与训练页同一规则：打左手字母按右 Shift，反之亦然）。
  // 当前字符为大写时显示；敲对前进后自动更新/隐藏并解除加急态。
  var LEFT_HAND = 'qwertasdfgzxcvb';
  function updateShiftHint() {
    var h = $('bmb-shift-hint');
    var s = B.sentences[B.si] || '';
    var ch = s.charAt(B.pos);
    h.classList.remove('urgent');
    if (/^[A-Z]$/.test(ch)) {
      var side = LEFT_HAND.indexOf(ch.toLowerCase()) >= 0 ? '右' : '左';
      h.textContent = '⇧ 按住' + side + ' Shift 敲「' + ch + '」';
      h.classList.remove('hidden');
    } else {
      h.classList.add('hidden');
    }
  }

  // 字母对但大小写反了（试玩反馈：不知原因会卡关）：给出明确的加急提示
  function caseHint(expect) {
    var h = $('bmb-shift-hint');
    if (/^[A-Z]$/.test(expect)) {
      updateShiftHint(); // 该大写却只敲了小写：保持 Shift 提示
    } else {
      h.textContent = '⇧ 这里不用大写，松开 Shift 再敲「' + expect + '」';
      h.classList.remove('hidden');
    }
    h.classList.remove('urgent');
    void h.offsetWidth; // 强制重排，让动画可重复触发
    h.classList.add('urgent');
  }

  function flashBad() {
    var box = $('bmb-sentence');
    box.classList.remove('flash-bad');
    void box.offsetWidth; // 强制重排，让动画可重复触发
    box.classList.add('flash-bad');
    var cur = box.children[B.pos];
    if (cur) {
      cur.classList.add('badflash');
      setTimeout(function () { cur.classList.remove('badflash'); }, 350);
    }
  }

  function updateHud() {
    $('bmb-time').textContent = B.remain.toFixed(1);
    $('bmb-errors').textContent = B.errors;
    var total = B.correct + B.errors;
    $('bmb-acc').textContent = (total > 0 ? Math.round(B.correct / total * 1000) / 10 : 100) + '%';
    // 倒计时条：>20s 绿、>10s 黄、≤10s 红；≤10s 炸弹心跳加速
    var fill = $('bmb-timer-fill');
    fill.style.width = Math.max(0, B.remain / TIME * 100) + '%';
    fill.className = B.remain > 20 ? 't-ok' : B.remain > 10 ? 't-warn' : 't-danger';
    $('bmb-emoji').classList.toggle('panic', B.started && B.remain <= 10);
  }

  /* ==================== 剪线 / 成功 / 爆炸 ==================== */
  function cutWire(i) {
    var wires = $('bmb-wires').children;
    if (wires[i]) { wires[i].classList.add('cut'); }
    snap();
  }

  function success() {
    cleanup();
    var remainSec = Math.max(0, Math.round(B.remain));
    var score = remainSec * 10 + B.correct * 5;
    var cups = 20;
    // 刷新历史最高分：额外 +10 杯
    var prev = store.get('bomb_best', 0);
    var isNew = score > prev;
    if (isNew) { store.set('bomb_best', score); cups += 10; }
    KF.addCups(cups);

    flash('gold');
    audio.unlock();
    $('bmb-res-title').textContent = '🎉 拆除成功！';
    $('bmb-res-msg').textContent = isNew ? '新纪录！' : '干得漂亮！';
    $('bmb-res-msg').className = 'unlock-msg ok';
    $('bmb-res-score').textContent = score;
    $('bmb-res-time').textContent = remainSec + ' s';
    $('bmb-res-cups').textContent = '+' + cups + ' 🏆' + (isNew ? '（含新纪录 +10）' : '');
    showResult();
  }

  function explode() {
    cleanup();
    audio.boom();
    flash('red');
    var box = $('bmb-box');
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
    $('bmb-res-title').textContent = '💥 炸弹爆炸了';
    $('bmb-res-msg').textContent = '差一点！再来一次';
    $('bmb-res-msg').className = 'unlock-msg no';
    $('bmb-res-score').textContent = '0';
    $('bmb-res-time').textContent = '—';
    $('bmb-res-cups').textContent = '+0 🏆';
    showResult();
  }

  function showResult() {
    var total = B.correct + B.errors;
    $('bmb-res-acc').textContent = (total > 0 ? Math.round(B.correct / total * 1000) / 10 : 100) + '%';
    var token = B.token;
    setTimeout(function () {
      if (token !== B.token) { return; }
      $('bmb-result').classList.remove('hidden');
    }, 700); // 等闪光/震动动画播完
  }

  // 全屏闪光：red = 爆炸红闪，gold = 成功金闪
  function flash(kind) {
    var f = $('bmb-flash');
    f.className = 'bmb-flash ' + kind;
    var token = B.token;
    setTimeout(function () {
      if (token !== B.token) { return; }
      f.classList.add('hidden');
    }, 800);
  }

  /* ==================== 键盘输入 ==================== */
  document.addEventListener('keydown', function (ev) {
    if (!B.running) { return; }
    if (!$('screen-bomb').classList.contains('active')) { return; }
    if (!$('bmb-result').classList.contains('hidden')) { return; }
    if (!$('bmb-intro').classList.contains('hidden')) { return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
    // 中文输入法未关闭：每局提示一次
    if (ev.isComposing || ev.key === 'Process') {
      if (!B.imeShown) {
        B.imeShown = true;
        $('bmb-ime').classList.remove('hidden');
      }
      return;
    }
    var k = ev.key;
    if (!k || k.length !== 1) { return; } // 忽略 Shift 等功能键本身
    ev.preventDefault();
    if (!B.started) { return; } // 准备横幅阶段不计输入

    var s = B.sentences[B.si];
    if (!s) { return; }
    var expect = s.charAt(B.pos);
    if (k === expect) { // ev.key 直接比较，大写由浏览器给出
      var kids = $('bmb-sentence').children;
      if (kids[B.pos]) { kids[B.pos].classList.add('done'); }
      B.correct++;
      B.pos++;
      audio.correct();
      if (B.pos >= s.length) {
        cutWire(B.si); // 敲完一句（含句号）→ 剪断对应一根线
        B.si++;
        if (B.si >= B.sentences.length) { success(); return; }
        B.pos = 0;
        renderSentence();
      }
      markCur();
    } else {
      B.errors++;
      beep();
      flashBad();
      // 字母对但大小写反了：告诉玩家原因，否则会卡在这里
      if (/^[a-z]$/i.test(expect) && k.toLowerCase() === expect.toLowerCase()) {
        caseHint(expect);
      }
    }
    updateHud();
  });

  /* ==================== 对外接口 ==================== */
  KF.bomb = { start: start, abort: abort };
})();
