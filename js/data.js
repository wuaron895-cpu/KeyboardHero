/* ============================================================
   data.js —— 静态数据：段位表、英雄表、18 关关卡数据、
              单词表、短句表。
   通过全局变量 window.KeyForceData 对外提供（不使用 ES modules，
   保证 file:// 协议双击 index.html 可离线运行）。
   ============================================================ */
(function () {
  'use strict';

  window.KeyForceData = {

    /* ---------- 段位体系：按总杯数（🏆）晋升 ---------- */
    TIERS: [
      { name: '青铜', cups: 0,    color: '#C9853F' },
      { name: '白银', cups: 150,  color: '#C0C7D1' },
      { name: '黄金', cups: 400,  color: '#FFC93C' },
      { name: '铂金', cups: 800,  color: '#38B2AC' },
      { name: '钻石', cups: 1400, color: '#4FC3F7' },
      { name: '王者', cups: 2200, color: '#FF6B6B' }
    ],

    /* ---------- 英雄表（键盘保卫战中使用） ----------
       unlock    : 通关第 N 关解锁（0 = 初始就有）；
       pool      : 字母池（letter 模式用），words = 全单词模式；
       speed     : 敌人基础移动速度（像素/秒）；
       scoreMult : 得分倍率。 */
    HEROES: [
      { id: 'trainee',  emoji: '🎓', name: '小学员', unlock: 0,  mode: 'letter', pool: 'home',    speed: 30, scoreMult: 1.0, desc: '基准行字母 · 慢速 · 得分 ×1.0' },
      { id: 'raider',   emoji: '🔫', name: '突击手', unlock: 5,  mode: 'letter', pool: 'home',    speed: 38, scoreMult: 1.2, desc: '基准行字母 · 中速 · 得分 ×1.2' },
      { id: 'sniper',   emoji: '🎯', name: '狙击手', unlock: 10, mode: 'letter', pool: 'hometop', speed: 44, scoreMult: 1.5, desc: '基准行+上排字母 · 中快速 · 得分 ×1.5' },
      { id: 'gunner',   emoji: '💥', name: '机枪手', unlock: 15, mode: 'letter', pool: 'all',     speed: 52, scoreMult: 2.0, desc: '全部 26 字母 · 快速 · 得分 ×2.0' },
      { id: 'wordking', emoji: '👑', name: '词霸',   unlock: 17, mode: 'word',   pool: 'words',   speed: 38, scoreMult: 2.5, desc: '全单词攻击 · 中速 · 得分 ×2.5' }
    ],

    /* 字母池定义 */
    POOLS: {
      home:    'asdfghjkl;',
      hometop: 'asdfghjkl;qwertyuiop',
      all:     'abcdefghijklmnopqrstuvwxyz'
    },

    /* ---------- 音符映射表（音符模式：键盘即琴键） ----------
       规则：C 大调自然音阶（等律，A4=440），键位从左到右上行。
       下排  Z X C V B N M  = C3 D3 E3 F3 G3 A3 B3（低音区，简谱下加点 U+0323）
       下排  , . /          = C4 D4 E4
       基准行 A S D F G H J K L ; = C4 D4 E4 F4 G4 A4 B4 C5 D5 E5
             （中音 1-7；K L ; 为高音 1̇2̇3̇，上加点 U+0307）
       上排  Q W E R T Y U I O P = C5 D5 E5 F5 G5 A5 B5 C6 D6 E6
             （高音 1̇-7̇；C6 起用双点 U+0308）
       空格 = 休止符 0（不发音）；大写字母与对应小写同音（查表前先 toLowerCase）。
       频率为标准音高精确到小数点后两位。 */
    NOTES: {
      'z':  { freq: 130.81, jp: '1̣' }, // C3
      'x':  { freq: 146.83, jp: '2̣' }, // D3
      'c':  { freq: 164.81, jp: '3̣' }, // E3
      'v':  { freq: 174.61, jp: '4̣' }, // F3
      'b':  { freq: 196.00, jp: '5̣' }, // G3
      'n':  { freq: 220.00, jp: '6̣' }, // A3
      'm':  { freq: 246.94, jp: '7̣' }, // B3
      ',':  { freq: 261.63, jp: '1' },  // C4
      '.':  { freq: 293.66, jp: '2' },  // D4
      '/':  { freq: 329.63, jp: '3' },  // E4
      'a':  { freq: 261.63, jp: '1' },  // C4
      's':  { freq: 293.66, jp: '2' },  // D4
      'd':  { freq: 329.63, jp: '3' },  // E4
      'f':  { freq: 349.23, jp: '4' },  // F4
      'g':  { freq: 392.00, jp: '5' },  // G4
      'h':  { freq: 440.00, jp: '6' },  // A4
      'j':  { freq: 493.88, jp: '7' },  // B4
      'k':  { freq: 523.25, jp: '1̇' }, // C5
      'l':  { freq: 587.33, jp: '2̇' }, // D5
      ';':  { freq: 659.25, jp: '3̇' }, // E5
      'q':  { freq: 523.25, jp: '1̇' }, // C5
      'w':  { freq: 587.33, jp: '2̇' }, // D5
      'e':  { freq: 659.25, jp: '3̇' }, // E5
      'r':  { freq: 698.46, jp: '4̇' }, // F5
      't':  { freq: 783.99, jp: '5̇' }, // G5
      'y':  { freq: 880.00, jp: '6̇' }, // A5
      'u':  { freq: 987.77, jp: '7̇' }, // B5
      'i':  { freq: 1046.50, jp: '1̈' }, // C6
      'o':  { freq: 1174.66, jp: '2̈' }, // D6
      'p':  { freq: 1318.51, jp: '3̈' }, // E6
      ' ':  { freq: 0,      jp: '0' }   // 休止符
    },

    /* ---------- 歌曲弹奏曲库（音符模式：打对一字奏响下一音） ----------
       每首歌为简谱序列：'1'-'7' 中音，带 '̇' 为高音，'0' 为休止符。
       均为公版经典旋律，打完一曲自动循环。 */
    SONG_SCALE: {
      '1': 261.63, '2': 293.66, '3': 329.63, '4': 349.23,
      '5': 392.00, '6': 440.00, '7': 493.88,
      '1̇': 523.25, '2̇': 587.33, '3̇': 659.25, '4̇': 698.46, '5̇': 783.99,
      '0': 0
    },
    SONGS: [
      { name: '小星星',     notes: '1 1 5 5 6 6 5 0 4 4 3 3 2 2 1 0 5 5 4 4 3 3 2 0 5 5 4 4 3 3 2 0 1 1 5 5 6 6 5 0 4 4 3 3 2 2 1'.split(' ') },
      { name: '欢乐颂',     notes: '3 3 4 5 5 4 3 2 1 1 2 3 3 2 2 0 3 3 4 5 5 4 3 2 1 1 2 3 2 1 1 0'.split(' ') },
      { name: '两只老虎',   notes: '1 2 3 1 1 2 3 1 3 4 5 0 3 4 5 0 5 6 5 4 3 1 5 6 5 4 3 1 1 5 1 1 5 1'.split(' ') },
      { name: '生日快乐',   notes: '5 5 6 5 1̇ 7 0 5 5 6 5 2̇ 1̇ 0 5 5 5̇ 3̇ 1̇ 7 6 0 4̇ 4̇ 3̇ 1̇ 2̇ 1̇'.split(' ') },
      { name: '铃儿响叮当', notes: '3 3 3 0 3 3 3 0 3 5 1 2 3 0 0 0 4 4 4 0 4 3 3 3 0 3 2 2 3 2 0 5 0'.split(' ') },
      { name: '新年好',     notes: '1 1 1 5 3 3 3 1 1 3 5 5 5 0 2 2 2 4 3 2 5 0 3 3 2 2 1'.split(' ') }
    ],

    /* BOSS 专用长词（7+ 字母） */
    BOSS_WORDS: [
      'keyboard', 'practice', 'stormstrike', 'defense', 'victory', 'thunder',
      'warrior', 'monster', 'blaster', 'champion', 'typewriter', 'firepower'
    ],

    /* ---------- 18 关：严格按标准盲打教学顺序 ----------
       keys   : 本关练习用的键位全集（累计），字符关用；
       newKeys: 本关新学的键（关卡卡片上展示）；
       type   : chars=随机字符组 / words=高频单词 / sentences=短句；
       wpm2   : 二星所需 WPM；wpm3 : 三星所需 WPM；
       一星条件固定为准确率 ≥ 96%（见 app.js 结算逻辑）。 */
    LEVELS: [
      { id: 1,  name: '基准键·定位',   newKeys: 'F J',    keys: 'fj',                        type: 'chars',     tip: '双手食指放在 F、J 凸点上，这是所有手指的「家」。',           wpm2: 15, wpm3: 20 },
      { id: 2,  name: '中指报到',      newKeys: 'D K',    keys: 'fjdk',                      type: 'chars',     tip: '中指负责 D、K，击键后立刻回到基准位。',                     wpm2: 15, wpm3: 20 },
      { id: 3,  name: '无名指出击',    newKeys: 'S L',    keys: 'fjdksl',                    type: 'chars',     tip: '无名指最不灵活，放慢一点也要按准 S、L。',                   wpm2: 16, wpm3: 22 },
      { id: 4,  name: '小指扛旗',      newKeys: 'A ;',    keys: 'fjdksla;',                  type: 'chars',     tip: '小指负责 A 和 ;，别偷懒用无名指代替。',                     wpm2: 16, wpm3: 22 },
      { id: 5,  name: '食指内移',      newKeys: 'G H',    keys: 'fjdksla;gh',                type: 'chars',     tip: '食指向中间平移一格按 G、H，手腕不要跟着跑。',               wpm2: 18, wpm3: 24 },
      { id: 6,  name: '中指上排',      newKeys: 'E I',    keys: 'fjdksla;ghei',              type: 'chars',     tip: '中指斜向上够 E、I，击完立即归位。',                         wpm2: 18, wpm3: 24 },
      { id: 7,  name: '食指上排',      newKeys: 'R U',    keys: 'fjdksla;gheiru',            type: 'chars',     tip: '食指斜向上按 R、U，保持手指弯曲。',                         wpm2: 20, wpm3: 26 },
      { id: 8,  name: '无名指上排',    newKeys: 'W O',    keys: 'fjdksla;gheiruwo',          type: 'chars',     tip: '无名指上排 W、O：幅度小、动作轻。',                         wpm2: 20, wpm3: 26 },
      { id: 9,  name: '小指上排',      newKeys: 'Q P',    keys: 'fjdksla;gheiruwoqp',        type: 'chars',     tip: '小指上排 Q、P——最远的路，最稳的手。',                       wpm2: 20, wpm3: 26 },
      { id: 10, name: '上排内移',      newKeys: 'T Y',    keys: 'fjdksla;gheiruwoqpty',      type: 'chars',     tip: 'T、Y 是食指最远的上排键，伸出去马上回来。',                 wpm2: 22, wpm3: 28 },
      { id: 11, name: '下排内移',      newKeys: 'V M',    keys: 'fjdksla;gheiruwoqptyvm',    type: 'chars',     tip: '食指向下够 V、M，手掌保持悬空。',                           wpm2: 22, wpm3: 28 },
      { id: 12, name: '中指下排',      newKeys: 'C ,',    keys: 'fjdksla;gheiruwoqptyvmc,',  type: 'chars',     tip: '中指向下按 C 和逗号，注意别碰到食指的键。',                 wpm2: 22, wpm3: 28 },
      { id: 13, name: '无名指下排',    newKeys: 'X .',    keys: 'fjdksla;gheiruwoqptyvmc,x.',type: 'chars',     tip: '无名指向下按 X 和句号，小心别错成 S、L。',                 wpm2: 24, wpm3: 30 },
      { id: 14, name: '小指下排',      newKeys: 'Z /',    keys: 'fjdksla;gheiruwoqptyvmc,x.z/', type: 'chars',  tip: 'Z 和 / 是小指的下排地盘，最弱的手指也要顶住。',           wpm2: 24, wpm3: 30 },
      { id: 15, name: '食指下排',      newKeys: 'B N',    keys: 'fjdksla;gheiruwoqptyvmbn',  type: 'chars',     tip: 'B 归左手食指、N 归右手食指，千万别搞反。',                 wpm2: 24, wpm3: 30 },
      { id: 16, name: '全字母综合',    newKeys: 'A-Z',    keys: 'abcdefghijklmnopqrstuvwxyz', type: 'chars',    tip: '26 键全图巡逻：别想手指，让肌肉记忆自己动。',               wpm2: 25, wpm3: 30 },
      { id: 17, name: '高频单词',      newKeys: '单词',   keys: '',                          type: 'words',     tip: '常见英文单词连打，把单键节奏串成词的节拍。',                 wpm2: 25, wpm3: 30 },
      { id: 18, name: '短句冲刺',      newKeys: '短句',   keys: '',                          type: 'sentences', tip: '含大写与句号：用另一侧小指按住 Shift 再击键。',             wpm2: 25, wpm3: 30 }
    ],

    /* ---------- 高频英文单词表（第 17 关 & 保卫战词组用） ---------- */
    WORDS: [
      'the', 'and', 'for', 'you', 'all', 'can', 'had', 'her', 'was', 'one',
      'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new',
      'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let',
      'put', 'say', 'she', 'too', 'use', 'time', 'year', 'work', 'life', 'hand',
      'part', 'over', 'make', 'like', 'long', 'look', 'down', 'been', 'find', 'good',
      'give', 'most', 'very', 'when', 'come', 'take', 'know', 'back', 'call', 'into',
      'just', 'also', 'well', 'even', 'want', 'fire', 'storm', 'laser', 'power', 'speed',
      'night', 'force', 'code', 'star', 'wolf', 'iron', 'strike', 'target', 'battle', 'rocket',
      'delta', 'eagle', 'ghost', 'viper', 'radar', 'armor', 'scout', 'blade', 'bravo', 'comet'
    ],

    /* ---------- 短句库（第 18 关：首字母大写 + 句号，练 Shift） ---------- */
    SENTENCES: [
      'We are ready.',
      'Practice makes perfect.',
      'Keep your eyes on the screen.',
      'Stay calm and type fast.',
      'The night watch never sleeps.',
      'Aim high. Strike true.',
      'Every keystroke counts.',
      'Discipline wins the battle.',
      'Trust your fingers.',
      'Speed comes with practice.'
    ],

    /* ---------- 保卫战 · 敌人类型数值（battle.js 引用） ----------
       dmg       : 漏怪扣血；bait 为 0（走到基地不扣血，直接消失）
       score     : 击杀基础分；bait 为 0（敲它反而扣分）
       speedMult : 相对英雄基准速度的倍率
       bait 敲完惩罚：-10 分 + 连击清零（见 battle.js killBait） */
    ENEMY_DEFS: {
      normal: { emoji: '🧟',   dmg: 10, score: 10,  speedMult: 1.0,  cls: 'e-normal' },
      fast:   { emoji: '🐛',   dmg: 8,  score: 15,  speedMult: 1.9,  cls: 'e-fast' },
      shield: { emoji: '🛡️',   dmg: 12, score: 30,  speedMult: 0.75, cls: 'e-shield' },
      bait:   { emoji: '👻',   dmg: 0,  score: 0,   speedMult: 1.0,  cls: 'e-bait' },
      elite:  { emoji: '🧟‍♂️', dmg: 20, score: 25,  speedMult: 0.8,  cls: 'e-elite' },
      boss:   { emoji: '👹',   dmg: 40, score: 100, speedMult: 0.55, cls: 'e-boss' }
    },

    /* ---------- 保卫战 · 局内升级池（每 3 波三选一） ---------- */
    UPGRADES: [
      { id: 'protect', icon: '🧿', name: '连击保护', desc: '按错键不再清空连击' },
      { id: 'hp25',    icon: '❤️', name: '生命扩容', desc: '生命上限 +25，并回复 25 点' },
      { id: 'vamp',    icon: '🩸', name: '击杀回血', desc: '每击杀一个敌人回复 1 点生命' },
      { id: 'magnet',  icon: '🧲', name: '首字母磁吸', desc: '敲一个字母时，同字母的单字敌人全部消灭' },
      { id: 'armor',   icon: '🔨', name: '破甲',     desc: '精英与盾牌兵的词长 -1' },
      { id: 'slow',    icon: '🐌', name: '缓速结界', desc: '所有敌人移动速度 -12%' },
      { id: 'charge',  icon: '⚡', name: '快速充能', desc: '技能能量获取翻倍' },
      { id: 'bounty',  icon: '💰', name: '赏金加成', desc: '所有得分 +25%' }
    ],

    /* ---------- 保卫战 · 成就表 ---------- */
    ACHIEVEMENTS: [
      { id: 'first_blood', icon: '🎯', name: '初出茅庐', desc: '首次击杀一个敌人',        cups: 5 },
      { id: 'boss_slayer', icon: '👹', name: 'BOSS克星', desc: '首次击杀 BOSS',           cups: 15 },
      { id: 'combo50',     icon: '🔥', name: '连击大师', desc: '单局连击达到 50',         cups: 15 },
      { id: 'combo100',    icon: '☄️', name: '键圣',     desc: '单局连击达到 100',        cups: 30 },
      { id: 'skill_user',  icon: '💥', name: '技能大师', desc: '首次释放技能',            cups: 10 },
      { id: 'perfect5',    icon: '🌟', name: '完美防线', desc: '一局内无伤通过 5 波',     cups: 20 },
      { id: 'score3000',   icon: '💎', name: '高分战士', desc: '单局得分达到 3000',       cups: 20 },
      { id: 'kills1000',   icon: '⚔️', name: '千杀',     desc: '累计击杀 1000 个敌人',    cups: 20 },
      { id: 'wave15',      icon: '🚀', name: '远征军',   desc: '单局到达第 15 波',         cups: 30 },
      { id: 'all_heroes',  icon: '👑', name: '群英荟萃', desc: '每个英雄都打过保卫战',    cups: 15 }
    ],

    /* ---------- 保卫战 · 每日挑战 ---------- */
    DAILY: {
      reward: 50,                                  // 完成奖励杯数
      targetBase: 600                              // 目标分 = targetBase × 英雄得分倍率
    }
  };
})();
