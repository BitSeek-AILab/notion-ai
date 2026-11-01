/* Mood Desk 主程序：主题引擎 / 专注时钟 / 今日运势 / 极简记账 / 审美调节台 */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const T = window.Tuner, AI = window.VibeAI, root = document.documentElement;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const WEEK = '日一二三四五六';
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
  function pulseAt(el) { if (!el) return window.Fluid && Fluid.pulse(); const r = el.getBoundingClientRect(); window.Fluid && Fluid.pulse(r.left + r.width / 2, r.top + r.height / 2); }

  /* ================= 主题引擎 ================= */
  let P = T.sanitize(load('mood-params-v1', T.DEFAULT)), cur = null, tw = 0;
  const undo = [];
  const shared = new URLSearchParams(location.search).get('t');
  if (shared) { const p = decodeTheme(shared); if (p) { P = p; setTimeout(() => toast('已载入朋友分享的审美主题 ✨'), 600); } }
  function encodeTheme(p) { return [p.palette, ...T.KEYS.map((k) => +(+p[k]).toFixed(2))].join('_'); }
  function decodeTheme(s) { const a = String(s).split('_'); if (!T.PALETTES[a[0]]) return null; const o = { palette: a[0] }; T.KEYS.forEach((k, i) => { o[k] = +a[i + 1]; }); return T.sanitize(o); }
  function target(p) { return { colors: T.colorsOf(p), soft: p.soft, speed: p.speed, glow: p.glow, grain: p.grain, glass: p.glass, radius: p.radius }; }
  function paint(s) {
    window.Fluid && Fluid.set({ colors: s.colors, scale: 2.5 - s.soft * 1.4, warp: 4.2 - s.soft * 1.4, gloss: .12 + s.glow * 1.05, grain: s.grain, speed: .04 + s.speed * .72 });
    const hex = s.colors.map(T.rgb2hex);
    hex.forEach((h, i) => root.style.setProperty('--c' + i, h));
    const L = .35 * T.lum(s.colors[0]) + .3 * T.lum(s.colors[1]) + .2 * T.lum(s.colors[2]) + .15 * T.lum(s.colors[3]);
    const dark = L < .42; root.classList.toggle('dark', dark);
    root.style.setProperty('--glass-bg', dark ? `rgba(24,20,44,${(s.glass * .85 + .1).toFixed(3)})` : `rgba(255,255,255,${s.glass.toFixed(3)})`);
    root.style.setProperty('--glass-strong', dark ? `rgba(36,30,62,${Math.min(.92, s.glass + .32).toFixed(3)})` : `rgba(255,255,255,${Math.min(.86, s.glass + .26).toFixed(3)})`);
    root.style.setProperty('--radius', Math.round(s.radius) + 'px');
    root.style.setProperty('--blur', Math.round(8 + s.soft * 26) + 'px');
    const acc = s.colors[3]; root.style.setProperty('--accent', T.rgb2hex(dark ? acc : acc.map((x) => x * .82)));
    $('meta[name="theme-color"]').setAttribute('content', hex[1]);
  }
  function applyTheme(p, ms = 900) {
    const to = target(p), from = cur || to; cancelAnimationFrame(tw);
    if (!ms || reduce || !cur) { cur = to; paint(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      const s = { colors: from.colors.map((c, i) => c.map((x, j) => x + (to.colors[i][j] - x) * e)) };
      ['soft', 'speed', 'glow', 'grain', 'glass', 'radius'].forEach((key) => { s[key] = from[key] + (to[key] - from[key]) * e; });
      cur = s; paint(s);
      if (k < 1) tw = requestAnimationFrame(step);
    };
    tw = requestAnimationFrame(step);
  }
  function setParams(next, opts = {}) {
    if (opts.undo !== false) { undo.push({ ...P }); if (undo.length > 40) undo.shift(); }
    const changed = T.KEYS.filter((k) => next[k] !== P[k]);
    P = T.sanitize(next); save('mood-params-v1', P);
    applyTheme(P, opts.ms ?? 900); syncControls(changed);
  }

  /* ================= 卡片 3D 倾斜 & 光斑 ================= */
  function initTilt() {
    if (reduce || matchMedia('(hover: none)').matches) return;
    $$('.card').forEach((c) => {
      const noTilt = c.classList.contains('w-bag');
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--px', (x * 100).toFixed(1) + '%'); c.style.setProperty('--py', (y * 100).toFixed(1) + '%');
        if (!noTilt) { c.style.setProperty('--rx', ((.5 - y) * 4).toFixed(2) + 'deg'); c.style.setProperty('--ry', ((x - .5) * 5).toFixed(2) + 'deg'); }
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ================= 时钟 & 番茄钟 ================= */
  const MODES = { focus: { m: 25, label: '专注中', idle: '准备专注', btn: '开始专注' }, short: { m: 5, label: '小憩中', idle: '小憩一下', btn: '开始小憩' }, long: { m: 15, label: '长休中', idle: '好好休息', btn: '开始长休' } };
  const C = 2 * Math.PI * 104;
  let pomo = load('mood-pomo-v1', null) || { mode: 'focus', left: 1500, running: false, endAt: 0 };
  let tomato = load('mood-tomato-v1', { day: dayKey(), n: 0, min: 0 });
  if (tomato.day !== dayKey()) tomato = { day: dayKey(), n: 0, min: 0 };
  function initClock() {
    const g = $('#ticks'); let h = '';
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, r1 = i % 5 ? 115 : 112, r2 = 119; h += `<line x1="${(120 + Math.cos(a) * r1).toFixed(1)}" y1="${(120 + Math.sin(a) * r1).toFixed(1)}" x2="${(120 + Math.cos(a) * r2).toFixed(1)}" y2="${(120 + Math.sin(a) * r2).toFixed(1)}" ${i % 5 ? 'opacity=".5"' : ''}/>`; }
    g.innerHTML = h;
    $('#ringFg').style.strokeDasharray = C.toFixed(2);
    $$('.modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    $('#pomoGo').addEventListener('click', toggle);
    $('#pomoReset').addEventListener('click', () => setMode(pomo.mode, true));
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && (document.activeElement === document.body || !document.activeElement)) { e.preventDefault(); toggle(); }
      if (e.key === 'Escape' && document.body.classList.contains('zen')) zen(false);
    });
    if (pomo.running && pomo.endAt < Date.now()) { pomo.running = false; pomo.left = 0; }
    renderModes(); renderTomato(); tick(); setInterval(tick, 250);
  }
  function setMode(m, quiet) { pomo = { mode: m, left: MODES[m].m * 60, running: false, endAt: 0 }; save('mood-pomo-v1', pomo); renderModes(); tick(); if (!quiet) toast(MODES[m].idle + ' · ' + MODES[m].m + ' 分钟'); }
  function renderModes() { $$('.modes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === pomo.mode))); }
  function toggle() {
    if (pomo.running) { pomo.left = Math.max(0, (pomo.endAt - Date.now()) / 1000); pomo.running = false; }
    else { if (pomo.left <= 0) pomo.left = MODES[pomo.mode].m * 60; pomo.endAt = Date.now() + pomo.left * 1000; pomo.running = true; audio(); }
    save('mood-pomo-v1', pomo); tick();
  }
  function tick() {
    const now = new Date();
    $('#nowTime').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
    $('#nowSec').textContent = pad(now.getSeconds());
    const M = MODES[pomo.mode], total = M.m * 60;
    let left = pomo.running ? Math.max(0, (pomo.endAt - Date.now()) / 1000) : pomo.left;
    if (pomo.running && left <= 0) { finish(); left = 0; }
    const s = Math.ceil(left);
    $('#pomoTime').textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    $('#pomoLabel').textContent = pomo.running ? M.label : left < total && left > 0 ? '已暂停' : M.idle;
    $('#ringFg').style.strokeDashoffset = (C * (1 - left / total)).toFixed(2);
    $('#pomoGo').textContent = pomo.running ? '暂停' : left < total && left > 0 ? '继续' : M.btn;
    $('#clock').classList.toggle('running', pomo.running);
    document.title = pomo.running ? `${$('#pomoTime').textContent} ${M.label} · Mood Desk` : 'Mood Desk · 赛博电子痛包 & 桌面情绪小组件';
    if (now.getSeconds() === 0 || !tick.inited) { tick.inited = true; renderDate(now); }
  }
  function finish() {
    const m = pomo.mode; pomo.running = false; pomo.left = 0; save('mood-pomo-v1', pomo);
    chime(); pulseAt($('.ring-wrap'));
    if (m === 'focus') { tomato.n++; tomato.min += MODES.focus.m; save('mood-tomato-v1', tomato); renderTomato(); toast('🍅 完成一个番茄！起来走走，喝口水'); setTimeout(() => setMode(tomato.n % 4 === 0 ? 'long' : 'short', true), 1200); }
    else { toast('休息结束，回来继续发光 ✨'); setTimeout(() => setMode('focus', true), 1200); }
  }
  function renderTomato() { $('#tomatoes').innerHTML = tomato.n ? `${'<i class="tm"></i>'.repeat(Math.min(tomato.n, 12))} 今天 ${tomato.n} 个番茄 · 专注 ${tomato.min} 分钟` : '今天还没有番茄，开始第一个吧'; }
  function renderDate(now) {
    const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    $('#nowDate').textContent = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK[now.getDay()]} · 今年第 ${doy} 天`;
    $('#today').textContent = `${now.getMonth() + 1}.${pad(now.getDate())} 周${WEEK[now.getDay()]}`;
    const h = now.getHours();
    const g = h < 5 ? '夜深了，记得早点休息' : h < 11 ? '早上好，今天也要被温柔对待' : h < 13 ? '中午好，吃点好的犒劳自己' : h < 18 ? '下午好，喝杯水再继续吧' : h < 23 ? '晚上好，辛苦啦' : '夜深了，记得早点休息';
    $('#greet').textContent = g;
  }
  let actx;
  function audio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} return actx; }
  function chime() {
    const a = audio(); if (!a) return;
    [784, 988, 1175, 1568].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * .16;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 1.7);
    });
  }
  function zen(on) {
    on = on ?? !document.body.classList.contains('zen');
    document.body.classList.toggle('zen', on); window.scrollTo({ top: 0 }); $('#zenBtn').setAttribute('aria-pressed', String(on)); $('#zenBtn').textContent = on ? '◑ 退出沉浸' : '◐ 沉浸模式';
    if (on) { scrollTo({ top: 0, behavior: 'smooth' }); toast('沉浸模式：按空格开始 / 暂停，Esc 退出'); }
  }

  /* ================= 今日运势 ================= */
  let fortune = null;
  function initFortune() {
    const name = load('mood-name', '');
    $('#fName').value = name;
    const doy = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
    $('#fNo').textContent = 'No.' + String(doy).padStart(3, '0') + ' · ' + new Date().getFullYear();
    const drawn = load('mood-fortune-v1', null);
    if (drawn && drawn.day === dayKey()) { fortune = Fortune.draw(drawn.name); renderFortune(); $('#flip').classList.add('on'); }
    $('#fDraw').addEventListener('click', drawFortune);
    $('#fName').addEventListener('keydown', (e) => { if (e.key === 'Enter') drawFortune(); });
    const front = $('.f-front');
    front.addEventListener('pointermove', (e) => { const r = front.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; front.style.setProperty('--fa', Math.round(x * 180 + y * 90)); front.style.setProperty('--fx', Math.round((x - .5) * 30)); });
  }
  function drawFortune() {
    const name = $('#fName').value.trim(); save('mood-name', name);
    fortune = Fortune.draw(name); save('mood-fortune-v1', { day: dayKey(), name });
    renderFortune(); $('#flip').classList.add('on'); pulseAt($('#flip'));
    setTimeout(() => $('#fBack .fb-act button') && $('#fBack .fb-act button').focus({ preventScroll: true }), 700);
  }
  function renderFortune() {
    const f = fortune, d = new Date();
    $('#fBack').innerHTML = `
      <div class="fb-top"><div><div class="fb-lv">${f.level}</div><div class="fb-stars" aria-label="${f.stars} 星">${'★'.repeat(f.stars)}${'☆'.repeat(5 - f.stars)}</div></div><div class="fb-no">No.${f.no}<br>${d.getMonth() + 1}.${pad(d.getDate())}</div></div>
      <p class="fb-tone">${esc(f.tone)}</p>
      <div class="fb-row"><b>宜</b>${f.yi.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <div class="fb-row ji"><b>忌</b>${f.ji.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <div class="fb-lucky"><div><small>幸运色</small><b><i class="sw" style="background:${f.color}"></i>${f.colorName}</b></div><div><small>幸运数字</small><b>${f.num}</b></div><div><small>幸运物</small><b>${esc(f.item)}</b></div></div>
      <p class="fb-quote">「${esc(f.quote)}」</p>
      <div class="fb-act"><button type="button" id="fPin">📌 做成吧唧</button><button type="button" id="fAgain">换个名字</button></div>`;
    $('#fPin').onclick = () => { Bag.add({ type: 'fortune', v: f.level, sub: `${d.getMonth() + 1}.${pad(d.getDate())}`, ring: `今日运势 · No.${f.no} · 宜${f.yi[0]}`, color: f.color, s: 118 }); toast('运势吧唧已别进痛包 📌'); pulseAt($('#bag')); };
    $('#fAgain').onclick = () => { $('#flip').classList.remove('on'); setTimeout(() => $('#fName').focus(), 500); };
  }

  /* ================= 极简记账 ================= */
  const CATS = [
    { k: 'food', n: '餐饮', e: '🍜', c: '#d8a48f', re: /饭|餐|面|粉|外卖|早餐|早饭|午饭|午餐|晚饭|晚餐|夜宵|火锅|烧烤|食堂|麦当劳|肯德基|汉堡|披萨|寿司|饺子|包子|零食|水果|菜|吃/ },
    { k: 'drink', n: '奶茶咖啡', e: '🧋', c: '#c4a484', re: /奶茶|咖啡|拿铁|美式|茶|星巴克|瑞幸|喜茶|蜜雪|霸王|饮料|可乐|酸奶|果汁/ },
    { k: 'trans', n: '交通', e: '🚇', c: '#9fb1bc', re: /地铁|公交|打车|滴滴|油费|加油|高铁|火车|机票|停车|单车|出租|车费|通勤/ },
    { k: 'shop', n: '购物', e: '🛍️', c: '#d4a5a5', re: /买|淘宝|京东|拼多多|衣服|裙|鞋|包|化妆|口红|护肤|日用|超市|网购|快递|美妆/ },
    { k: 'fun', n: '娱乐谷子', e: '🎀', c: '#9a8c98', re: /电影|游戏|演唱会|KTV|ktv|会员|书|展|门票|剧本杀|密室|充值|谷子|吧唧|手办|周边|痛包|盲盒|娃/ },
    { k: 'home', n: '居家', e: '🏠', c: '#a3b18a', re: /房租|水电|话费|网费|物业|燃气|电费|水费|宽带/ },
    { k: 'other', n: '其他', e: '✨', c: '#b8b0a8', re: /$^/ },
  ];
  const INC = /工资|收入|红包|奖金|报销|退款|兼职|稿费|理财|收款|进账/;
  let ledger = load('mood-ledger-v1', []), budget = load('mood-budget', 120);
  function cn2num(s) { const D = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }, U = { 十: 10, 百: 100, 千: 1000, 万: 10000 }; let total = 0, sec = 0, num = 0; for (const ch of s) { if (ch in D) num = D[ch]; else if (ch in U) { if (U[ch] === 10000) { total += (sec + num) * 10000; sec = 0; } else sec += (num || 1) * U[ch]; num = 0; } } return total + sec + num; }
  function parseLedger(text) {
    let s = String(text).replace(/[零一二两三四五六七八九十百千万]+(?=\s*(块|元|块钱))/g, (m) => String(cn2num(m)));
    const nums = [...s.matchAll(/([+＋])?\s*[¥￥]?\s*(\d+(?:\.\d{1,2})?)\s*(?:元|块钱|块|rmb|RMB)?/g)];
    const out = []; let prevEnd = 0; const used = new Set();
    nums.forEach((m, i) => {
      const amt = parseFloat(m[2]); if (!(amt > 0)) return;
      const before = s.slice(prevEnd, m.index), nextStart = i + 1 < nums.length ? nums[i + 1].index : s.length, after = s.slice(m.index + m[0].length, nextStart);
      const clean = (x) => x.replace(/[，,;；、。\s]+/g, ' ').trim();
      let note = clean(before);
      if (!note || used.has(prevEnd)) { const a = clean(after); note = a.split(' ')[0] || ''; used.add(m.index + m[0].length); }
      prevEnd = m.index + m[0].length;
      const inc = !!m[1] || INC.test(note);
      const cat = inc ? 'inc' : (CATS.find((c) => c.re.test(note)) || CATS[CATS.length - 1]).k;
      out.push({ amt: Math.round(amt * 100) / 100, note: note.slice(0, 16), cat, inc });
    });
    return out;
  }
  function initLedger() {
    $('#ledQuick').innerHTML = CATS.filter((c) => c.k !== 'other').map((c) => `<button type="button" data-n="${c.n.slice(0, 2)}">${c.e} ${c.n}</button>`).join('') + '<button type="button" data-n="+ 工资">💰 收入</button>';
    $('#ledQuick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const i = $('#ledText'); i.value = b.dataset.n + ' '; i.focus(); });
    $('#ledForm').addEventListener('submit', (e) => {
      e.preventDefault(); const v = $('#ledText').value.trim(); if (!v) return;
      const rows = parseLedger(v);
      if (!rows.length) { toast('没找到金额哦，试试「奶茶 18」'); return; }
      const t = Date.now(); rows.forEach((r, i) => ledger.push({ id: t.toString(36) + i, t: t + i, ...r }));
      save('mood-ledger-v1', ledger); $('#ledText').value = ''; renderLedger(true); pulseAt($('#ledger'));
      const exp = rows.filter((r) => !r.inc).reduce((a, r) => a + r.amt, 0), inc = rows.filter((r) => r.inc).reduce((a, r) => a + r.amt, 0);
      toast(`已记 ${rows.length} 笔${exp ? ' · 支出 ¥' + fmt(exp) : ''}${inc ? ' · 收入 ¥' + fmt(inc) : ''}`);
    });
    $('#ledList').addEventListener('click', (e) => { const b = e.target.closest('.x'); if (!b) return; ledger = ledger.filter((x) => x.id !== b.dataset.id); save('mood-ledger-v1', ledger); renderLedger(); });
    $('#budgetBtn').addEventListener('click', () => { const v = prompt('每日预算（元）', budget); if (v == null) return; const n = parseFloat(v); if (n > 0) { budget = Math.round(n); save('mood-budget', budget); renderLedger(); toast('每日预算已设为 ¥' + budget); } });
    renderLedger();
  }
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  function renderLedger(fresh) {
    const now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const today = ledger.filter((x) => x.t >= d0), month = ledger.filter((x) => x.t >= m0 && !x.inc);
    const spend = today.filter((x) => !x.inc).reduce((a, x) => a + x.amt, 0), mSum = month.reduce((a, x) => a + x.amt, 0);
    $('#budgetVal').textContent = budget;
    $('#ledToday').textContent = '¥' + fmt(spend);
    const ratio = spend / budget;
    $('#budgetFill').style.width = Math.min(100, ratio * 100) + '%'; $('.budget-bar').classList.toggle('over', ratio > 1);
    $('#ledMood').textContent = !spend ? '😌 今天还没花钱，省钱小天才' : ratio < .5 ? `😌 稳稳的 · 还剩 ¥${fmt(budget - spend)}` : ratio < .85 ? `🙂 预算内 · 还剩 ¥${fmt(budget - spend)}` : ratio <= 1 ? `😗 快到预算线了 · 剩 ¥${fmt(budget - spend)}` : `🫠 超支 ¥${fmt(spend - budget)}，明天省一点`;
    $('#ledMonth').textContent = '¥' + (mSum >= 10000 ? (mSum / 10000).toFixed(1) + '万' : fmt(Math.round(mSum)));
    // 环形图
    const by = CATS.map((c) => ({ ...c, v: month.filter((x) => x.cat === c.k).reduce((a, x) => a + x.amt, 0) })).filter((c) => c.v > 0).sort((a, b) => b.v - a.v);
    const R = 46, CC = 2 * Math.PI * R; let off = 0;
    $('#donut').innerHTML = `<circle cx="60" cy="60" r="${R}" stroke="var(--line-2)"/>` + by.map((c) => { const len = (c.v / mSum) * CC; const s = `<circle cx="60" cy="60" r="${R}" stroke="${c.c}" stroke-dasharray="${Math.max(0, len - 2).toFixed(2)} ${CC.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${c.n} ¥${fmt(c.v)}</title></circle>`; off += len; return s; }).join('');
    $('#ledLegend').innerHTML = by.slice(0, 5).map((c) => `<li><i style="background:${c.c}"></i>${c.n} ${Math.round((c.v / mSum) * 100)}%</li>`).join('');
    const list = today.slice().sort((a, b) => b.t - a.t);
    $('#ledList').innerHTML = list.length ? list.map((x, i) => { const c = x.inc ? { e: '💰', n: '收入' } : CATS.find((k) => k.k === x.cat) || CATS[6]; const tm = new Date(x.t); return `<li ${fresh && i === 0 ? '' : 'style="animation:none"'}><span class="e" aria-hidden="true">${c.e}</span><span class="n">${esc(x.note || c.n)}<small>${pad(tm.getHours())}:${pad(tm.getMinutes())}</small></span><span class="a ${x.inc ? 'inc' : ''}">${x.inc ? '+' : '-'}¥${fmt(x.amt)}</span><button class="x" type="button" data-id="${x.id}" aria-label="删除这笔">×</button></li>`; }).join('') : '<li class="empty">今天还没有记账，试试输入「奶茶 18」</li>';
  }

  /* ================= 审美调节台 ================= */
  const SUGS = ['再温柔一点', '冷一点', '太亮了', '多巴胺一点', '胶片感', '赛博一点', '安静下来', '我今天好累', '圆润可爱', '更通透', '随机盲盒', '重置'];
  function initTuner() {
    $('#tSugs').innerHTML = SUGS.map((s) => `<button type="button">${s}</button>`).join('');
    $('#tSugs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
    $('#tForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#tText').value.trim(); if (!v) return; $('#tText').value = ''; ask(v); });
    $('#palettes').innerHTML = Object.entries(T.PALETTES).map(([k, p]) => `<button type="button" role="radio" data-p="${k}" aria-checked="${k === P.palette}" aria-label="${p.name}">${p.colors.map((c) => `<i style="background:${c}"></i>`).join('')}<span>${p.name}</span></button>`).join('');
    $('#palettes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.dataset.p === P.palette) return; const r = T.finish(P, { ...P, palette: b.dataset.p }, '换成「' + T.PALETTES[b.dataset.p].name + '」'); setParams(r.next); bot(r.reply, r.diffs); });
    $('#sliders').innerHTML = T.KEYS.map((k) => { const s = T.SCHEMA[k]; return `<label class="sl" data-k="${k}"><span>${s.label}</span><output id="o-${k}">${s.fmt(P[k])}</output><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${P[k]}" data-k="${k}" aria-label="${s.label}"></label>`; }).join('');
    $('#sliders').addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; const next = { ...P, [k]: +e.target.value }; P = T.sanitize(next); save('mood-params-v1', P); $('#o-' + k).textContent = T.SCHEMA[k].fmt(P[k]); applyTheme(P, 0); renderEq(); });
    $('#sliders').addEventListener('pointerdown', () => { undo.push({ ...P }); });
    $('#tUndo').addEventListener('click', () => { if (!undo.length) return toast('没有可以撤销的了'); const prev = undo.pop(); const d = T.diff(P, prev); setParams(prev, { undo: false }); bot('已撤销上一步', d); });
    $('#tShare').addEventListener('click', async () => {
      const url = location.origin + location.pathname + '?t=' + encodeTheme(P);
      try { await navigator.clipboard.writeText(url); toast('主题链接已复制，发给朋友一起变好看 ✨'); } catch (e) { prompt('复制这个主题链接：', url); }
    });
    renderEq();
    bot('嗨～用一句话告诉我你想要的感觉，比如「再温柔一点」「太亮了」「赛博一点」，我会把参数变化摊开给你看。', null, true);
  }
  const EQL = { hue: '色相', temp: '冷暖', sat: '饱和', bright: '明度', soft: '柔和', speed: '流速', glow: '光泽', grain: '颗粒', glass: '雾度', radius: '圆角' };
  function renderEq(changed = []) {
    const eq = $('#tEq'); if (!eq) return;
    if (!eq.children.length) eq.innerHTML = T.KEYS.map((k) => `<div class="bar" data-k="${k}"><i></i><span>${EQL[k]}</span></div>`).join('');
    T.KEYS.forEach((k) => { const s = T.SCHEMA[k], b = eq.querySelector(`[data-k="${k}"]`); b.style.setProperty('--h', (8 + ((P[k] - s.min) / (s.max - s.min)) * 92).toFixed(1) + '%'); });
    changed.forEach((k) => { const b = eq.querySelector(`[data-k="${k}"]`); if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); } });
  }
  function syncControls(changed = []) {
    renderEq(changed);
    $$('#palettes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.p === P.palette)));
    T.KEYS.forEach((k) => { const i = $(`#sliders input[data-k="${k}"]`); if (!i) return; i.value = P[k]; $('#o-' + k).textContent = T.SCHEMA[k].fmt(P[k]); });
    changed.forEach((k) => { const l = $(`.sl[data-k="${k}"]`); if (l) { l.classList.remove('flash'); void l.offsetWidth; l.classList.add('flash'); } });
  }
  function me(text) { const m = document.createElement('div'); m.className = 'msg me'; m.textContent = text; $('#tLog').appendChild(m); scrollLog(); }
  function bot(text, diffs, intro, ai) {
    const m = document.createElement('div'); m.className = 'msg bot';
    m.innerHTML = `<p>${ai ? '<span class="ai-tag">AI</span>' : ''}${esc(text)}</p>` + (diffs && diffs.length ? `<div class="diffs">${diffs.map((d) => `<span class="diff ${d.dir > 0 ? 'up' : d.dir < 0 ? 'down' : ''}"><b>${d.label}</b>${esc(d.from)} → ${esc(d.to)} ${d.dir > 0 ? '↑' : d.dir < 0 ? '↓' : '⇄'}</span>`).join('')}</div>` : diffs && !intro ? '<div class="diffs"><span class="diff">参数已经到头啦</span></div>' : '');
    $('#tLog').appendChild(m); scrollLog(); return m;
  }
  function scrollLog() { const l = $('#tLog'); while (l.children.length > 24) l.firstChild.remove(); l.scrollTop = l.scrollHeight; }
  async function ask(text) {
    me(text);
    if (/^(撤销|回到上一步|上一个)$/.test(text)) { $('#tUndo').click(); return; }
    const r = T.parse(text, P);
    if (r) { setParams(r.next); bot(r.reply, r.diffs); pulseAt($('#tuner')); return; }
    if (AI.enabled()) return aiTune(text);
    const m = bot('这句我还没学会 🥲 可以试试「温柔 / 清冷 / 多巴胺 / 胶片 / 赛博 / 太亮了 / 慢一点」，或者接入大模型让我听懂更多话。');
    const b = document.createElement('button'); b.className = 'link'; b.type = 'button'; b.textContent = '接入大模型 →'; b.onclick = openAI; m.appendChild(b);
  }
  async function aiTune(text) {
    const m = bot('正在理解你的审美…'); m.classList.add('loading');
    try {
      const pals = Object.entries(T.PALETTES).map(([k, p]) => `${k}=${p.name}`).join('，');
      const sys = '你是 UI 审美调参助手。根据用户的一句话（可能是感觉、情绪、场景或具体要求），调整界面视觉参数。只输出 JSON：{"palette":"可选，色板 id","params":{"只写需要改变的键":新数值},"reply":"≤30 字的中文解释，语气温柔"}。改动要克制，一般 2-5 个参数。';
      const user = `可选色板：${pals}\n当前色板：${P.palette}\n参数（键(含义) ∈ [最小, 最大] 当前值）：\n${T.describe(P)}\n\n用户说：「${text}」`;
      const j = await AI.chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, temperature: .5, timeout: 40000 });
      const next = T.sanitize({ ...P, ...(j.params || {}), palette: T.PALETTES[j.palette] ? j.palette : P.palette });
      const d = T.diff(P, next); m.remove();
      if (!d.length) { bot(j.reply || '保持现在这样就很好看～', []); return; }
      setParams(next); bot(j.reply || '调好啦', d, false, true); pulseAt($('#tuner'));
    } catch (e) { m.remove(); bot('AI 暂时没连上（' + (e.message || '网络错误') + '），先用规则帮你：试试「温柔一点」'); }
  }
  function openAI() { AI.openSettings({ title: '接入大模型（可选）', tip: '用于「审美调节台」听懂更复杂的描述，例如“像宫崎骏夏天的傍晚”。Key 只保存在你的浏览器本地。' }); }

  /* ================= 启动 ================= */
  function boot() {
    Fluid.init($('#fluid'));
    applyTheme(P, 0);
    initTilt(); initClock(); initFortune(); initLedger(); initTuner();
    Bag.init({ toast });
    $('#zenBtn').addEventListener('click', () => zen());
    $('#aiBtn').addEventListener('click', openAI);
    window.__mood = { get P() { return P; }, setParams, ask, parseLedger, finish, zen };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
