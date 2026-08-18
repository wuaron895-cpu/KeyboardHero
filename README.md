# 键盘英雄 KeyboardHero · 打字练级大作战

> **KeyboardHero** — a zero-dependency, offline web game that teaches touch typing through play. Casual "Labubu-toy" visuals (dusk-purple / misty-blue gradients, cream sticker panels, retro keyboard). No build, no install — just open `index.html`.

**English**

A typing trainer for keyboard beginners, built with vanilla HTML/CSS/JS (no frameworks, no dependencies). It bundles a lesson path plus four mini-games that work together:

- 🎯 **18 progressive lessons** — standard touch-typing teaching order (FJ → DK → SL → … → sentences with Shift practice), with a live virtual keyboard, finger-color hints, and a **music mode** that turns the keyboard into a piano (6 public-domain melodies).
- 🎵 **Rhythm Mode** — a falling-note rhythm game: hit the right key as notes cross the judgement line and the melody plays; 6 songs on a gentle 55→100 BPM ladder, beginner-friendly timing windows, S/A/B/C ratings.
- 🏎️ **Typing Race** — a 1000m sprint over 30 words: correct words push you forward, mistakes push you back; race a ghost car paced at your own best WPM (beating it ≈ setting a new record).
- 💣 **Bomb Defusal** — type 3 sentences (capitals + periods) against a 90-second countdown, one wire per sentence; live left/right-Shift hints make case mistakes self-explanatory.
- 🛡️ **Keyboard Defense** — a 5-lane tower-defense mini-game where you type to kill incoming enemies; combos, perfect-defense bonuses, and per-hero score multipliers keep it addictive.
- 🏆 **Heroes & Ranks** — collect 5 heroes (each unlocks a wider letter pool and a score multiplier) and climb 6 rank tiers (Bronze → King) measured in 🏆 trophies earned from lessons and mini-games.

Everything (sound effects, enemy visuals, virtual keyboard) is synthesized at runtime with WebAudio + CSS/emoji — **no image or audio assets**, fully playable offline via `file://`.

面向键盘初学者的英文盲打训练网页游戏。拉布布潮玩风：暮紫灰 → 雾蓝渐变底 + 细波点，奶油贴纸面板，奶油白复古主机键盘 + 悬浮白键。

## 运行方式

纯原生 HTML/CSS/JavaScript，零依赖、零构建。**双击 `index.html` 即可离线运行**（file:// 协议）。

## 文件结构

```
KeyboardHero/
├── index.html       单页多屏（div 切换 display）
├── css/style.css    主样式（潮玩主题、虚拟键盘、塔防战场、动画）
├── css/rhythm.css   节奏模式样式
├── css/bomb.css     拆弹专家样式
├── css/race.css     打字赛车样式
├── js/data.js       段位表、英雄表、关卡数据、单词表、短句表、歌曲曲库
├── js/app.js        界面切换、主菜单、指法图解、闯关训练、英雄选择、战绩页
├── js/battle.js     键盘保卫战（五路塔防）
├── js/rhythm.js     节奏模式（打字版太鼓达人）
├── js/bomb.js       拆弹专家（倒计时剪线）
├── js/race.js       打字赛车（竞速）
├── specs/           模块规格书与协作约定
└── README.md
```

## 玩法说明

游戏由主线 + 小游戏 + 成长体系组成：**闯关训练负责系统学习，节奏模式 / 打字赛车 / 拆弹专家三个小游戏按「字符 → 单词 → 短句」分阶巩固，键盘保卫战负责实战爽感，段位与英雄收集负责长期动机。**

### 闯关训练（18 关，标准盲打教学顺序）

FJ → DK → SL → A; → GH → EI → RU → WO → QP → TY → VM → C, → X. → Z/ → BN → 全字母综合 → 高频单词 → 短句（含大写 + 句号，练 Shift）。

- 目标文本单行显示（字符关 ≤26 字符、单词关 ≤28 字符、短句关取预置短句）；打对的字符变绿、打错红色高亮、当前字符有光标下划线。
- **音符模式（默认开）**：键盘即琴键——打对一个字就奏响当前歌曲的下一个音，6 首公版旋律（《小星星》《欢乐颂》《两只老虎》《生日快乐》《铃儿响叮当》《新年好》）每关随机一首；**目标长度 = 整曲音符数，一行打完自动滚动下一行，保证整曲奏完才结算**。关闭音符则打一行即结算。
- 「下一键」大提示：巨型键帽（外圈为手指归属色）+ 手胶囊标签（如「右手食指」）；遇大写追加提示「同时按住 左/右 Shift」。
- 下方虚拟键盘同步高亮下一键（整键按下为归属色），并按 9 指分工在键帽底部显示归属色条；键盘下方还有一排手指指示条，随下一键同步点亮。
- 键盘上有 JS 按真实键位绘制的左右手分区虚线 +「左手区 / 右手区」标注；大写字母自动高亮另一侧 Shift（显示对应侧小指色）。
- 实时显示 WPM（正确字符数 / 5 / 分钟）、准确率、进度条；必须打对才前进，打错记一次错误。
- 「隐藏键盘提示」开关可关掉键盘做真盲打，状态持久化。
- 结算：准确率 ≥96% 一星；且 WPM 达二星线二星、达三星线三星。准确率 ≥90% 解锁下一关。
- **刷新本关最高星级可得杯数：每多 1 星 +10 🏆。**

