/* ============================================================
   app.js —— 界面切换、主菜单、指法图解、闯关训练、英雄选择、战绩页。
   依赖 data.js（须先加载），通过 window.KeyForce 命名空间
   向 battle.js 暴露 store / audio / show 等公共能力。
   ============================================================ */
(function () {
  'use strict';

  window.KeyForce = window.KeyForce || {};
  var D = window.KeyForceData;

  function $(id) { return document.getElementById(id); }

  /* ==================== 本地存储（键名前缀 keyforce_） ==================== */
  var store = KeyForce.store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem('keyforce_' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('keyforce_' + k, JSON.stringify(v)); } catch (e) {}
    },
    clearAll: function () {
      var ks = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('keyforce_') === 0) ks.push(k);
      }
      ks.forEach(function (k) { localStorage.removeItem(k); });
    }
  };

  /* ==================== WebAudio 现场合成音效（卡通感） ==================== */
  var audio = KeyForce.audio = (function () {
    var ctx = null;
    function ac() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') { ctx.resume(); }
      return ctx;
    }
    function soundOn() { return !store.get('muted', false); }

    // 基础短音：振荡器 + 频率滑动 + 指数衰减
    function tone(f0, f1, dur, type, vol) {
      if (!soundOn()) return;
      try {
        var c = ac(), o = c.createOscillator(), g = c.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f0, c.currentTime);
        if (f1 && f1 !== f0) { o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), c.currentTime + dur); }
        g.gain.setValueAtTime(vol || 0.15, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + dur + 0.02);
      } catch (e) {}
    }

    // 噪声爆破：白噪声 buffer + 低通滤波（终场爆炸用）
    function noise(dur, vol, freq) {
      if (!soundOn()) return;
      try {
        var c = ac();
        var len = Math.floor(c.sampleRate * dur);
        var buf = c.createBuffer(1, len, c.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * (1 - i / len); }
        var src = c.createBufferSource(); src.buffer = buf;
        var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 800;
        var g = c.createGain();
        g.gain.setValueAtTime(vol || 0.25, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        src.connect(f); f.connect(g); g.connect(c.destination);
        src.start();
      } catch (e) {}
    }

    return {
      correct: function () { tone(600, 800, 0.05, 'sine', 0.1); },      // 击键正确：轻点上扬
      error:   function () { tone(220, 150, 0.12, 'square', 0.15); },   // 击键错误：低哑「嘟」
      laser:   function (combo) {                                       // 击杀：短促上扬「啵」；连击越高音越高
        var step = Math.min(combo || 0, 40) * 15;
        tone(400 + step, 900 + step, 0.08, 'sine', 0.2);
      },
      boom:    function () { noise(0.4, 0.3, 500); },                   // 终场爆炸
      alarm:   function () {                                            // 基地被咬：两连音
        tone(700, 700, 0.1, 'square', 0.18);
        setTimeout(function () { tone(520, 520, 0.16, 'square', 0.18); }, 150);
      },
      heartbeat: function () { tone(80, 55, 0.14, 'sine', 0.22); },     // 危险预警：低频心跳
      item:      function () { tone(500, 1300, 0.15, 'triangle', 0.18); }, // 道具/升级获取：上扬
      skill:     function () { tone(200, 1500, 0.3, 'sawtooth', 0.2); },   // 技能释放：扫频
      shieldBreak: function () { tone(950, 500, 0.07, 'square', 0.15); },  // 破盾：清脆下坠
      shieldBlock: function () { tone(300, 300, 0.15, 'triangle', 0.2); }, // 护盾格挡：闷响
      baitTrap:  function () { noise(0.25, 0.22, 400); },                  // 诱饵爆炸
      ach:       function () {                                             // 成就解锁：三音上行
        tone(523, 523, 0.08, 'square', 0.13);
        setTimeout(function () { tone(784, 784, 0.12, 'square', 0.13); }, 100);
        setTimeout(function () { tone(1046, 1046, 0.2, 'square', 0.13); }, 220);
      },
      boss:    function () { tone(260, 70, 0.5, 'sawtooth', 0.22); },   // BOSS 出场：低音滑音
      perfect: function () {                                            // 完美防守：三连上扬
        tone(660, 660, 0.07, 'sine', 0.16);
        setTimeout(function () { tone(880, 880, 0.07, 'sine', 0.16); }, 80);
        setTimeout(function () { tone(1100, 1100, 0.12, 'sine', 0.16); }, 160);
      },
      unlock:  function () {                                            // 过关/解锁：三音上行
        tone(523, 523, 0.08, 'square', 0.13);
        setTimeout(function () { tone(784, 784, 0.12, 'square', 0.13); }, 100);
        setTimeout(function () { tone(1046, 1046, 0.2, 'square', 0.13); }, 220);
      },
      /* 音符模式：钢琴/马林巴感合成音。
         三角波基频 + 正弦二次泛音，约 5ms 快速起音，指数衰减 ~0.8 秒，
         音量适中（低于错误音的警示感）。 */
      note: function (freq) {
        if (!soundOn() || !freq) { return; }
        try {
          var c = ac(), t = c.currentTime, dur = 0.8;
          // 基频：三角波
          var o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
          var g1 = c.createGain();
          g1.gain.setValueAtTime(0.0001, t);
          g1.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
          g1.gain.exponentialRampToValueAtTime(0.001, t + dur);
          // 二次泛音：正弦，音量约为基频一半，衰减更快
          var o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
          var g2 = c.createGain();
          g2.gain.setValueAtTime(0.0001, t);
          g2.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
          g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);
          o1.connect(g1); g1.connect(c.destination);
          o2.connect(g2); g2.connect(c.destination);
          o1.start(t); o1.stop(t + dur + 0.05);
          o2.start(t); o2.stop(t + dur + 0.05);
        } catch (e) {}
      },
      tick: function () { tone(1500, 1500, 0.025, 'square', 0.035); } // 休止符（空格）：极轻 tick
    };
  })();

  /* ==================== 屏幕切换 ==================== */
  function show(id) {
    var ss = document.querySelectorAll('.screen');
    for (var i = 0; i < ss.length; i++) { ss[i].classList.remove('active'); }
    $(id).classList.add('active');
  }
  KeyForce.show = show;

  /* ==================== 段位 / 杯数 ==================== */
  function tierOf(cups) {
    var cur = D.TIERS[0], next = null;
    for (var i = 0; i < D.TIERS.length; i++) {
      if (cups >= D.TIERS[i].cups) { cur = D.TIERS[i]; }
      else { next = D.TIERS[i]; break; }
    }
    return { cur: cur, next: next };
  }
  KeyForce.addCups = function (n) {
    if (n > 0) { store.set('cups', store.get('cups', 0) + n); }
  };

  /* ==================== 成就系统（保卫战） ==================== */
  // 全局 toast（右上角滑入，2.6s 自动隐藏）
  function toast(icon, title, sub) {
    var t = $('ach-toast');
    t.innerHTML =
      '<span class="at-icon">' + icon + '</span>' +
      '<div><div class="at-name">' + title + '</div>' +
      '<div class="at-cups">' + sub + '</div></div>';
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, 2600);
  }

  // 成就解锁（幂等）：记录 → 加杯 → toast
  KeyForce.ach = function (id) {
    var list = store.get('achievements', {});
    if (list[id]) { return; }
    var a = null;
    D.ACHIEVEMENTS.forEach(function (x) { if (x.id === id) { a = x; } });
    if (!a) { return; }
    list[id] = true;
    store.set('achievements', list);
    KeyForce.addCups(a.cups);
    toast(a.icon, '成就解锁 · ' + a.name, '+' + a.cups + ' 🏆');
    audio.ach();
  };

  /* ==================== 每日挑战（保卫战） ==================== */
  // 当日挑战配置：按日期在「已解锁英雄」中轮换；目标分 = targetBase × 英雄得分倍率
  function dailyInfo(day) {
    var unlockedLv = store.get('unlocked', 1);
    var hs = D.HEROES.filter(function (h) { return isHeroUnlocked(h, unlockedLv); });
    if (!hs.length) { return null; }
    var hero = hs[day % hs.length];
    return { hero: hero, target: Math.round(D.DAILY.targetBase * hero.scoreMult) };
  }

  // 战斗结算时检查：达标且当日未完成 → 完成并奖励
  KeyForce.dailyCheck = function (score) {
    var day = Math.floor(Date.now() / 86400000);
    var info = dailyInfo(day);
    if (!info) { return; }
    var cur = store.get('daily', { day: -1, done: false, best: 0 });
    if (cur.day !== day) { cur = { day: day, done: false, best: 0 }; }
    if (score > cur.best) { cur.best = score; }
    if (!cur.done && score >= info.target) {
      cur.done = true;
      KeyForce.addCups(D.DAILY.reward);
      toast('📅', '每日挑战完成！', '+' + D.DAILY.reward + ' 🏆');
      audio.ach();
    }
    store.set('daily', cur);
  };

  // 英雄选择页顶部的每日挑战卡
  function renderDaily() {
    var day = Math.floor(Date.now() / 86400000);
    var info = dailyInfo(day);
    var card = $('daily-card');
    if (!info) { card.style.display = 'none'; return; }
    var cur = store.get('daily', { day: -1, done: false });
    var done = (cur.day === day && cur.done);
    card.style.display = '';
    card.innerHTML =
      '<div class="dc-icon">📅</div>' +
      '<div class="dc-info">' +
        '<div class="dc-title">每日挑战：用「' + info.hero.name + '」' + info.hero.emoji + ' 单局拿 ' + info.target + ' 分</div>' +
        '<div class="dc-desc">' + info.hero.desc + ' · 完成奖励 ' + D.DAILY.reward + ' 🏆</div>' +
      '</div>' +
      (done
        ? '<div class="dc-state">✔ 今日已完成' + (cur.best ? '（本日最佳 ' + cur.best + '）' : '') + '</div>'
        : '<button class="btn btn-primary" id="btn-daily-go">接受挑战</button>');
    var go = $('btn-daily-go');
    if (go) { go.addEventListener('click', function () { KeyForce.battle.start(info.hero.id); }); }
  }

  // 渲染某处的「段位徽章 + 杯数进度条」（主菜单 prefix=menu，战绩页 prefix=stat）
  function renderTier(prefix) {
    var cups = store.get('cups', 0);
    var t = tierOf(cups);
    var badge = $(prefix + '-tier-badge');
    badge.textContent = t.cur.name;
    badge.style.background = t.cur.color;
    $(prefix + '-tier-name').textContent = t.cur.name;
    $(prefix + '-cups').textContent = cups;
    var pct, txt;
    if (t.next) {
      pct = Math.min(100, Math.round((cups - t.cur.cups) / (t.next.cups - t.cur.cups) * 100));
      txt = '距「' + t.next.name + '」还差 ' + (t.next.cups - cups) + ' 杯';
    } else {
      pct = 100;
      txt = '已达最高段位，传奇！';
    }
    $(prefix + '-cup-fill').style.width = pct + '%';
    $(prefix + '-cup-text').textContent = txt;
  }

  KeyForce.refreshMenu = function () {
    renderTier('menu');
    show('screen-menu');
  };

  /* ==================== 虚拟键盘构建 ==================== */
  // 标准 QWERTY 主键区布局（修饰键仅作视觉展示）
  var KB_ROWS = [
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\''],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
    [' ']
  ];

  var FINGER_NAMES = {
    lp: '左手小指', lr: '左手无名指', lm: '左手中指', li: '左手食指',
    ri: '右手食指', rm: '右手中指', rr: '右手无名指', rp: '右手小指',
    thumb: '拇指'
  };

  var fingerKb = null; // 指法图解页键盘（buildKeyboard 返回值）

  // 每个字符归属的手指（用于键盘上色与提示）
  function fingerOf(ch) {
    ch = ch.toLowerCase();
    if (ch === ' ') { return 'thumb'; }
    if ('`1qaz'.indexOf(ch) >= 0) { return 'lp'; }
    if ('2wsx'.indexOf(ch) >= 0) { return 'lr'; }
    if ('3edc'.indexOf(ch) >= 0) { return 'lm'; }
    if ('4rfv5tgb'.indexOf(ch) >= 0) { return 'li'; }
    if ('6yhn7ujm'.indexOf(ch) >= 0) { return 'ri'; }
    if ('8ik,'.indexOf(ch) >= 0) { return 'rm'; }
    if ('9ol.'.indexOf(ch) >= 0) { return 'rr'; }
    return 'rp'; // 0 p - = [ ] \ ; ' / 等右小指区
  }
  function isLeftFinger(f) { return f === 'lp' || f === 'lr' || f === 'lm' || f === 'li'; }

  // 在 container 中生成虚拟键盘，返回 { map, setNext, clearNext }
  function buildKeyboard(container) {
    container.innerHTML = '';
    var map = {};

    function modKey(label, wcls, keyId) {
      var k = document.createElement('div');
      k.className = 'key key-mod ' + wcls;
      // Shift 归属小指：高亮时用对应侧小指色（与指法规则一致）
      if (keyId === 'shift-l') { k.className += ' f-lp'; }
      if (keyId === 'shift-r') { k.className += ' f-rp'; }
      k.textContent = label;
      if (keyId) { k.setAttribute('data-key', keyId); map[keyId] = k; }
      return k;
    }

    KB_ROWS.forEach(function (row, ri) {
      var r = document.createElement('div');
      r.className = 'kb-row';
      if (ri === 1) { r.appendChild(modKey('Tab', 'w15')); }
      if (ri === 2) { r.appendChild(modKey('Caps', 'w18')); }
      if (ri === 3) { r.appendChild(modKey('Shift', 'w23', 'shift-l')); }
      row.forEach(function (ch) {
        var k = document.createElement('div');
        var f = fingerOf(ch);
        k.className = 'key f-' + f;
        k.setAttribute('data-key', ch);
        k.textContent = (ch === ' ') ? '␣' : ch.toUpperCase();
        if (ch === ' ') { k.classList.add('key-space'); }
        if (ch === 'f' || ch === 'j') { k.classList.add('bump'); } // F/J 定位凸点
        // 音符模式：键帽右下角简谱小标注（关闭时由 CSS 隐藏）
        var note = D.NOTES[ch];
        if (note) {
          var jp = document.createElement('span');
          jp.className = 'key-jp';
          jp.textContent = note.jp;
          k.appendChild(jp);
        }
        map[ch] = k;
        r.appendChild(k);
      });
      if (ri === 0) { r.appendChild(modKey('⌫', 'w15')); }
      if (ri === 2) { r.appendChild(modKey('Enter', 'w18')); }
      if (ri === 3) { r.appendChild(modKey('Shift', 'w23', 'shift-r')); }
      container.appendChild(r);
    });

    var lastNext = [];
    return {
      map: map,
      clearNext: function () {
        lastNext.forEach(function (k) { k.classList.remove('next'); });
        lastNext = [];
      },
      // 高亮下一个要按的键；大写字母附带高亮另一侧 Shift
      setNext: function (ch) {
        this.clearNext();
        var base = ch.toLowerCase();
        var needShift = (ch !== base);
        var k = map[base];
        if (k) { k.classList.add('next'); lastNext.push(k); }
        if (needShift) {
          var side = isLeftFinger(fingerOf(base)) ? 'shift-r' : 'shift-l';
          var s = map[side];
          if (s) { s.classList.add('next'); lastNext.push(s); }
        }
      }
    };
  }

  /* ==================== 左右手分区虚线 ==================== */
  // 在键盘底座上叠加一层 SVG，沿左右手键位间隙画一条悬浮虚线 + 顶部「左手区 / 右手区」标注。
  // 必须在键盘可见（display 非 none）时调用，否则量不到键位坐标。
  var ZONE_SPLIT = [['5', '6'], ['t', 'y'], ['g', 'h'], ['b', 'n']]; // 每排左右手分界键对
  function drawZoneLine(kbEl, map) {
    var old = kbEl.querySelector('.kb-zoneline');
    if (old) { old.remove(); }
    var kbRect = kbEl.getBoundingClientRect();
    if (!kbRect.width) { return; }
    var pts = [];
    ZONE_SPLIT.forEach(function (pair) {
      var a = map[pair[0]], b = map[pair[1]];
      if (!a || !b) { return; }
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      pts.push({
        x: Math.round((ra.right + rb.left) / 2 - kbRect.left),
        y: Math.round((ra.top + ra.bottom) / 2 - kbRect.top)
      });
    });
    if (pts.length < 2) { return; }
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'kb-zoneline');
    svg.setAttribute('width', kbRect.width);
    svg.setAttribute('height', kbRect.height);
    // 阶梯折线：每一排内垂直走键缝，排与排之间的水平段走行间隙，不穿键帽
    var d = 'M ' + pts[0].x + ' 24';
    for (var i = 0; i < pts.length - 1; i++) {
      var g = Math.round((pts[i].y + pts[i + 1].y) / 2); // 两排之间的行间隙
      d += ' L ' + pts[i].x + ' ' + g + ' L ' + pts[i + 1].x + ' ' + g;
    }
    d += ' L ' + pts[pts.length - 1].x + ' ' + (kbRect.height - 8);
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    // 顶部左右区标注（底座 padding-top 留白处）
    [['左手区', pts[0].x / 2], ['右手区', (pts[0].x + kbRect.width) / 2]].forEach(function (t) {
      var label = document.createElementNS(NS, 'text');
      label.setAttribute('x', t[1]);
      label.setAttribute('y', 17);
      label.setAttribute('text-anchor', 'middle');
      label.textContent = t[0];
      svg.appendChild(label);
    });
    kbEl.appendChild(svg);
  }
  function drawAllZoneLines() {
    if ($('screen-finger').classList.contains('active') && fingerKb) {
      drawZoneLine($('finger-keyboard'), fingerKb.map);
    }
    if ($('screen-train').classList.contains('active') && train.kb && !hideKb()) {
      drawZoneLine($('train-keyboard'), train.kb.map);
    }
  }

  /* ==================== 手指指示区 ==================== */
  // 键盘下方的一排手指区块：左手（小指→食指）· 拇指 · 右手（食指→小指），
  // 颜色与键帽 --fc 一致。返回 setActive(f) 高亮某根手指（传 null 取消）。
  var FZONE_ORDER = ['lp', 'lr', 'lm', 'li', 'thumb', 'ri', 'rm', 'rr', 'rp'];
  var FZONE_SHORT = {
    lp: '小指', lr: '无名', lm: '中指', li: '食指', thumb: '拇指',
    ri: '食指', rm: '中指', rr: '无名', rp: '小指'
  };
  function buildFingerZones(container) {
    container.innerHTML = '';
    var map = {};
    FZONE_ORDER.forEach(function (f) {
      var z = document.createElement('div');
      z.className = 'fz f-' + f + (isLeftFinger(f) ? ' fz-left' : (f === 'thumb' ? ' fz-thumb' : ' fz-right'));
      z.textContent = FZONE_SHORT[f];
      map[f] = z;
      container.appendChild(z);
    });
    var last = null;
    return {
      setActive: function (f) {
        if (last) { last.classList.remove('on'); last = null; }
        if (f && map[f]) { map[f].classList.add('on'); last = map[f]; }
      }
    };
  }

  /* ==================== 闯关训练（逻辑与旧版一致） ==================== */
  var train = {
    level: null, text: '', pos: 0,
    correct: 0, errors: 0, startTs: 0,
    active: false, kb: null, fz: null,
    songIdx: 0, songPos: 0, target: 0
  };

  function hideKb() { return $('chk-hidekb').checked; }

  /* ---------- 音符模式开关（默认开启，存 keyforce_music） ---------- */
  function musicOn() { return store.get('music', true); }

  function applyMusic() {
    var on = musicOn();
    document.body.classList.toggle('music-off', !on); // CSS 统一隐藏简谱标注
    var btn = $('btn-music');
    btn.textContent = on ? '🎵 音符 开' : '🎵 音符 关';
    btn.classList.toggle('off', !on);
    $('music-hint').style.display = on ? '' : 'none';
  }

  // 击键正确的发声：音符模式顺序弹奏当前歌曲的下一个音（空格/休止符 = tick），
  // 关闭时与原「啵」完全一致
  function playHit(k) {
    if (!musicOn()) { audio.correct(); return; }
    var song = D.SONGS[train.songIdx];
    if (!song) { audio.correct(); return; }
    var deg = song.notes[train.songPos % song.notes.length];
    train.songPos++;
    var freq = D.SONG_SCALE[deg] || 0;
    if (freq > 0) { audio.note(freq); }
    else { audio.tick(); } // 休止符
  }

  // 生成目标文本：单行排版，总长控制在一行能放下的范围内。
  // 字符关随机 2-4 字符分组、≤26 字符；单词关短词拼接、≤28 字符；短句关取预置句（均 ≤29 字符）
  function genText(lv) {
    var i;
    if (lv.type === 'words') {
      var arr = [], wlen = 0;
      while (arr.length < 8) {
        var w = D.WORDS[Math.floor(Math.random() * D.WORDS.length)];
        if (arr.length >= 3 && wlen + w.length + 1 > 28) { break; }
        arr.push(w); wlen += w.length + 1;
      }
      return arr.join(' ');
    }
    if (lv.type === 'sentences') {
      return D.SENTENCES[Math.floor(Math.random() * D.SENTENCES.length)];
    }
    var keys = lv.keys, out = [], len = 0;
    while (len < 22) {
      var g = 2 + Math.floor(Math.random() * 3), s = '';
      for (i = 0; i < g; i++) { s += keys.charAt(Math.floor(Math.random() * keys.length)); }
      out.push(s);
      len += g + 1;
    }
    var t = out.join(' ');
    return t.length > 26 ? t.slice(0, 26) : t;
  }

  function startLevel(id) {
    var lv = null;
    D.LEVELS.forEach(function (l) { if (l.id === id) { lv = l; } });
    if (!lv) { return; }
    train.level = lv;
    train.text = genText(lv);
    train.pos = 0;
    train.correct = 0;
    train.errors = 0;
    train.startTs = 0;
    train.active = true;
    train.songIdx = Math.floor(Math.random() * D.SONGS.length); // 每关随机一首，打完循环
    train.songPos = 0;
    // 音符模式：目标长度 = 整曲音符数，打完一行自动滚动下一行，保证曲子完整奏完；
    // 关闭音符：只打一行，与旧版一致
    train.target = musicOn() ? D.SONGS[train.songIdx].notes.length : train.text.length;
    $('train-level-name').textContent = '第 ' + lv.id + ' 关 · ' + lv.name;
    $('train-level-tip').textContent = '提示：' + lv.tip;
    $('music-hint').textContent = '🎵 正在弹奏：《' + D.SONGS[train.songIdx].name + '》——打对一字，奏响一音！';
    $('train-result').classList.add('hidden');
    renderTrainText();
    updateTrainHud();
    applyHideKb();
    show('screen-train');
    if (!hideKb()) { drawZoneLine($('train-keyboard'), train.kb.map); } // 可见后才能量键位
  }

  // 渲染目标文本（空格显示为 ␣；每个字符格下方带简谱标注，音符模式关闭时由 CSS 隐藏）
  function renderTrainText() {
    var box = $('train-text');
    box.innerHTML = '';
    for (var i = 0; i < train.text.length; i++) {
      var ch = train.text.charAt(i);
      var cell = document.createElement('span');
      cell.className = 'ch';
      var top = document.createElement('span');
      top.className = 'ch-key';
      top.textContent = (ch === ' ') ? '␣' : ch;
      var jp = document.createElement('span');
      jp.className = 'ch-jp';
      var note = D.NOTES[ch.toLowerCase()];
      jp.textContent = note ? note.jp : '';
      cell.appendChild(top);
      cell.appendChild(jp);
      box.appendChild(cell);
    }
    markCur();
  }

  // 刷新「当前字符」光标、虚拟键盘高亮、手指提示
  function markCur() {
    var kids = $('train-text').children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('cur', i === train.pos);
    }
    var ch = train.text.charAt(train.pos);
    if (!ch) { return; }
    if (train.kb && !hideKb()) { train.kb.setNext(ch); }
    var base = ch.toLowerCase();
    var f = fingerOf(base);
    if (train.fz) { train.fz.setActive(f); } // 手指指示区同步高亮
    // 「下一键」大提示：巨型键帽（外圈为归属色）+ 手指胶囊 + Shift 提示
    $('next-key-cap').className = 'nk-cap f-' + f;
    $('next-key-char').textContent = (ch === ' ') ? '␣' : ch;
    $('next-key-finger').textContent = FINGER_NAMES[f];
    $('next-key-finger').className = 'nk-finger f-' + f;
    var sh = $('next-key-shift');
    if (ch !== base) { // 大写：提示用另一侧 Shift
      sh.textContent = '⌨ 同时按住 ' + (isLeftFinger(f) ? '右' : '左') + ' Shift';
      sh.classList.remove('hidden');
    } else {
      sh.classList.add('hidden');
    }
  }

  function flashBad() {
    var box = $('train-text');
    box.classList.remove('flash-bad');
    void box.offsetWidth; // 强制重排，让动画可重复触发
    box.classList.add('flash-bad');
    var kids = box.children;
    var cur = kids[train.pos];
    if (cur) {
      cur.classList.add('badflash');
      setTimeout(function () { cur.classList.remove('badflash'); }, 350);
    }
  }

  function updateTrainHud() {
    var el = train.startTs ? (Date.now() - train.startTs) / 60000 : 0;
    var wpm = el > 0 ? Math.round((train.correct / 5) / el) : 0;
    var total = train.correct + train.errors;
    var acc = total > 0 ? train.correct / total * 100 : 100;
    $('train-wpm').textContent = wpm;
    $('train-acc').textContent = (Math.round(acc * 10) / 10) + '%';
    $('train-progress-fill').style.width = Math.round(train.correct / Math.max(train.target, 1) * 100) + '%';
  }

  // 训练完成：结算、星级、解锁、杯数、统计
  function finishTrain() {
    train.active = false;
    if (train.fz) { train.fz.setActive(null); }
    var durMs = train.startTs ? Date.now() - train.startTs : 0;
    var min = durMs / 60000;
    var wpm = min > 0 ? Math.round((train.correct / 5) / min) : 0;
    var total = train.correct + train.errors;
    var acc = total > 0 ? train.correct / total * 100 : 0;
    var accR = Math.round(acc * 10) / 10;
    var lv = train.level;

    // 星级：准确率≥96% 一星；且 WPM 达 wpm2 二星；达 wpm3 三星
    var stars = 0;
    if (acc >= 96) {
      stars = 1;
      if (wpm >= lv.wpm2) { stars = 2; }
      if (wpm >= lv.wpm3) { stars = 3; }
    }

    // 每关星级存档；刷新最高星级时，每多 1 星 +10 杯
    var starsMap = store.get('stars', {});
    var oldStars = starsMap[lv.id] || 0;
    var cupGain = 0;
    if (stars > oldStars) {
      starsMap[lv.id] = stars;
      store.set('stars', starsMap);
      cupGain = (stars - oldStars) * 10;
      KeyForce.addCups(cupGain);
    }
    var best = store.get('best', {});
    var b = best[lv.id] || { wpm: 0, acc: 0 };
    best[lv.id] = { wpm: Math.max(b.wpm, wpm), acc: Math.max(b.acc, accR) };
    store.set('best', best);

    // 准确率 ≥90% 解锁下一关
    var passed = acc >= 90;
    var unlocked = store.get('unlocked', 1);
    var unlockedNow = false;
    if (passed && lv.id === unlocked && lv.id < D.LEVELS.length) {
      store.set('unlocked', unlocked + 1);
      unlockedNow = true;
    }

    // 训练统计
    var st = store.get('stats', {});
    st.totalKeys = (st.totalKeys || 0) + total;
    st.totalCorrect = (st.totalCorrect || 0) + train.correct;
    st.totalTime = (st.totalTime || 0) + durMs;
    st.bestWpm = Math.max(st.bestWpm || 0, wpm);
    st.bestAcc = Math.max(st.bestAcc || 0, accR);
    store.set('stats', st);

    if (passed) { audio.unlock(); }

    // 结算浮层
    var cupPart = cupGain > 0 ? ' · +' + cupGain + ' 🏆' : '';
    $('result-stars').textContent = starStr(stars);
    $('result-stars').className = 'stars s' + stars;
    $('result-wpm').textContent = wpm + '（二星线 ' + lv.wpm2 + ' · 三星线 ' + lv.wpm3 + '）';
    $('result-acc').textContent = accR + '%';
    var msgEl = $('result-unlock-msg');
    if (unlockedNow) {
      msgEl.textContent = '✔ 准确率达标，已解锁下一关！' + cupPart;
      msgEl.className = 'unlock-msg ok';
    } else if (passed) {
      msgEl.textContent = '✔ 本关完成！' + cupPart;
      msgEl.className = 'unlock-msg ok';
    } else {
      msgEl.textContent = '✘ 准确率需 ≥ 90% 才能解锁下一关，再来一次！';
      msgEl.className = 'unlock-msg no';
    }
    $('btn-result-next').disabled = !(passed && lv.id < D.LEVELS.length);
    $('train-result').classList.remove('hidden');
    renderTier('menu'); // 杯数变动后段位可能升级，提前刷新主菜单
  }

  // 训练键盘输入：必须打对才前进；打错不计进度、闪红、记一次错误
  document.addEventListener('keydown', function (e) {
    if (!train.active) { return; }
    if (!$('screen-train').classList.contains('active')) { return; }
    if (!$('train-result').classList.contains('hidden')) { return; }
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    var k = e.key;
    if (!k || k.length !== 1) { return; } // 忽略 Shift/CapsLock 等功能键本身
    e.preventDefault();
    if (!train.startTs) { train.startTs = Date.now(); }
    var expect = train.text.charAt(train.pos);
    if (k === expect) {
      var kids = $('train-text').children;
      if (kids[train.pos]) { kids[train.pos].classList.add('done'); }
      train.correct++;
      train.pos++;
      playHit(k); // 音符模式顺序弹奏歌曲 / 关闭时原「啵」
      if (train.correct >= train.target) { updateTrainHud(); finishTrain(); return; }
      if (train.pos >= train.text.length) {
        // 一行打完但曲子未完：滚动生成下一行接着打
        train.text = genText(train.level);
        train.pos = 0;
        renderTrainText();
      }
      markCur();
    } else {
      train.errors++;
      audio.error();
      flashBad();
    }
    updateTrainHud();
  });

  // 「隐藏键盘提示」开关：状态存 localStorage
  function applyHideKb() {
    var h = hideKb();
    $('train-keyboard-wrap').style.display = h ? 'none' : '';
    $('train-next-info').style.display = h ? 'none' : '';
    store.set('hidekb', h);
    if (!h && train.active) {
      markCur();
      drawZoneLine($('train-keyboard'), train.kb.map); // 由隐藏切回可见，需重画分区线
    }
  }

  /* ==================== 关卡选择页 ==================== */
  function starStr(n) {
    var s = '';
    for (var i = 0; i < 3; i++) { s += i < n ? '★' : '☆'; }
    return s;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function renderLevels() {
    var grid = $('level-grid');
    grid.innerHTML = '';
    var unlocked = store.get('unlocked', 1);
    var stars = store.get('stars', {});
    D.LEVELS.forEach(function (lv) {
      var locked = lv.id > unlocked;
      var st = stars[lv.id] || 0;
      var card = document.createElement('button');
      card.className = 'level-card' + (locked ? ' locked' : '');
      card.innerHTML =
        '<div class="lv-num">LEVEL ' + pad2(lv.id) + '</div>' +
        '<div class="lv-name">' + lv.name + '</div>' +
        '<div class="lv-keys">' + lv.newKeys + '</div>' +
        '<div class="lv-stars">' + starStr(st) + '</div>' +
        (locked ? '<div class="lv-lock">🔒</div>' : '');
      if (!locked) {
        card.addEventListener('click', function () { startLevel(lv.id); });
      }
      grid.appendChild(card);
    });
  }

  /* ==================== 英雄系统 ==================== */
  function isHeroUnlocked(h, unlockedLv) {
    return h.unlock === 0 || unlockedLv > h.unlock;
  }

  // 保卫战入口：英雄选择卡片墙
  function renderHeroes() {
    renderDaily(); // 顶部每日挑战卡
    var grid = $('hero-grid');
    grid.innerHTML = '';
    var unlockedLv = store.get('unlocked', 1);
    var bb = store.get('battle_best', {});
    D.HEROES.forEach(function (h) {
      var ok = isHeroUnlocked(h, unlockedLv);
      var card = document.createElement('button');
      card.className = 'hero-card' + (ok ? '' : ' locked');
      card.innerHTML =
        '<div class="hero-emoji">' + h.emoji + '</div>' +
        '<div class="hero-name">' + h.name + '</div>' +
        '<div class="hero-desc">' + h.desc + '</div>' +
        (ok
          ? '<div class="hero-best">历史最佳：' + (bb[h.id] || 0) + '</div>'
          : '<div class="hero-lock">🔒 通关第 ' + h.unlock + ' 关解锁</div>');
      if (ok) {
        card.addEventListener('click', function () { KeyForce.battle.start(h.id); });
      }
      grid.appendChild(card);
    });
  }
  KeyForce.renderHeroes = renderHeroes;

  // 战绩页英雄收集墙（小卡，不可点击）
  function renderHeroWall() {
    var wall = $('stats-hero-wall');
    wall.innerHTML = '';
    var unlockedLv = store.get('unlocked', 1);
    var bb = store.get('battle_best', {});
    D.HEROES.forEach(function (h) {
      var ok = isHeroUnlocked(h, unlockedLv);
      var card = document.createElement('div');
      card.className = 'hero-card mini' + (ok ? '' : ' locked');
      card.innerHTML =
        '<div class="hero-emoji">' + h.emoji + '</div>' +
        '<div class="hero-name">' + h.name + '</div>' +
        (ok
          ? '<div class="hero-best">最佳 ' + (bb[h.id] || 0) + '</div>'
          : '<div class="hero-lock">🔒 通关第 ' + h.unlock + ' 关</div>');
      wall.appendChild(card);
    });
  }

  /* ==================== 战绩页 ==================== */
  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h > 0) { return h + ' 小时 ' + m + ' 分'; }
    if (m > 0) { return m + ' 分 ' + (s % 60) + ' 秒'; }
    return s + ' 秒';
  }

  // 战绩页成就墙（已解锁亮色，未解锁置灰带锁）
  function renderAchWall() {
    var wall = $('stats-ach-wall');
    wall.innerHTML = '';
    var got = store.get('achievements', {});
    D.ACHIEVEMENTS.forEach(function (a) {
      var c = document.createElement('div');
      var ok = !!got[a.id];
      c.className = 'ach-card' + (ok ? '' : ' locked');
      c.innerHTML =
        '<div class="ach-icon">' + (ok ? a.icon : '🔒') + '</div>' +
        '<div class="ach-name">' + a.name + '</div>' +
        '<div class="ach-desc">' + a.desc + '</div>' +
        '<div class="ach-cups">+' + a.cups + ' 🏆</div>';
      wall.appendChild(c);
    });
  }

  // 战绩页小游戏纪录：节奏最高评级（S>A>B>C 字典序即强度序）、拆弹最高分、赛车最快
  function renderMiniGames() {
    var rb = store.get('rhythm_best', {});
    var vals = [];
    for (var k in rb) { if (Object.prototype.hasOwnProperty.call(rb, k)) { vals.push(rb[k]); } }
    $('stat-rhythm-best').textContent = vals.length ? vals.sort().reverse()[0] : '—';
    $('stat-bomb-best').textContent = store.get('bomb_best', 0) || '—';
    var rbest = store.get('race_best', 0);
    $('stat-race-best').textContent = rbest ? rbest + 's' : '—';
  }

  function renderStats() {
    var st = store.get('stats', {});
    $('stat-total-keys').textContent = st.totalKeys || 0;
    $('stat-total-correct').textContent = st.totalCorrect || 0;
    $('stat-total-time').textContent = fmtTime(st.totalTime || 0);
    $('stat-best-wpm').textContent = st.bestWpm || 0;
    $('stat-best-acc').textContent = st.bestAcc ? st.bestAcc + '%' : '—';
    renderTier('stat');
    renderHeroWall();
    renderAchWall();
    renderMiniGames();
  }

  /* ==================== 静音开关 ==================== */
  function updateMuteBtn() {
    $('btn-mute').textContent = store.get('muted', false) ? '🔇' : '🔊';
  }

  /* ==================== 事件绑定 ==================== */
  function bind(id, fn) { $(id).addEventListener('click', fn); }

  function bindAll() {
    // 主菜单
    bind('btn-goto-levels', function () { renderLevels(); show('screen-levels'); });
    bind('btn-goto-battle', function () { renderHeroes(); show('screen-heroes'); });
    bind('btn-goto-rhythm', function () { KeyForce.rhythm.start(); });
    bind('btn-goto-bomb', function () { KeyForce.bomb.start(); });
    bind('btn-goto-race', function () { KeyForce.race.start(); });
    bind('btn-goto-finger', function () {
      show('screen-finger');
      drawZoneLine($('finger-keyboard'), fingerKb.map); // 可见后才能量键位
    });
    bind('btn-goto-stats', function () { renderStats(); show('screen-stats'); });
    // 各页返回
    bind('btn-finger-back', KeyForce.refreshMenu);
    bind('btn-levels-back', KeyForce.refreshMenu);
    bind('btn-heroes-back', KeyForce.refreshMenu);
    bind('btn-stats-back', KeyForce.refreshMenu);
    // 训练页
    bind('btn-train-quit', function () { train.active = false; renderLevels(); show('screen-levels'); });
    bind('btn-result-retry', function () { startLevel(train.level.id); });
    bind('btn-result-next', function () { startLevel(train.level.id + 1); });
    bind('btn-result-back', function () { renderLevels(); show('screen-levels'); });
    $('chk-hidekb').addEventListener('change', applyHideKb);
    // 音符模式开关（与全局静音独立）
    bind('btn-music', function () {
      store.set('music', !musicOn());
      applyMusic();
      // 练习中切换：目标长度同步切换（整曲 ↔ 单行）
      if (train.active) {
        train.target = musicOn() ? D.SONGS[train.songIdx].notes.length : Math.max(train.correct, 1);
        updateTrainHud();
      }
    });
    // 静音
    bind('btn-mute', function () {
      store.set('muted', !store.get('muted', false));
      updateMuteBtn();
    });
    // 清空数据（需确认）
    bind('btn-clear-data', function () {
      if (confirm('确定要清空所有数据吗？段位、杯数、星级、英雄战绩将全部归零，此操作不可恢复！')) {
        store.clearAll();
        location.reload();
      }
    });
    // 按钮点击后失焦，避免训练中按空格/回车误触发按钮
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.tagName === 'BUTTON' && t.blur) { t.blur(); }
    });
  }

  /* ==================== 初始化 ==================== */
  function init() {
    fingerKb = buildKeyboard($('finger-keyboard'));      // 指法图解页的大键盘
    train.kb = buildKeyboard($('train-keyboard')); // 训练页键盘（可高亮）
    train.fz = buildFingerZones($('train-finger-zones'));
    // 指法图解页：悬停键帽时，下方指示区点亮对应手指
    var fzStatic = buildFingerZones($('finger-zones'));
    var fkb = $('finger-keyboard');
    fkb.addEventListener('mouseover', function (e) {
      var k = e.target.closest ? e.target.closest('.key') : null;
      var dk = k && k.getAttribute('data-key');
      if (dk === 'shift-l') { fzStatic.setActive('lp'); }
      else if (dk === 'shift-r') { fzStatic.setActive('rp'); }
      else { fzStatic.setActive(dk ? fingerOf(dk) : null); }
    });
    fkb.addEventListener('mouseleave', function () { fzStatic.setActive(null); });
    $('chk-hidekb').checked = store.get('hidekb', false);
    applyMusic(); // 音符模式默认开启，恢复上次状态
    updateMuteBtn();
    renderTier('menu');
    bindAll();
    window.addEventListener('resize', drawAllZoneLines); // 窗口变化后重画分区虚线
    show('screen-menu');
  }

  init(); // 脚本位于 body 末尾，此时 DOM 已就绪
})();
