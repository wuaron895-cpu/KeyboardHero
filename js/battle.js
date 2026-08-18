/* ============================================================
   battle.js —— 键盘保卫战：植物大战僵尸式五路塔防。
   敌人（emoji + 字母/单词标签）从右端生成，沿 5 条草坪路向左
   走向基地（🏠 HP 100）；玩家敲键锁定并击杀。波次制，
   每第 5 波出 BOSS；连击倍率 ×1~×5。rAF 驱动，
   音效全部 WebAudio 现场合成。
   依赖 data.js 与 app.js（须最后加载）。
   ============================================================ */
(function () {
  'use strict';

  var KF = window.KeyForce, D = window.KeyForceData;
  var store = KF.store, audio = KF.audio;

  function $(id) { return document.getElementById(id); }

  var LANES = 5;
  var BASE_X = 70;          // 基地判定线：敌人 x ≤ 此值即咬到基地
  var BASE_HP = 100;
  var EMOJI = { normal: '🧟', elite: '🧟‍♂️', boss: '👹' };
  var DMG   = { normal: 10, elite: 20, boss: 40 };   // 漏怪扣血
  var SCORE = { normal: 10, elite: 25, boss: 100 };  // 击杀基础分

  // 战斗状态机
  var B = {
    running: false,      // 战斗是否进行中（rAF 循环开关）
    paused: false,       // 暂停
    hero: null,          // 当前英雄配置（data.js HEROES）
    score: 0, hp: BASE_HP,
    combo: 0, maxCombo: 0, mult: 1, kills: 0,
    wave: 0, spawned: 0, waveTotal: 0, spawnAcc: 0,
    bossSpawned: false,  // 本波 BOSS 是否已刷出
    leaksThisWave: 0,    // 本波漏怪数（0 = 完美防守）
    enemies: [],         // 场上敌人 [{id,el,type,text,typed,lane,x,y,speed}]
    locked: null,        // 当前锁定的目标敌人（同时只锁一个）
    idSeq: 1,
    lastTs: 0, rafId: 0,
    intermission: false, // 波次过场中（暂停刷怪与移动）
    overlayToken: 0,     // 过场计时令牌：使上一局残留的 setTimeout 失效
    wordLists: null      // 按长度分桶的单词表
  };

  function field() { return $('battle-field'); }
  function laneH() { return field().clientHeight / LANES; }

  /* ==================== 词表工具 ==================== */
  function wordsByLen(min, max) {
    return D.WORDS.filter(function (w) { return w.length >= min && w.length <= max; });
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickBossWord() { return pick(D.BOSS_WORDS); }
  function pickChar() { return pick(D.POOLS[B.hero.pool].split('')); }

  /* ==================== 开始 / 结束 ==================== */
  function start(heroId) {
    var h = null;
    D.HEROES.forEach(function (x) { if (x.id === heroId) { h = x; } });
    if (!h) { return; }
    B.hero = h;
    B.score = 0; B.hp = BASE_HP;
    B.combo = 0; B.maxCombo = 0; B.mult = 1; B.kills = 0;
    B.wave = 0; B.idSeq = 1;
    B.paused = false; B.intermission = false;
    B.locked = null;
    // 单词长度分桶：词霸模式 杂兵 2-4 字母，精英 5-6；字母模式精英 3-6
    B.wordLists = { w24: wordsByLen(2, 4), w36: wordsByLen(3, 6), w56: wordsByLen(5, 6) };
    clearEnemies();
    KF.show('screen-battle');
    $('btn-battle-pause').textContent = '⏸ 暂停';
    $('battle-pause-overlay').classList.add('hidden');
    updateHud();
    B.running = true;
    B.lastTs = performance.now();
    nextWave();
    cancelAnimationFrame(B.rafId);
    B.rafId = requestAnimationFrame(tick);
  }

  // 中途撤退：结算杯数，不破纪录，作废残留计时，返回英雄选择
  function abort() {
    if (B.running) {
      B.running = false;
      cancelAnimationFrame(B.rafId);
      KF.addCups(Math.floor(B.score / 50)); // 杯数 = floor(得分 / 50)
      clearEnemies();
    }
    B.paused = false;
    B.overlayToken++; // 作废可能残留的过场计时
    $('battle-overlay').classList.add('hidden');
    $('battle-pause-overlay').classList.add('hidden');
    if (KF.renderHeroes) { KF.renderHeroes(); }
    KF.show('screen-heroes');
  }

  function gameOver() {
    B.running = false;
    cancelAnimationFrame(B.rafId);
    B.overlayToken++; // 作废过场回调，主循环此后不再访问已清空状态
    clearEnemies();
    audio.boom();

    // 杯数结算
    var cups = Math.floor(B.score / 50);
    KF.addCups(cups);

    // 该英雄历史最佳
    var bb = store.get('battle_best', {});
    var prev = bb[B.hero.id] || 0;
    var isNew = B.score > prev;
    if (isNew) { bb[B.hero.id] = B.score; store.set('battle_best', bb); }

    // 结算屏
    $('over-score').textContent = B.score;
    $('over-kills').textContent = B.kills;
    $('over-maxcombo').textContent = B.maxCombo;
    $('over-cups').textContent = '🏆 +' + cups;
    $('over-best').textContent = Math.max(prev, B.score);
    $('over-newbest').classList.toggle('hidden', !isNew);
    KF.show('screen-battle-over');
  }

  /* ==================== 波次控制 ==================== */
  function nextWave() {
    B.wave++;
    B.spawned = 0;
    B.leaksThisWave = 0;
    B.bossSpawned = false;
    B.waveTotal = 6 + (B.wave - 1) * 2;
    var bossWave = (B.wave % 5 === 0);
    if (bossWave) { B.waveTotal += 1; } // 每第 5 波额外 1 只 BOSS
    B.spawnAcc = 1e9; // 过场一结束立刻刷第一个
    B.intermission = true;
    showOverlay('第 ' + B.wave + ' 波' + (bossWave ? ' 👹' : ''), 1500, function () { B.intermission = false; });
    if (bossWave) { audio.boss(); } // BOSS 出场低音滑音
    updateHud();
  }

  // 一波打完后：无漏怪 → 完美防守横幅 + 加分，然后下一波
  function endWave() {
    B.intermission = true;
    if (B.leaksThisWave === 0) {
      B.score += 100;
      audio.perfect();
      showOverlay('完美防守！+100', 1400, function () { nextWave(); });
    } else {
      nextWave();
    }
    updateHud();
  }

  function showOverlay(text, ms, cb) {
    var ov = $('battle-overlay');
    var token = ++B.overlayToken; // 令牌递增，旧的计时回调自动作废
    $('battle-overlay-text').textContent = text;
    ov.classList.remove('hidden');
    setTimeout(function () {
      if (token !== B.overlayToken) { return; } // 已被新局/新波次取代
      ov.classList.add('hidden');
      if (cb) { cb(); }
    }, ms);
  }

  /* ==================== 暂停 ==================== */
  function togglePause() {
    if (!B.running) { return; }
    B.paused = !B.paused;
    $('battle-pause-overlay').classList.toggle('hidden', !B.paused);
    $('btn-battle-pause').textContent = B.paused ? '▶ 继续' : '⏸ 暂停';
  }

  /* ==================== 主循环（rAF） ==================== */
  function tick(ts) {
    if (!B.running) { return; }
    var dt = Math.min(0.05, (ts - B.lastTs) / 1000); // 钳制步长，防止切后台后跳变
    B.lastTs = ts;

    if (!B.intermission && !B.paused) {
      // 刷怪：波内按间隔从随机路线刷出
      if (B.spawned < B.waveTotal) {
        B.spawnAcc += dt * 1000;
        var interval = Math.max(1200, 2600 - (B.wave - 1) * 140);
        if (B.spawnAcc >= interval) { B.spawnAcc = 0; spawnEnemy(); }
      }
      // 敌人向左推进（倒序遍历，便于咬基地时原地移除）
      for (var i = B.enemies.length - 1; i >= 0; i--) {
        var e = B.enemies[i];
        e.x -= e.speed * dt;
        position(e);
        if (e.x <= BASE_X) { bite(e); }
        // 咬基地可能已触发 gameOver 并清空敌人数组，立即退出遍历
        if (!B.running) { break; }
      }
      // 本波清空 → 波次结算
      if (B.running && B.spawned >= B.waveTotal && B.enemies.length === 0 && B.hp > 0) {
        endWave();
      }
    }
    B.rafId = requestAnimationFrame(tick);
  }

  /* ==================== 敌人生成与渲染 ==================== */
  function spawnEnemy() {
    // 类型：BOSS 波首刷 BOSS；其余按概率出精英，波次越高精英越多
    var type = 'normal';
    if (B.wave % 5 === 0 && !B.bossSpawned) {
      type = 'boss';
      B.bossSpawned = true;
    } else if (Math.random() < Math.min(0.08 + B.wave * 0.04, 0.4)) {
      type = 'elite';
    }

    // 标签文本：字母模式 杂兵=池中单字母、精英=3-6 字母词；
    //           词霸模式 杂兵=2-4 字母词、精英=5-6 字母词；BOSS 一律 7+ 长词
    var text;
    if (type === 'boss') {
      text = pickBossWord();
    } else if (type === 'elite') {
      text = B.hero.mode === 'word' ? pick(B.wordLists.w56) : pick(B.wordLists.w36);
    } else {
      text = B.hero.mode === 'word' ? pick(B.wordLists.w24) : pickChar();
    }

    var lane = Math.floor(Math.random() * LANES);
    var fw = field().clientWidth;
    // 速度：杂兵慢、精英中、BOSS 最慢；随波次加快并带个体随机
    var speedBase = B.hero.speed * (type === 'boss' ? 0.55 : type === 'elite' ? 0.8 : 1);
    var speed = speedBase * (1 + (B.wave - 1) * 0.07) * (0.9 + Math.random() * 0.2);

    var el = document.createElement('div');
    el.className = 'enemy e-' + type;
    var lab = document.createElement('div');
    lab.className = 'e-label';
    var em = document.createElement('div');
    em.className = 'e-emoji';
    em.textContent = EMOJI[type];
    el.appendChild(lab);
    el.appendChild(em);

    var lh = laneH();
    var e = {
      id: B.idSeq++,
      el: el,
      type: type,
      text: text,
      typed: 0,      // 单词型敌人已输入的字符数
      lane: lane,
      x: fw + 60,    // 从右端屏外走进来
      y: lane * lh + lh / 2 - (type === 'boss' ? 62 : 42),
      speed: speed
    };
    paintLabel(e);
    position(e);
    field().appendChild(el);
    B.enemies.push(e);
    B.spawned++;
  }

  function position(e) {
    e.el.style.transform = 'translate(' + e.x + 'px,' + e.y + 'px)';
  }

  // 重画敌人标签：已输入部分变绿（单词型敌人的锁定进度）
  function paintLabel(e) {
    var lab = e.el.querySelector('.e-label');
    lab.innerHTML = '';
    for (var i = 0; i < e.text.length; i++) {
      var s = document.createElement('span');
      s.className = 'e-ch' + (i < e.typed ? ' hit' : '');
      s.textContent = e.text.charAt(i);
      lab.appendChild(s);
    }
  }

  function removeEnemy(e) {
    var idx = B.enemies.indexOf(e);
    if (idx >= 0) { B.enemies.splice(idx, 1); }
    if (B.locked === e) { B.locked = null; }
    if (e.el.parentNode) { e.el.parentNode.removeChild(e.el); }
  }

  function clearEnemies() {
    B.enemies.forEach(function (e) {
      if (e.el.parentNode) { e.el.parentNode.removeChild(e.el); }
    });
    B.enemies = [];
    B.locked = null;
  }

  /* ==================== 击杀 / 失误 / 咬基地 ==================== */
  function kill(e) {
    var idx = B.enemies.indexOf(e);
    if (idx < 0) { return; }
    B.enemies.splice(idx, 1);
    if (B.locked === e) { B.locked = null; }

    // 连击与倍率：每连续 5 杀升 1 级，封顶 ×5；升级时爆 COMBO 大字
    B.combo++;
    if (B.combo > B.maxCombo) { B.maxCombo = B.combo; }
    var newMult = Math.min(5, 1 + Math.floor(B.combo / 5));
    if (newMult > B.mult) {
      B.mult = newMult;
      comboPop('COMBO ×' + newMult + '!');
    }

    // 得分 = 基础分 × 连击倍率 × 英雄得分倍率
    var gain = Math.round(SCORE[e.type] * B.mult * B.hero.scoreMult);
    B.score += gain;
    B.kills++;
    audio.laser();
    scorePop(e, '+' + gain);

    // 击杀动画：弹跳缩放消失
    e.el.classList.remove('locked');
    e.el.classList.add('dying');
    var el = e.el;
    setTimeout(function () { if (el.parentNode) { el.parentNode.removeChild(el); } }, 220);
    updateHud();
  }

  // 按错键：连击清零 + 错误音
  function miss() {
    B.combo = 0;
    B.mult = 1;
    audio.error();
    updateHud();
  }

  // 敌人咬到基地：扣血 + 红屏闪 + 震屏 + 警报；HP 归零游戏结束
  function bite(e) {
    removeEnemy(e);
    B.hp = Math.max(0, B.hp - DMG[e.type]);
    B.leaksThisWave++;
    B.combo = 0;
    B.mult = 1;
    audio.alarm();
    var f = field();
    f.classList.remove('shake', 'bitten');
    void f.offsetWidth; // 强制重排，让动画可重复触发
    f.classList.add('shake', 'bitten');
    updateHud();
    if (B.hp <= 0) { gameOver(); }
  }

  /* ==================== 浮动特效 ==================== */
  // 击杀爆分小字：在敌人位置上浮淡出
  function scorePop(e, text) {
    var d = document.createElement('div');
    d.className = 'pop-text';
    d.textContent = text;
    d.style.left = (e.x + 10) + 'px';
    d.style.top = (e.y - 6) + 'px';
    field().appendChild(d);
    setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 820);
  }

  // 倍率升级：中央弹跳大字
  function comboPop(text) {
    var d = document.createElement('div');
    d.className = 'combo-pop';
    d.textContent = text;
    field().appendChild(d);
    setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 900);
  }

  /* ==================== 键盘输入 ==================== */
  document.addEventListener('keydown', function (ev) {
    if (!B.running || B.paused) { return; }
    if (!$('screen-battle').classList.contains('active')) { return; }
    if (B.intermission) { return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
    var k = (ev.key || '').toLowerCase();
    if (!/^[a-z;]$/.test(k)) { return; } // 只响应字母与分号（基准行池含 ;）
    ev.preventDefault();
    handleKey(k);
  });

  // 锁定规则：优先推进已锁定目标；否则锁定「离基地最近（x 最小）
  // 且以该字母开头」的敌人。单字母敌人直接击杀。
  function handleKey(k) {
    var e = B.locked;
    if (e && B.enemies.indexOf(e) < 0) { e = B.locked = null; } // 锁定的目标已不在场
    if (e) {
      if (e.text.charAt(e.typed) === k) {
        e.typed++;
        paintLabel(e);
        audio.correct();
        if (e.typed >= e.text.length) { kill(e); }
      } else {
        miss();
      }
      return;
    }
    // 寻找新目标：首字符匹配的所有敌人里 x 最小的
    var target = null;
    B.enemies.forEach(function (en) {
      if (en.text.charAt(0) === k && (!target || en.x < target.x)) { target = en; }
    });
    if (!target) { miss(); return; }
    if (target.text.length === 1) { kill(target); return; } // 单字母杂兵一击毙命
    B.locked = target;
    target.typed = 1;
    B.enemies.forEach(function (en) { en.el.classList.toggle('locked', en === target); });
    paintLabel(target);
    audio.correct();
  }

  /* ==================== HUD ==================== */
  function updateHud() {
    $('battle-score').textContent = B.score;
    $('battle-wave').textContent = B.wave;
    $('battle-combo').textContent = B.combo;
    $('battle-mult').textContent = '×' + B.mult;
    var hp = $('battle-hp-fill');
    hp.style.width = B.hp + '%';
    hp.className = B.hp > 50 ? 'hp-ok' : B.hp > 25 ? 'hp-warn' : 'hp-low';
  }

  /* ==================== 对外接口与按钮绑定 ==================== */
  KF.battle = { start: start, abort: abort };

  $('btn-battle-quit').addEventListener('click', abort);
  $('btn-battle-pause').addEventListener('click', togglePause);
  $('battle-pause-overlay').addEventListener('click', togglePause); // 点暂停浮层也可继续
  $('btn-over-retry').addEventListener('click', function () { start(B.hero.id); });
  $('btn-over-heroes').addEventListener('click', function () {
    if (KF.renderHeroes) { KF.renderHeroes(); }
    KF.show('screen-heroes');
  });
  $('btn-over-menu').addEventListener('click', function () { KF.refreshMenu(); });
})();