### 节奏模式（打字版太鼓达人）

- 选歌后音符从顶部匀速下落，到判定线敲对应键；音符显示键名 + 简谱小标，敲对即奏响该音（键盘即琴键的音游化）。
- 6 首公版曲目按 55→100 BPM 渐进排列，第一首《小星星》足够慢；判定窗口不对称：±150ms Perfect、提前 600ms ~ 延后 350ms Good，早敲不吃亏。
- 13 键映射（基准行 `a s d f g h j k l ;` + 上排 `r t` + 空格休止），覆盖盲打教学前 8 关键位；底部有简化键盘高亮与「下一音」巨型键帽提示（到线前 800ms 出现）。
- 连击每 20 弹 COMBO 大字；曲终按准确率评 S/A/B/C（+30/20/10/5 🏆），刷新单曲最高评级额外 +10 🏆（`rhythm_best`）。

### 指法图解

基准键位说明、9 指分工图例（与键盘色条同色）、姿势要点；悬停任意键帽，下方指示条会点亮对应手指。

### 键盘保卫战（五路塔防）

- 基地在左端（🏠，HP 100），敌人从右端沿 5 条草坪路向左推进。
- 敌人类型：
  - 🧟 杂兵：顶 1 个字母（词霸模式为 2-4 字母短词），敲对即杀，漏掉扣 10 血；
  - 🐛 快速虫（第 2 波起）：1-3 字符，速度 ×1.9，扣 8 血；
  - 🛡️ 盾牌兵（第 2 波起）：先敲红色破盾键，再输入单词，扣 12 血；
  - 👻 诱饵（第 3 波起）：角标小骷髅💀为线索——敲它会 -10 分并清连击，忍住不敲则它走到基地安全离场；
  - 🧟‍♂️ 精英：顶 1 个单词（3-6 字母，后期词长自动收窄），逐字母输入，扣 20 血；
  - 👹 BOSS：每第 5 波额外出现 1 只，顶 7+ 字母长词，体型巨大、速度最慢，扣 40 血。
- **锁定与转移**：按字母自动锁定「离基地最近且以该字母开头」的敌人；锁定中敲到更靠左（更危险）敌人的首字母会自动转移锁定；`Esc` 取消锁定（连击保留）。按错键连击清零。
- **技能系统**：击杀攒能量（杂兵 +1 / BOSS +5，上限 20），满格按 `1` 冰封全场、`2` 闪电清路、`3` 护盾 ×2、`4` 治疗 +30。
- **道具掉落**：精英 25% / BOSS 必掉——❄️ 冰冻全场、❤️ 生命 +15、💰 双倍分 10 秒、💣 空袭秒杀 3 只。
- **局内升级**：每 3 波与 BOSS 波后三选一强化（连击保护、生命扩容、击杀回血、首字母磁吸、破甲、缓速结界、快速充能、赏金加成），按 `1/2/3` 选择或 `Esc` 跳过。
- **危险预警**：敌人进入警戒区变红闪烁 + 低频心跳音；锁定目标带 🎯 准星。
- 波次制：敌人数量与速度随波次提升，波间有横幅；一波无漏怪触发「完美防守！」+100 分与全屏金色特效。
- 连击倍率 ×1~×5（每连续 5 杀升 1 级），得分 = 基础分 × 倍率 × 英雄倍率 ×（赏金/双倍分加成）；连击越高击杀音越高。
- HP 归零战斗结束。**战斗结算杯数 = floor(得分 / 50)**；中途撤退杯数减半。
- **每日挑战**：英雄选择页顶部每日轮换挑战（限定英雄 + 目标分），完成 +50 🏆。
- **成就系统**：10 个成就（首杀、BOSS 克星、连击 50/100、技能大师、完美防线、单局 3000 分、累计千杀、第 15 波、群英荟萃），解锁时 toast 提示并奖励杯数，战绩页有成就墙。

### 打字赛车（竞速模式）

