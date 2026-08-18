/* ============================================================
   battle.js —— 键盘保卫战：植物大战僵尸式五路塔防。
   敌人（emoji + 字母/单词标签）从右端生成，沿 5 条草坪路向左
   走向基地（🏠 HP 100）；玩家敲键锁定并击杀。波次制，
   每第 5 波出 BOSS；连击倍率 ×1~×5。rAF 驱动，
   音效全部 WebAudio 现场合成。
   依赖 data.js 与 app.js（须最后加载）。

   增强内容（v2）：
   - 锁定可转移：敲「更危险敌人」的首字母自动切换目标；Esc 取消锁定
   - 5 类敌人：杂兵 / 快速虫 / 盾牌兵（先敲破盾键）/ 诱饵（敲它扣分）/ BOSS
   - 击杀掉落道具（精英 25% / BOSS 必掉）：冰冻 / 回血 / 双倍分 / 空袭
   - 技能系统：击杀攒能量，满格按 1-4 释放（冰冻/闪电清路/护盾/治疗）
   - 局内升级：每 3 波三选一强化（连击保护、破甲、磁吸等）
   - 危险预警：敌人逼近基地变红 + 心跳音；锁定目标带准星
   - 爽感反馈：连击音高递增、字母碎屑飞散、完美防守全屏特效
   ============================================================ */
