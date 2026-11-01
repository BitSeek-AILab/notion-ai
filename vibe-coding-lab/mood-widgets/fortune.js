/* 今日运势：按「日期 + 昵称」种子生成，同一天同一人结果固定 */
(function () {
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const LEVELS = [
    { k: '大吉', w: 12, stars: 5, tone: '今天的你自带柔光滤镜，想做的事放心去做。' },
    { k: '中吉', w: 22, stars: 4, tone: '顺风顺水的一天，小小的好运会连续出现。' },
    { k: '小吉', w: 27, stars: 4, tone: '平稳里藏着惊喜，留意身边的小确幸。' },
    { k: '吉', w: 25, stars: 3, tone: '按自己的节奏来，就是最好的节奏。' },
    { k: '末吉', w: 14, stars: 3, tone: '先慢后顺，下午开始渐入佳境。' },
  ];
  const YI = ['早睡', '喝温水', '摸鱼十分钟', '整理桌面', '给朋友发表情包', '买一束花', '散步二十分钟', '听一张老专辑', '写三行日记', '拒绝内耗', '吃顿好的', '提交代码', '清空收件箱', '断舍离', '拍一张晚霞', '读一章书', '晒太阳', '和喜欢的人聊天', '换新壁纸', '认真护肤', '做一次深呼吸', '早点下班', '点一杯半糖', '把待办拆小一点', '夸夸自己', '学一个新快捷键', '整理相册', '去楼下便利店'];
  const JI = ['熬夜', '冲动下单', '已读不回', '内耗', '和甲方硬刚', '刷短视频超过一小时', '空腹喝冰美式', '临时改需求', '翻旧聊天记录', '立新 flag', '和别人比较', '报复性熬夜', '久坐不动', '把情绪带回家', '吃太撑', '在深夜做决定', '跳过午饭', '对自己太凶'];
  const ITEMS = ['帆布包', '有线耳机', '薄荷糖', '小熊挂件', '拍立得', '钢笔', '黄油曲奇', '蓝牙音箱', '香薰蜡烛', '格子围巾', '保温杯', '发夹', '便利贴', '多肉植物', '胶片相机', '草莓牛奶'];
  const DIRS = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
  const QUOTES = [
    '风会记得每一朵花的香。', '慢慢来，比较快。', '你本来就很好，不必急着证明。', '把今天过成喜欢的样子就好。',
    '世界很吵，你可以很安静。', '允许一切发生，也允许自己休息。', '星星不问路远，只管发光。', '小步也是前进，停下也算呼吸。',
    '温柔且坚定，是你今天的配色。', '好运正在加载，请保持电量。', '做完一件小事，就奖励自己一颗糖。', '生活不是赶路，是看风景。',
    '你的认真，宇宙都看得见。', '把烦恼折成纸飞机，丢出窗外。', '今天也是被月亮偏爱的一天。', '先照顾好心情，再处理事情。',
  ];
  const LUCKY = [['雾霾蓝', '#9fb1bc'], ['燕麦色', '#d8c3a5'], ['鼠尾草绿', '#a3b18a'], ['豆沙粉', '#d4a5a5'], ['奶油黄', '#efd9a7'], ['灰紫', '#9a8c98'], ['雾青', '#a8c5c5'], ['焦糖', '#c4a484'], ['牛油果绿', '#b5c99a'], ['珊瑚橘', '#e8a598'], ['月光白', '#ece6df'], ['松石绿', '#7fa7a6']];
  const DIMS = ['事业学业', '桃花人缘', '财运', '摸鱼指数'];
  function pickW(r, arr) { const t = arr.reduce((a, x) => a + x.w, 0); let x = r() * t; for (const a of arr) { if ((x -= a.w) < 0) return a; } return arr[0]; }
  function pickN(r, arr, n) { const a = arr.slice(); const out = []; while (out.length < n && a.length) out.push(a.splice((r() * a.length) | 0, 1)[0]); return out; }
  function draw(name, date) {
    const d = date || new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|${(name || '').trim() || '你'}`;
    const r = rng(hash(key));
    const lv = pickW(r, LEVELS);
    const dims = DIMS.map((n) => ({ n, v: Math.max(1, Math.min(5, Math.round(lv.stars - 1 + r() * 2.4))) }));
    const lc = LUCKY[(r() * LUCKY.length) | 0];
    return {
      key, level: lv.k, stars: lv.stars, tone: lv.tone,
      yi: pickN(r, YI, 3), ji: pickN(r, JI, 2),
      item: ITEMS[(r() * ITEMS.length) | 0], num: 1 + ((r() * 99) | 0), dir: DIRS[(r() * DIRS.length) | 0],
      color: lc[1], colorName: lc[0],
      quote: QUOTES[(r() * QUOTES.length) | 0], dims,
      no: String(1 + (hash(key + 'no') % 108)).padStart(3, '0'),
    };
  }
  window.Fortune = { draw };
})();
