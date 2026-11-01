/* 审美调节台：参数模型 + 莫兰迪色板 + 自然语言 → 参数 diff（纯本地规则，可选大模型） */
(function () {
  const PALETTES = {
    haze: { name: '雾霾蓝', colors: ['#93a9b8', '#d2dce4', '#ebe4dc', '#62788a'], dark: false },
    oat: { name: '燕麦奶茶', colors: ['#d8c3a5', '#efe6da', '#c4a484', '#8e7358'], dark: false },
    sage: { name: '鼠尾草', colors: ['#a3b18a', '#e3e5d8', '#c8cfb4', '#6f805c'], dark: false },
    bean: { name: '豆沙粉', colors: ['#d4a5a5', '#f1e0da', '#c48b8d', '#9a6b70'], dark: false },
    sea: { name: '海盐柠檬', colors: ['#a8c5c5', '#eef0e2', '#e5d9a8', '#6f9a99'], dark: false },
    dusk: { name: '暮色紫', colors: ['#9a8c98', '#c9ada7', '#4a4e69', '#f2e9e4'], dark: true },
    cyber: { name: '赛博夜', colors: ['#1b1443', '#3a2d7a', '#ff6ec7', '#56e6ff'], dark: true },
  };
  const SCHEMA = {
    hue: { label: '色相', min: -40, max: 40, step: 1, def: 0, fmt: (v) => (v > 0 ? '+' : '') + Math.round(v) + '°' },
    temp: { label: '冷暖', min: -1, max: 1, step: .01, def: 0, fmt: (v) => (Math.abs(v) < .02 ? '中性' : (v > 0 ? '暖 ' : '冷 ') + Math.round(Math.abs(v) * 100)) },
    sat: { label: '饱和度', min: .3, max: 1.6, step: .01, def: 1, fmt: (v) => Math.round(v * 100) + '%' },
    bright: { label: '明度', min: .7, max: 1.25, step: .01, def: 1, fmt: (v) => Math.round(v * 100) + '%' },
    soft: { label: '柔和度', min: 0, max: 1, step: .01, def: .55, fmt: (v) => Math.round(v * 100) },
    speed: { label: '流速', min: 0, max: 1, step: .01, def: .35, fmt: (v) => Math.round(v * 100) },
    glow: { label: '光泽', min: 0, max: 1, step: .01, def: .45, fmt: (v) => Math.round(v * 100) },
    grain: { label: '颗粒感', min: 0, max: .6, step: .01, def: .12, fmt: (v) => Math.round(v * 100) },
    glass: { label: '卡片雾度', min: .08, max: .85, step: .01, def: .4, fmt: (v) => Math.round(v * 100) + '%' },
    radius: { label: '圆角', min: 6, max: 40, step: 1, def: 28, fmt: (v) => Math.round(v) + 'px' },
  };
  const KEYS = Object.keys(SCHEMA);
  const DEFAULT = Object.assign({ palette: 'haze' }, Object.fromEntries(KEYS.map((k) => [k, SCHEMA[k].def])));
  const clamp = (k, v) => Math.max(SCHEMA[k].min, Math.min(SCHEMA[k].max, v));

  /* ---------- 颜色处理 ---------- */
  const hex2rgb = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
  const rgb2hex = (c) => '#' + c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
  function rgb2hsl([r, g, b]) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function hsl2rgb([h, s, l]) { if (!s) return [l, l, l]; const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)]; }
  function grade(hex, P) {
    let [h, s, l] = rgb2hsl(hex2rgb(hex));
    h = (h + P.hue / 360 + 1) % 1; s = Math.min(1, s * P.sat); l = Math.min(.97, l * P.bright);
    let c = hsl2rgb([h, s, l]);
    const warm = [1, .72, .5], cool = [.55, .72, 1], t = Math.abs(P.temp) * .22, tint = P.temp > 0 ? warm : cool;
    c = c.map((x, i) => x * (1 - t) + x * tint[i] * t * 1.15);
    return c;
  }
  function colorsOf(P) { return (PALETTES[P.palette] || PALETTES.haze).colors.map((h) => grade(h, P)); }
  const lum = (c) => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];

  /* ---------- 自然语言规则 ---------- */
  const CONCEPTS = [
    { re: /温柔|柔和|柔软|软一点|软软|治愈|温和|舒服|松弛|慵懒|奶呼呼/, d: { soft: .15, sat: -.08, speed: -.08, grain: -.03, radius: 4, glow: -.05, temp: .08 }, say: '更温柔' },
    { re: /梦幻|朦胧|雾蒙蒙|仙气|空灵|轻盈|梦/, d: { soft: .2, glow: .15, bright: .04, glass: -.05 }, say: '更梦幻' },
    { re: /清冷|高冷|冷淡|冰|冷/, d: { temp: -.3, sat: -.05 }, say: '更清冷' },
    { re: /温暖|阳光|日落|秋天|暖/, d: { temp: .3 }, say: '更温暖' },
    { re: /明亮|提亮|清新|白一点|亮/, d: { bright: .08 }, say: '更明亮' },
    { re: /暗|深色|夜晚|深沉|沉稳|黑/, d: { bright: -.1 }, say: '更深沉' },
    { re: /鲜艳|多巴胺|活泼|饱和|浓郁|元气|热闹|彩色|艳/, d: { sat: .22, speed: .1, glow: .08 }, say: '更多巴胺' },
    { re: /花哨|花里胡哨|花/, d: { sat: .15, speed: .08, glow: .05 }, say: '更花哨' },
    { re: /高级|克制|莫兰迪|灰调|淡雅|素净|性冷淡|极简|淡/, d: { sat: -.15, grain: .04 }, say: '更高级克制' },
    { re: /动起来|流动|灵动|活一点|快|躁/, d: { speed: .22 }, say: '流动更快' },
    { re: /安静|平静|冥想|稳定|别动|佛系|慢|静/, d: { speed: -.22 }, say: '更安静' },
    { re: /颗粒|胶片|复古|噪点|质感|老照片|ccd|CCD/, d: { grain: .12, sat: -.05, temp: .08 }, say: '胶片颗粒感' },
    { re: /干净|清透|光滑|无噪/, d: { grain: -.12, glass: .04 }, say: '更干净' },
    { re: /透明|玻璃|通透|透一点|透/, d: { glass: -.12, glow: .05 }, say: '更通透' },
    { re: /雾面|磨砂|毛玻璃|不透明/, d: { glass: .12 }, say: '更磨砂' },
    { re: /圆润|可爱|软萌|萌|圆/, d: { radius: 8, soft: .05 }, say: '更圆润可爱' },
    { re: /锐利|硬朗|利落|酷一点|冷酷|硬|方/, d: { radius: -10, soft: -.1, glow: .05 }, say: '更利落' },
    { re: /光泽|反光|丝绸|水光|油亮|亮面|金属|液态/, d: { glow: .2 }, say: '更有光泽' },
    { re: /哑光|雾感|粉雾/, d: { glow: -.2, grain: .04 }, say: '哑光' },
  ];
  const PAL_WORDS = [
    [/赛博|霓虹|科技感|未来感|蒸汽波|酸性/, 'cyber', { glow: .25, speed: .1, sat: .1 }],
    [/雾霾蓝|蓝/, 'haze'], [/鼠尾草|抹茶|森林|绿/, 'sage'], [/豆沙|樱花|少女|粉/, 'bean'],
    [/暮色|薰衣草|紫/, 'dusk'], [/奶茶|燕麦|米色|咖啡|焦糖|拿铁|棕/, 'oat'], [/海盐|柠檬|薄荷|青|黄/, 'sea'],
  ];
  const MOODS = [
    { re: /累|疲惫|焦虑|烦|emo|难过|丧|心累|崩溃|压力/, d: { soft: .2, speed: -.25, sat: -.1, temp: .15, glow: -.05 }, say: '抱抱你，先把世界调慢一点 🫧' },
    { re: /开心|兴奋|嗨|快乐|好心情|发工资|过节/, d: { sat: .2, speed: .2, bright: .05, glow: .1 }, say: '好心情就要亮晶晶 ✨' },
    { re: /专注|学习|工作|上班|写论文|考试|deadline|ddl|DDL/, d: { sat: -.12, speed: -.18, grain: -.05, glass: .08 }, say: '已切到专注模式：低干扰、低饱和' },
    { re: /约会|恋爱|心动|浪漫|告白/, pal: 'bean', d: { soft: .12, glow: .15, temp: .12 }, say: '心动氛围已就位 💗' },
    { re: /下雨|雨天|阴天/, pal: 'haze', d: { speed: -.12, grain: .06, bright: -.04 }, say: '下雨天的蓝灰色，适合发呆' },
    { re: /睡觉|晚安|失眠|夜深/, pal: 'dusk', d: { bright: -.12, speed: -.25, glow: -.1 }, say: '晚安模式：暗一点、慢一点' },
  ];
  function strength(t) {
    if (/一丢丢|一点点|稍微|微微|略微|略|有点点/.test(t)) return .55;
    if (/特别|极其|超级|超|巨|狠狠|爆|非常非常|max|拉满/.test(t)) return 1.7;
    if (/很|非常|更加|好多|多多|再多/.test(t)) return 1.3;
    return 1;
  }
  const isInverse = (t) => /太.{0,6}了|过于|不要(太|那么)|别(太|那么)|没那么|少一点|少点|收一收|降低|减少|去掉|不想要/.test(t);

  function parse(text, P) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    if (/^(重置|恢复默认|还原|reset)/i.test(raw)) return finish(P, { ...DEFAULT }, '已恢复默认');
    if (/随机|惊喜|盲盒|随便|换一个/.test(raw)) {
      const ks = Object.keys(PALETTES).filter((k) => k !== P.palette); const n = { ...P, palette: ks[(Math.random() * ks.length) | 0] };
      ['soft', 'speed', 'glow', 'grain'].forEach((k) => { n[k] = clamp(k, SCHEMA[k].min + Math.random() * (SCHEMA[k].max - SCHEMA[k].min) * .8); });
      n.hue = Math.round((Math.random() - .5) * 20);
      return finish(P, n, '拆了一个审美盲盒：' + PALETTES[n.palette].name);
    }
    const clauses = raw.split(/[，,。；;！!？?\n]|然后|并且|同时|而且/).map((s) => s.trim()).filter(Boolean);
    const next = { ...P }; const says = []; let hit = false;
    for (const c of clauses) {
      const k = strength(c), inv = isInverse(c) ? -1 : 1;
      for (const m of MOODS) if (m.re.test(c)) { hit = true; if (m.pal) next.palette = m.pal; apply(next, m.d, k); says.push(m.say); }
      for (const [re, pal, d] of PAL_WORDS) if (re.test(c) && inv > 0) { hit = true; next.palette = pal; if (d) apply(next, d, k); says.push('换成「' + PALETTES[pal].name + '」'); break; }
      const used = new Set();
      for (const cp of CONCEPTS) {
        const m = c.match(cp.re); if (!m) continue;
        // 避免“亮”被“明亮”重复命中等：同一片段只算一次
        const frag = m[0]; if ([...used].some((u) => u.includes(frag) || frag.includes(u))) continue;
        used.add(frag); hit = true; apply(next, cp.d, k * inv); says.push((inv < 0 ? '收一收：' : '') + (inv < 0 ? cp.say.replace(/^更/, '不那么') : cp.say));
      }
    }
    if (!hit) return null;
    return finish(P, next, [...new Set(says)].join('，'));
  }
  function apply(n, d, k) { Object.entries(d).forEach(([key, v]) => { n[key] = clamp(key, n[key] + v * k); }); }
  function diff(a, b) {
    const out = [];
    if (a.palette !== b.palette) out.push({ key: 'palette', label: '色板', from: PALETTES[a.palette]?.name, to: PALETTES[b.palette]?.name, dir: 0 });
    KEYS.forEach((k) => { const s = SCHEMA[k]; if (Math.abs(a[k] - b[k]) > s.step / 2) out.push({ key: k, label: s.label, from: s.fmt(a[k]), to: s.fmt(b[k]), dir: Math.sign(b[k] - a[k]) }); });
    return out;
  }
  function finish(P, next, say) { KEYS.forEach((k) => { next[k] = +(+next[k]).toFixed(k === 'hue' || k === 'radius' ? 0 : 3); }); return { next, diffs: diff(P, next), reply: say }; }
  function sanitize(o) { const n = { ...DEFAULT }; if (o && PALETTES[o.palette]) n.palette = o.palette; KEYS.forEach((k) => { if (o && Number.isFinite(+o[k])) n[k] = clamp(k, +o[k]); }); return n; }
  function describe(P) { return KEYS.map((k) => `${k}(${SCHEMA[k].label}) ∈ [${SCHEMA[k].min}, ${SCHEMA[k].max}] 当前 ${P[k]}`).join('\n'); }

  window.Tuner = { PALETTES, SCHEMA, KEYS, DEFAULT, parse, diff, finish, sanitize, colorsOf, grade, rgb2hex, hex2rgb, lum, describe, clamp };
})();