(function () {
  'use strict';

  var KF = window.KeyForce, D = window.KeyForceData;
  var store = KF.store, audio = KF.audio;

  function $(id) { return document.getElementById(id); }

  var LANES = 5;
  var BASE_X = 70;          // 基地判定线：敌人 x ≤ 此值即咬到基地
  var BASE_HP = 100;
  var ENERGY_MAX = 20;      // 技能能量上限
  var DANGER_X = 260;       // 危险警戒线：敌人 x 小于此值进入预警
  var DEFS = D.ENEMY_DEFS;  // 敌人类型数值（data.js）

  // 战斗状态机
  var B = {
    running: false,      // 战斗是否进行中（rAF 循环开关）
    paused: false,       // 暂停
    hero: null,          // 当前英雄配置（data.js HEROES）
    score: 0, hp: BASE_HP, hpMax: BASE_HP,
    combo: 0, maxCombo: 0, mult: 1, kills: 0,
    misses: 0,           // 本局按错次数（成就/统计用）
    wave: 0, spawned: 0, waveTotal: 0, spawnAcc: 0,
    bossSpawned: false,  // 本波 BOSS 是否已刷出
    leaksThisWave: 0,    // 本波漏怪数（0 = 完美防守）
    perfectWaves: 0,     // 本局完美防守波数（成就用）
    enemies: [],         // 场上敌人 [{id,el,type,text,typed,lane,x,y,speed}]
    locked: null,        // 当前锁定的目标敌人（同时只锁一个）
    idSeq: 1,
    lastTs: 0, rafId: 0,
    intermission: false, // 波次过场中（暂停刷怪与移动）
    overlayToken: 0,     // 过场计时令牌：使上一局残留的 setTimeout 失效
    bannerToken: 0,      // 道具横幅计时令牌
    wordLists: null,     // 按长度分桶的单词表
    // —— 增强状态 ——
    energy: 0,           // 技能能量 0~ENERGY_MAX
    shieldCharges: 0,    // 护盾剩余格挡次数
    frozenUntil: 0,      // 全场冰冻截止时间（performance.now 基准）
    doubleUntil: 0,      // 双倍分截止时间
    upgrades: [],        // 本局已获得升级 id 列表
    heartLast: 0,        // 心跳音节流时间戳
    imeHintLast: 0       // 输入法提示节流
  };

  function field() { return $('battle-field'); }
  function laneH() { return field().clientHeight / LANES; }
  function now() { return performance.now(); }
  function has(id) { return B.upgrades.indexOf(id) >= 0; }

  /* ==================== 词表工具 ==================== */
  function wordsByLen(min, max) {
    return D.WORDS.filter(function (w) { return w.length >= min && w.length <= max; });
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickBossWord() { return pick(D.BOSS_WORDS); }
  function pickChar() { return pick(D.POOLS[B.hero.pool].split('')); }

  // 精英词长随波次收窄：后期压力转向数量而非超长词（平衡性）
  function eliteWordList() {
    if (B.hero.mode !== 'word') { return B.wordLists.w36; }
    if (B.wave < 5) { return B.wordLists.w56; }
    if (B.wave < 10) { return B.wordLists.w46; }
    return B.wordLists.w36;
  }

  /* ==================== 开始 / 结束 ==================== */
  function start(heroId) {
    var h = null;
    D.HEROES.forEach(function (x) { if (x.id === heroId) { h = x; } });
    if (!h) { return; }
    B.hero = h;
    B.score = 0; B.hp = BASE_HP; B.hpMax = BASE_HP;
    B.combo = 0; B.maxCombo = 0; B.mult = 1; B.kills = 0;
    B.misses = 0; B.perfectWaves = 0;
    B.wave = 0; B.idSeq = 1;
    B.paused = false; B.intermission = false;
    B.locked = null;
    B.energy = 0; B.shieldCharges = 0;
    B.frozenUntil = 0; B.doubleUntil = 0;
    B.upgrades = [];
    B.heartLast = 0; B.imeHintLast = 0;
    // 单词长度分桶：词霸模式 杂兵 2-4 字母，精英 5-6（后期收窄）；字母模式精英 3-6
    B.wordLists = { w24: wordsByLen(2, 4), w36: wordsByLen(3, 6), w46: wordsByLen(4, 6), w56: wordsByLen(5, 6) };
    clearEnemies();
    KF.show('screen-battle');
    $('btn-battle-pause').textContent = '⏸ 暂停';
    $('battle-pause-overlay').classList.add('hidden');
    $('upgrade-overlay').classList.add('hidden');
    $('skill-hint').classList.add('hidden');
    $('item-banner').classList.add('hidden');
    updateHud();
    B.running = true;
    B.lastTs = performance.now();
    nextWave();
    cancelAnimationFrame(B.rafId);
    B.rafId = requestAnimationFrame(tick);
  }

  // 中途撤退：杯数减半结算（防快刷），不破纪录，作废残留计时，返回英雄选择
  function abort() {
    if (B.running) {
      B.running = false;
      cancelAnimationFrame(B.rafId);
      KF.addCups(Math.floor(B.score / 100)); // 撤退杯数减半：floor(得分/50) / 2
      if (KF.dailyCheck) { KF.dailyCheck(B.score); }
      clearEnemies();
    }
    B.paused = false;
    B.overlayToken++; // 作废可能残留的过场计时
    $('battle-overlay').classList.add('hidden');
    $('battle-pause-overlay').classList.add('hidden');
    $('upgrade-overlay').classList.add('hidden');
    $('skill-hint').classList.add('hidden');
    $('item-banner').classList.add('hidden');
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
    if (KF.dailyCheck) { KF.dailyCheck(B.score); }

    // 该英雄历史最佳
    var bb = store.get('battle_best', {});
    var prev = bb[B.hero.id] || 0;
    var isNew = B.score > prev;
    if (isNew) { bb[B.hero.id] = B.score; store.set('battle_best', bb); }

    // 「群英荟萃」成就：记录已用英雄，集齐全部已解锁英雄时解锁
    if (KF.ach) {
      var used = store.get('battle_heroes_used', []);
      if (used.indexOf(B.hero.id) < 0) {
        used.push(B.hero.id);
        store.set('battle_heroes_used', used);
      }
      var unlockedLv = store.get('unlocked', 1);
      var allOk = D.HEROES.every(function (hh) {
        return hh.unlock === 0 || unlockedLv > hh.unlock ? used.indexOf(hh.id) >= 0 : true;
      });
      if (allOk) { KF.ach('all_heroes'); }
    }

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
    showOverlay('第 ' + B.wave + ' 波' + (bossWave ? ' 👹' : ''), 1800, function () { B.intermission = false; });
    if (bossWave) { audio.boss(); } // BOSS 出场低音滑音
    if (B.wave === 15 && KF.ach) { KF.ach('wave15'); }
    updateHud();
  }

  // 一波打完后：无漏怪 → 完美防守横幅 + 加分；每 3 波或 BOSS 波后开三选一升级
  function endWave() {
    B.intermission = true;
    if (B.leaksThisWave === 0) {
      B.score += 100;
      B.perfectWaves++;
      audio.perfect();
      perfectFx();
      if (B.perfectWaves >= 5 && KF.ach) { KF.ach('perfect5'); }
      showOverlay('完美防守！+100', 1600, function () { thenUpgradeOrNext(); });
    } else {
      thenUpgradeOrNext();
    }
    updateHud();
  }

  // 波间节奏点：每 3 波 / BOSS 波后给一次三选一强化
  function thenUpgradeOrNext() {
    if (B.wave % 3 === 0 || B.wave % 5 === 0) { showUpgrades(); }
    else { nextWave(); }
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

  /* ==================== 局内升级三选一 ==================== */
  var curPicks = []; // 当前浮层展示的三个升级

  function showUpgrades() {
    var avail = D.UPGRADES.filter(function (u) { return B.upgrades.indexOf(u.id) < 0; });
    if (!avail.length) { nextWave(); return; }
    // 随机抽 3 个（不足 3 个时全给）
    var copy = avail.slice(), picks = [];
    while (picks.length < 3 && copy.length) {
      picks.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    curPicks = picks;
    var ov = $('upgrade-overlay');
    ov.innerHTML =
      '<div class="upgrade-title">⚡ 战利品 · 三选一</div>' +
      '<div class="upgrade-cards"></div>' +
      '<div class="upgrade-skip">跳过（Esc）</div>';
    var cards = ov.querySelector('.upgrade-cards');
    picks.forEach(function (u, i) {
      var c = document.createElement('div');
      c.className = 'upgrade-card';
      c.innerHTML =
        '<div class="u-icon">' + u.icon + '</div>' +
        '<div class="u-name">' + u.name + '</div>' +
        '<div class="u-desc">' + u.desc + '</div>' +
        '<div class="u-key">按 ' + (i + 1) + ' 选择</div>';
      c.addEventListener('click', function () { chooseUpgrade(i); });
      cards.appendChild(c);
    });
    ov.classList.remove('hidden');
    B.intermission = true; // 选择期间全场暂停
  }

  function chooseUpgrade(idx) {
    var u = curPicks[idx];
    $('upgrade-overlay').classList.add('hidden');
    if (!u) { nextWave(); return; }
    B.upgrades.push(u.id);
    audio.item();
    banner(u.icon + ' 获得「' + u.name + '」！');
    if (u.id === 'hp25') { // 生命扩容：上限与当前血量同步 +25
      B.hpMax += 25;
      B.hp = Math.min(B.hpMax, B.hp + 25);
    }
    updateHud();
    nextWave();
  }

  function skipUpgrade() {
    $('upgrade-overlay').classList.add('hidden');
    nextWave();
  }

  function upgradeOpen() {
    return !$('upgrade-overlay').classList.contains('hidden');
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

    if (!B.intermission && !B.paused && !upgradeOpen()) {
      var frozen = ts < B.frozenUntil;
      // 刷怪：波内按间隔从随机路线刷出。
      // 节奏提速（试玩反馈「开局太慢」）：波 1-2 用短间隔快节奏，之后随波次递减
      if (B.spawned < B.waveTotal) {
        B.spawnAcc += dt * 1000;
        var interval = (B.wave <= 2)
          ? (B.wave === 1 ? 1600 : 1500)
          : Math.max(1100, 2200 - (B.wave - 1) * 140);
        if (B.spawnAcc >= interval) { B.spawnAcc = 0; spawnEnemy(); }
      }
      // 敌人向左推进（倒序遍历，便于咬基地时原地移除）
      for (var i = B.enemies.length - 1; i >= 0; i--) {
        var e = B.enemies[i];
        e.x -= e.speed * dt * (frozen ? 0.15 : 1); // 冰冻全场：移动减至 15%
        e.el.classList.toggle('frozen', frozen);
        position(e);
        // 危险预警：进入警戒区变红 + 心跳音
        if (e.x < DANGER_X && e.x > BASE_X) {
          if (!e.el.classList.contains('danger')) {
            e.el.classList.add('danger');
            heartbeat();
          }
        } else {
          e.el.classList.remove('danger');
        }
        if (e.x <= BASE_X) { bite(e); }
        // 咬基地可能已触发 gameOver 并清空敌人数组，立即退出遍历
        if (!B.running) { break; }
      }
      // 冰冻结束：清除残留 frozen 类
      if (!frozen) {
        B.enemies.forEach(function (e) { e.el.classList.remove('frozen'); });
      }
      // 本波清空 → 波次结算
      if (B.running && B.spawned >= B.waveTotal && B.enemies.length === 0 && B.hp > 0) {
        endWave();
      }
    }
    B.rafId = requestAnimationFrame(tick);
  }

  /* ==================== 敌人生成与渲染 ==================== */
  // 类型分配：BOSS 波首刷 BOSS；精英概率随波次提升；
  // 其余按比例出 诱饵（3 波起）/ 快速虫 / 盾牌兵（2 波起）/ 杂兵
  function rollType() {
    if (B.wave % 5 === 0 && !B.bossSpawned) { B.bossSpawned = true; return 'boss'; }
    if (Math.random() < Math.min(0.08 + B.wave * 0.04, 0.4)) { return 'elite'; }
    var r = Math.random();
    if (B.wave >= 3 && r < 0.12) { return 'bait'; }
    if (B.wave >= 2 && r < 0.32) { return 'fast'; }
    if (B.wave >= 2 && r < 0.50) { return 'shield'; }
    return 'normal';
  }

  function spawnEnemy() {
    var type = rollType();
    // 平衡：词霸模式下，场上已有 3 只 5+ 字母长词时精英降级为杂兵，避免多路长词锁死
    if (type === 'elite' && B.hero.mode === 'word') {
      var longs = B.enemies.filter(function (e) { return e.text.length >= 5; }).length;
      if (longs >= 3) { type = 'normal'; }
    }

    // 标签文本：
    //   字母模式：杂兵/快速虫/诱饵=单字母，盾牌兵=破盾键+1 字母，精英=3-6 字母词；
    //   词霸模式：杂兵=2-4 词，快速虫/诱饵=2-3 词，盾牌兵=破盾键+2-4 词，精英=5-6 词（后期收窄）；
    //   BOSS 一律 7+ 长词。破甲升级：精英/盾牌词长 -1
    var text;
    if (type === 'boss') {
      text = pickBossWord();
    } else if (type === 'elite') {
      text = pick(eliteWordList());
      if (has('armor') && text.length > 2) { text = text.slice(0, -1); }
    } else if (type === 'shield') {
      var body = B.hero.mode === 'word' ? pick(B.wordLists.w24) : pickChar();
      if (has('armor') && body.length > 1) { body = body.slice(0, -1); }
      text = pickChar() + body; // 首字符为破盾键
    } else if (type === 'bait') {
      text = B.hero.mode === 'word' ? pick(B.wordLists.w24).slice(0, 3) : pickChar();
    } else if (type === 'fast') {
      text = B.hero.mode === 'word' ? pick(B.wordLists.w24).slice(0, 3) : pickChar();
    } else {
      text = B.hero.mode === 'word' ? pick(B.wordLists.w24) : pickChar();
    }

    var lane = Math.floor(Math.random() * LANES);
    var fw = field().clientWidth;
    // 前 2 波敌人生在屏幕内 3/4 处（缩短入场等待，试玩反馈「开局太慢」）
    var startX = (B.wave <= 2) ? fw * 0.75 : fw + 60;
    // 速度：按类型倍率（见 ENEMY_DEFS），随波次加快并带个体随机；缓速结界 -12%
    var d = DEFS[type];
    var speed = B.hero.speed * d.speedMult * (1 + (B.wave - 1) * 0.07) * (0.9 + Math.random() * 0.2);
    if (has('slow')) { speed *= 0.88; }

    var el = document.createElement('div');
    el.className = 'enemy ' + d.cls;
    if (type === 'shield') { el.classList.add('shield-on'); }
    var lab = document.createElement('div');
    lab.className = 'e-label';
    var em = document.createElement('div');
    em.className = 'e-emoji';
    em.textContent = d.emoji;
    // 诱饵：角标小骷髅（细微线索，考验专注力）
    if (type === 'bait') {
      var mark = document.createElement('span');
      mark.className = 'bait-mark';
      mark.textContent = '💀';
      el.appendChild(mark);
    }
    el.appendChild(lab);
    el.appendChild(em);

    var lh = laneH();
    var e = {
      id: B.idSeq++,
      el: el,
      type: type,
      text: text,
      typed: 0,      // 已输入的字符数
      lane: lane,
      x: startX,
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

  // 全量重画敌人标签（生成/转移锁定时）：已输入部分变绿；
  // 盾牌兵首字符渲染为红色破盾键胶囊
  function paintLabel(e) {
    var lab = e.el.querySelector('.e-label');
    lab.innerHTML = '';
    for (var i = 0; i < e.text.length; i++) {
      var s = document.createElement('span');
      var shieldCh = (e.type === 'shield' && i === 0);
      s.className = (shieldCh ? 'shield-key' : 'e-ch') + (i < e.typed ? ' hit' : '');
      s.textContent = e.text.charAt(i);
      lab.appendChild(s);
    }
    e.el.classList.toggle('shield-on', e.type === 'shield' && e.typed === 0);
  }

  // 增量更新单个字符（击键时避免整标签重建）
  function paintChar(e, idx) {
    var lab = e.el.querySelector('.e-label');
    var spans = lab.querySelectorAll('.e-ch, .shield-key');
    if (spans[idx]) { spans[idx].classList.add('hit'); }
    e.el.classList.toggle('shield-on', e.type === 'shield' && e.typed === 0);
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

    // 得分 = 基础分 × 连击倍率 × 英雄得分倍率 ×（赏金/双倍分加成）
    var gain = Math.round(DEFS[e.type].score * B.mult * B.hero.scoreMult *
      (has('bounty') ? 1.25 : 1) * (now() < B.doubleUntil ? 2 : 1));
    B.score += gain;
    B.kills++;
    audio.laser(B.combo); // 连击越高击杀音越高（爽感递增）
    debris(e);            // 字母碎屑飞散
    scorePop(e, '+' + gain);

    // 能量与升级回馈
    gainEnergy(e.type === 'boss' ? 5 : 1);
    if (has('vamp')) { heal(1); }

    // 成就钩子
    if (KF.ach) {
      KF.ach('first_blood');
      if (e.type === 'boss') { KF.ach('boss_slayer'); }
      if (B.maxCombo >= 50) { KF.ach('combo50'); }
      if (B.maxCombo >= 100) { KF.ach('combo100'); }
      if (B.score >= 3000) { KF.ach('score3000'); }
      var totalKills = (store.get('battle_kills', 0) || 0) + 1;
      store.set('battle_kills', totalKills);
      if (totalKills >= 1000) { KF.ach('kills1000'); }
    }

    // 道具掉落：精英 25%，BOSS 必掉
    if (e.type === 'boss' || (e.type === 'elite' && Math.random() < 0.25)) { maybeDrop(e); }

    // 击杀动画：弹跳缩放消失
    e.el.classList.remove('locked');
    e.el.classList.add('dying');
    var el = e.el;
    setTimeout(function () { if (el.parentNode) { el.parentNode.removeChild(el); } }, 220);
    updateHud();
  }

  // 诱饵陷阱：敲完诱饵 → 扣分 + 连击清零 + 爆炸音
  function baitTrap(e) {
    removeEnemy(e);
    B.score = Math.max(0, B.score - 10);
    B.combo = 0;
    B.mult = 1;
    B.misses++;
    audio.baitTrap();
    scorePop(e, '-10 是诱饵！💀');
    updateHud();
  }

  function finishEnemy(e) {
    if (e.type === 'bait') { baitTrap(e); return; }
    kill(e);
  }

  // 按错键：连击清零 + 错误音（连击保护升级可免除清零）
  function miss() {
    B.misses++;
    if (!has('protect')) {
      B.combo = 0;
      B.mult = 1;
    }
    audio.error();
    updateHud();
  }

  // 敌人咬到基地：扣血 + 红屏闪 + 震屏 + 警报；HP 归零游戏结束。
  // 诱饵不扣血直接离场；护盾可格挡。
  function bite(e) {
    if (e.type === 'bait') {
      removeEnemy(e); // 识破诱饵：安全离场，无惩罚
      return;
    }
    if (B.shieldCharges > 0) {
      B.shieldCharges--;
      removeEnemy(e);
      audio.shieldBlock();
      scorePop(e, '🛡️ 护盾格挡！');
      updateHud();
      return;
    }
    var lane = e.lane;
    removeEnemy(e);
    B.hp = Math.max(0, B.hp - DEFS[e.type].dmg);
    B.leaksThisWave++;
    B.combo = 0;
    B.mult = 1;
    audio.alarm();
    var f = field();
    f.classList.remove('shake', 'bitten');
    void f.offsetWidth; // 强制重排，让动画可重复触发
    f.classList.add('shake', 'bitten');
    // 被咬的那条路的房子抖动
    var houses = f.querySelectorAll('.base-col span');
    if (houses[lane]) {
      houses[lane].classList.remove('b-hurt');
      void houses[lane].offsetWidth;
      houses[lane].classList.add('b-hurt');
    }
    updateHud();
    if (B.hp <= 0) { gameOver(); }
  }

  /* ==================== 道具 / 技能 ==================== */
  function maybeDrop(e) {
    var items = [
      { icon: '❄️', name: '冰冻全场！', fn: function () { freezeAll(4000); } },
      { icon: '❤️', name: '生命 +15', fn: function () { heal(15); } },
      { icon: '💰', name: '双倍分 10 秒！', fn: function () { B.doubleUntil = now() + 10000; } },
      { icon: '💣', name: '空袭清理！', fn: airstrike }
    ];
    var it = pick(items);
    banner(it.icon + ' ' + it.name);
    audio.item();
    it.fn();
    updateHud();
  }

  function freezeAll(ms) {
    B.frozenUntil = now() + ms;
  }

  function heal(n) {
    B.hp = Math.min(B.hpMax, B.hp + n);
  }

  // 空袭：秒杀离基地最近的 3 个敌人（全额分）
  function airstrike() {
    var sorted = B.enemies.slice().sort(function (a, b) { return a.x - b.x; });
    sorted.slice(0, 3).forEach(function (e) {
      if (B.enemies.indexOf(e) >= 0) { kill(e); }
    });
  }

  function gainEnergy(n) {
    B.energy = Math.min(ENERGY_MAX, B.energy + n * (has('charge') ? 2 : 1));
  }

  // 技能：满能量后按 1-4 释放
  function castSkill(n) {
    if (B.energy < ENERGY_MAX) { audio.error(); return; }
    B.energy = 0;
    if (KF.ach) { KF.ach('skill_user'); }
    if (n === 1) { freezeAll(4000); banner('❄️ 冰封全场！'); }
    else if (n === 2) { stormLane(); banner('⚡ 闪电清路！'); }
    else if (n === 3) { B.shieldCharges += 2; banner('🛡️ 护盾 ×2 就绪！'); }
    else { heal(30); banner('❤️ 治疗 +30！'); }
    audio.skill();
    updateHud();
  }

  // 闪电清路：敌人最多的一条路（并列取更靠左的敌人所在路）
  function stormLane() {
    var counts = [0, 0, 0, 0, 0], minX = [1e9, 1e9, 1e9, 1e9, 1e9];
    B.enemies.forEach(function (e) {
      counts[e.lane]++;
      if (e.x < minX[e.lane]) { minX[e.lane] = e.x; }
    });
    var lane = 0;
    for (var i = 1; i < LANES; i++) {
      if (counts[i] > counts[lane] ||
          (counts[i] === counts[lane] && counts[i] > 0 && minX[i] < minX[lane])) { lane = i; }
    }
    B.enemies.slice().filter(function (e) { return e.lane === lane; }).forEach(function (e) {
      if (B.enemies.indexOf(e) >= 0) { kill(e); }
    });
  }

  // 道具/技能横幅（自动淡出，令牌防串台）
  function banner(text) {
    var b = $('item-banner');
    var token = ++B.bannerToken;
    b.textContent = text;
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth; // 强制重排，让动画可重复触发
    b.style.animation = '';
    setTimeout(function () {
      if (token !== B.bannerToken) { return; }
      b.classList.add('hidden');
    }, 1600);
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

  // 击杀碎屑：标签字母向随机方向飞散
  function debris(e) {
    var chars = e.text.split('');
    chars.forEach(function (ch) {
      var d = document.createElement('div');
      d.className = 'debris';
      d.textContent = ch;
      d.style.left = (e.x + 10) + 'px';
      d.style.top = (e.y + 18) + 'px';
      d.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      d.style.setProperty('--dy', (-30 - Math.random() * 60) + 'px');
      d.style.setProperty('--rot', (Math.random() * 200 - 100) + 'deg');
      field().appendChild(d);
      setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 650);
    });
  }

  // 完美防守：全屏金色闪光 + PERFECT 大字
  function perfectFx() {
    var f = field();
    f.classList.remove('perfect-flash');
    void f.offsetWidth;
    f.classList.add('perfect-flash');
    var p = document.createElement('div');
    p.className = 'perfect-pop';
    p.textContent = 'PERFECT!';
    f.appendChild(p);
    setTimeout(function () { if (p.parentNode) { p.parentNode.removeChild(p); } }, 1450);
  }

  // 危险预警心跳音（节流 0.8s）
  function heartbeat() {
    var t = now();
    if (t - B.heartLast < 800) { return; }
    B.heartLast = t;
    audio.heartbeat();
  }

  /* ==================== 键盘输入 ==================== */
  document.addEventListener('keydown', function (ev) {
    if (!B.running || B.paused) { return; }
    if (!$('screen-battle').classList.contains('active')) { return; }
    // 升级浮层打开：1-3 选择，Esc 跳过
    if (upgradeOpen()) {
      if (ev.key === 'Escape') { ev.preventDefault(); skipUpgrade(); }
      else if (ev.key >= '1' && ev.key <= '3' && !ev.shiftKey) {
        ev.preventDefault();
        chooseUpgrade(Number(ev.key) - 1);
      }
      return;
    }
    if (B.intermission) { return; }
    if (ev.key === 'Escape') { ev.preventDefault(); cancelLock(); return; }
    // 中文输入法未关闭：提示但不误判
    if (ev.isComposing || ev.key === 'Process') { imeHint(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
    // 技能数字键 1-4（不按 Shift 时）
    if (ev.key >= '1' && ev.key <= '4' && !ev.shiftKey) { ev.preventDefault(); castSkill(Number(ev.key)); return; }
    var k = (ev.key || '').toLowerCase();
    if (!/^[a-z;]$/.test(k)) { return; } // 只响应字母与分号（基准行池含 ;）
    ev.preventDefault();
    handleKey(k);
  });

  /* 锁定规则：
     1. 优先推进已锁定目标；此时若敲的是「更靠左（更危险）敌人」的首字母，
        自动转移锁定并弹横幅提示——连击保留，原目标已敲进度保留；
     2. 敲的字母不是当前目标下一键、但正好是某个「半打字敌人」的下一个字母时，
        自动接回该敌人、进度不清零（试玩反馈：玩家没察觉锁定被转移，
        只会补打剩余字母，没有提示就会卡到漏怪）；
     3. 否则锁定「离基地最近（x 最小）且以该字母开头」的敌人；
     4. Esc 取消当前锁定（连击保留）；
     5. 单字母敌人直接击杀。 */
  function findDangerStart(k, cur) {
    var best = null;
    B.enemies.forEach(function (en) {
      if (en === cur) { return; }
      if (en.text.charAt(0) !== k) { return; }
      if (en.x >= cur.x) { return; } // 必须比当前锁定更靠左才值得转移
      if (!best || en.x < best.x) { best = en; }
    });
    return best;
  }

  // 寻找可「续打」的半打字敌人：已敲过若干字母，且下一个字母正好是本键
  function findResumable(k, cur) {
    var best = null;
    B.enemies.forEach(function (en) {
      if (en === cur || en.typed <= 0 || en.typed >= en.text.length) { return; }
      if (en.text.charAt(en.typed) !== k) { return; }
      if (!best || en.x < best.x) { best = en; } // 优先更靠左（更危险）的
    });
    return best;
  }

  // 接回半打字目标：保留已敲进度，本键作为下一个字母直接计入
  function resumeLock(e) {
    B.locked = e;
    B.enemies.forEach(function (en) { en.el.classList.toggle('locked', en === e); });
    e.typed++;
    paintChar(e, e.typed - 1);
    audio.correct();
    banner('↩ 已接回目标，接着剩余字母打');
    if (e.typed >= e.text.length) { finishEnemy(e); }
  }

  function cancelLock() {
    if (!B.locked) { return; }
    B.locked = null;
    B.enemies.forEach(function (en) { en.el.classList.remove('locked'); });
  }

  function lockTo(e) {
    B.locked = e;
    e.typed = 1; // 首字母已敲
    B.enemies.forEach(function (en) { en.el.classList.toggle('locked', en === e); });
    if (!e.el.querySelector('.lock-reticle')) {
      var r = document.createElement('div');
      r.className = 'lock-reticle';
      e.el.insertBefore(r, e.el.firstChild);
    }
    paintLabel(e);
    if (e.type === 'shield') { audio.shieldBreak(); } // 破盾键一击即碎
    else { audio.correct(); }
  }

  function handleKey(k) {
    var e = B.locked;
    if (e && B.enemies.indexOf(e) < 0) { e = B.locked = null; } // 锁定的目标已不在场
    if (e) {
      // 转移锁定：敲到更危险敌人的首字母（弹横幅告知，避免玩家没察觉）
      var alt = findDangerStart(k, e);
      if (alt) { lockTo(alt); banner('🎯 已切换更近的目标！'); return; }
      if (e.text.charAt(e.typed) === k) {
        e.typed++;
        paintChar(e, e.typed - 1);
        if (e.type === 'shield' && e.typed === 1) { audio.shieldBreak(); }
        else { audio.correct(); }
        if (e.typed >= e.text.length) { finishEnemy(e); }
      } else {
        // 补打某个半打字敌人的剩余字母：自动接回该目标，进度保留
        var resume = findResumable(k, e);
        if (resume) { resumeLock(resume); return; }
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
    if (target.text.length === 1) {
      // 单字母杂兵一击毙命；首字母磁吸：同字母的单字敌人连带消灭
      if (has('magnet')) {
        var ch = target.text;
        B.enemies.slice().forEach(function (en) {
          if (en !== target && en.text === ch) { kill(en); }
        });
      }
      kill(target);
      return;
    }
    lockTo(target);
  }

  // 输入法提示（节流 2s）
  function imeHint() {
    var t = now();
    if (t - B.imeHintLast < 2000) { return; }
    B.imeHintLast = t;
    banner('⚠ 输入法未关闭！按 Shift 切到英文');
  }

  /* ==================== HUD ==================== */
  function updateHud() {
    $('battle-score').textContent = B.score;
    $('battle-wave').textContent = B.wave;
    $('battle-combo').textContent = B.combo;
    $('battle-mult').textContent = '×' + B.mult;
    var hp = $('battle-hp-fill');
    hp.style.width = Math.round(B.hp / B.hpMax * 100) + '%';
    hp.className = B.hp > B.hpMax * 0.5 ? 'hp-ok' : B.hp > B.hpMax * 0.25 ? 'hp-warn' : 'hp-low';
    // 技能能量
    $('battle-energy-fill').style.width = Math.round(B.energy / ENERGY_MAX * 100) + '%';
    $('battle-energy-num').textContent = B.energy + '/' + ENERGY_MAX;
    var full = B.energy >= ENERGY_MAX;
    $('hud-energy').classList.toggle('full', full);
    $('skill-hint').classList.toggle('hidden', !full);
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