- 1000 米赛道，每局 30 个高频词：打对一词 +33.3 米，打错一词倒扣 16.7 米（下限 0）；单词打完停顿 250ms 自动切下一词，无需按空格。
- 幽灵车按历史最佳 WPM 配速（0.7×WPM 米/秒）同场竞速——赢它 ≈ 刷新自己的纪录；无纪录时不出现，纯自我节奏。
- 实时 WPM、领先/落后米数、冲线彩带；完成 +15 🏆，刷新最快用时额外 +10 🏆（`race_best`）。

### 拆弹专家（倒计时剪线）

- 90 秒倒计时内逐句敲对 3 句英文短句（含大写 + 句号），每句剪断一根线（红/蓝/黄）；归零爆炸。
- 大写随行提示：光标落在大写字母时自动显示「按住左/右 Shift」胶囊；字母对但大小写敲反时加急变红——错因直接可见，不会卡住。
- 倒计时条随剩余时间变绿/黄/红，≤10 秒炸弹心跳加速 + 滴答加密；成功 +20 🏆，刷新最高分额外 +10 🏆（`bomb_best`）；得分 = 剩余秒 ×10 + 正确字符 ×5。

### 英雄系统（选英雄 = 选字母池与倍率）

| 英雄 | 解锁条件 | 攻击范围 | 速度 | 得分倍率 |
|---|---|---|---|---|
| 🎓 小学员 | 初始 | 基准行字母 | 慢 | ×1.0 |
| 🔫 突击手 | 通关第 5 关 | 基准行字母 | 中 | ×1.2 |
| 🎯 狙击手 | 通关第 10 关 | 基准行 + 上排字母 | 中快 | ×1.5 |
| 💥 机枪手 | 通关第 15 关 | 全部 26 字母 | 快 | ×2.0 |
| 👑 词霸 | 通关第 17 关 | 全单词（杂兵也顶 2-4 字母短词） | 中 | ×2.5 |

每个英雄独立保存历史最佳分。

### 段位系统（🏆 杯数）

唯一成长货币：杯数。段位：青铜 0 / 白银 150 / 黄金 400 / 铂金 800 / 钻石 1400 / 王者 2200。
主菜单与战绩页显示段位徽章、杯数与到下一段位的进度条。战绩页还有英雄收集墙、训练数据统计与清空数据按钮。

## 设计说明

- **离线可用**：file:// 下 ES modules 会被 CORS 拦截，因此禁用 import/export，改用多个 `<script>` 按序加载（data.js → app.js → battle.js → rhythm.js → bomb.js → race.js），脚本间通过 `window.KeyForce` / `window.KeyForceData` 全局命名空间通信。
- **音效**：全部用 WebAudio API 现场合成（击杀「啵」、错误「嘟」、警报两连音、BOSS 低音滑音、完美防守三连音、危险预警低频心跳、道具上扬、技能扫频、破盾/护盾格挡、成就三连音），无音频文件；静音开关存 localStorage。音符模式的琴声为三角波基频 + 正弦泛音，约 5ms 快速起音、指数衰减，听感接近马林巴；曲库为简谱序列（`SONGS`）+ 音阶频率表（`SONG_SCALE`），弹奏进度与打字解耦。
- **敌人视觉**：emoji + CSS（行走摇摆、锁定高亮、击杀弹跳缩放、字母碎屑飞散、爆分浮字、COMBO 大字、震屏红闪、危险警戒红闪、冰冻青蓝滤镜），无图片资源。
- **虚拟键盘**：JS 按 QWERTY 布局生成。键帽为纯白渐变 + 底部承托边 + 悬浮投影（简洁立体），手指归属用键帽底部色条提示；F/J 带定位凸点。键盘渲染后用 `getBoundingClientRect` 量出每排左右手分界键缝，动态生成 SVG 阶梯分区虚线，窗口缩放、键盘显隐、进入页面时都会重画。
- **视觉**：暮紫灰/雾蓝/灰绿三色渐变 + 细波点底（body 渐变三处色值可调整体明暗）；奶油贴纸面板（3px 深描边 + 硬阴影）；手指 9 色为低饱和配色，高亮一律「整键按下」而非荧光发光。
- **持久化**：localStorage，键名前缀 `keyforce_`：`cups`（总杯数）、`unlocked`（已解锁关卡）、`stars`（每关星级）、`best`（每关最佳）、`battle_best`（各英雄最佳分）、`battle_kills`（累计击杀）、`battle_heroes_used`（已用英雄）、`achievements`（成就）、`daily`（每日挑战）、`stats`（训练统计）、`rhythm_best`（节奏各曲最高评级）、`bomb_best`（拆弹最高分）、`race_best`（赛车最快秒数）、`muted`（静音）、`music`（音符模式）、`hidekb`（隐藏键盘）。
- **主循环**：保卫战用 `requestAnimationFrame` 驱动，步长钳制 0.05s；波次过场用令牌（token）使上一局残留的 setTimeout 回调自动作废；游戏结束后主循环立即退出敌人遍历，不再访问已清空状态。
