/* 电子痛包：可拖拽的全息吧唧（emoji / 文字 / 图片 / 运势签），本地保存 */
(function () {
  const KEY = 'mood-bag-v1';
  const COLORS = ['#d4a5a5', '#9fb1bc', '#a3b18a', '#d8c3a5', '#9a8c98', '#a8c5c5', '#e8a598', '#efd9a7', '#7d8f9b', '#c48b8d'];
  const EMOJIS = ['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🍓', '🍑', '🍰', '🧋', '🌷', '🌙', '⭐', '✨', '🎧', '💿', '🦋', '🍀', '🐳', '🌈', '💌', '🎀', '🍒', '🪐'];
  const TEXTS = ['暴富', '早睡', '上岸', '不内耗', '好运', '发疯中', '摸鱼', '已读乱回', '逢考必过', '松弛感'];
  const DEFAULTS = [
    { type: 'emoji', v: '🐻', ring: 'BEAR CLUB · MOOD DESK', color: '#d8c3a5', x: 20, y: 30, s: 128, rot: -8 },
    { type: 'text', v: '暴富', ring: 'GET RICH · 一夜暴富', color: '#d4a5a5', x: 43, y: 27, s: 118, rot: 6 },
    { type: 'emoji', v: '🍓', ring: 'STRAWBERRY MILK', color: '#e8a598', x: 65, y: 30, s: 104, rot: -4 },
    { type: 'emoji', v: '🌙', ring: 'GOOD NIGHT · 早睡早起', color: '#9a8c98', x: 84, y: 58, s: 100, rot: 10, shape: 'square' },
    { type: 'text', v: '上岸', ring: 'ALL PASS · 逢考必过', color: '#9fb1bc', x: 30, y: 70, s: 112, rot: 4 },
    { type: 'emoji', v: '🐰', ring: 'BUNNY · HOLOGRAM', color: '#a8c5c5', x: 57, y: 68, s: 122, rot: -10 },
    { type: 'emoji', v: '✨', ring: '', color: '#efd9a7', x: 9, y: 64, s: 80, rot: 0 },
    { type: 'emoji', v: '🎧', ring: 'NOW PLAYING', color: '#7d8f9b', x: 84, y: 24, s: 86, rot: 12 },
  ];
  let bag, items = [], sel = null, toast = () => {}, scale = 1, uid = 0;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nid = () => 'b' + Date.now().toString(36) + (uid++).toString(36);

  function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch (e) {} return DEFAULTS.map((d, i) => ({ id: 'd' + i, shape: 'round', z: i + 1, ...d })); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { toast('存储空间不够啦，删掉几张图片吧唧试试'); } }

  function ringSvg(id, text) {
    if (!text) return '';
    let t = text.trim() + ' · '; while (t.length < 40) t += text.trim() + ' · ';
    t = t.slice(0, 44);
    return `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="rp-${id}" d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"/></defs><text><textPath href="#rp-${id}" textLength="246" lengthAdjust="spacing">${esc(t)}</textPath></text></svg>`;
  }
  function artHtml(b) {
    if (b.type === 'img') return `<img class="art" src="${b.v}" alt="" draggable="false">`;
    if (b.type === 'text') { const n = [...b.v].length; const fs = n <= 2 ? .34 : n <= 3 ? .27 : n <= 4 ? .22 : .18; return `<span class="art txt" style="font-size:calc(var(--s) * ${fs})">${esc(b.v)}</span>`; }
    if (b.type === 'fortune') return `<span class="art fortune"><b>${esc(b.v)}</b><small>${esc(b.sub || '')}</small></span>`;
    return `<span class="art">${esc(b.v)}</span>`;
  }
  function label(b) { return b.type === 'img' ? '图片吧唧' : b.type === 'fortune' ? '运势吧唧：' + b.v : '吧唧：' + b.v; }
  function el(b) { return bag.querySelector(`.badge[data-id="${b.id}"]`); }
  function place(e, b) {
    e.style.left = b.x + '%'; e.style.top = b.y + '%'; e.style.zIndex = b.z || 1;
    e.style.setProperty('--s', Math.round(b.s * scale) + 'px'); e.style.setProperty('--rot', (b.rot || 0) + 'deg'); e.style.setProperty('--bc', b.color);
    e.classList.toggle('square', b.shape === 'square');
  }
  function render() {
    $$('.badge', bag).forEach((e) => e.remove());
    const win = $('.bag-window', bag);
    items.forEach((b) => bag.insertBefore(make(b), win));
  }
  function make(b, isNew) {
    const e = document.createElement('button');
    e.type = 'button'; e.className = 'badge' + (isNew ? ' new' : ''); e.dataset.id = b.id; e.setAttribute('role', 'listitem'); e.setAttribute('aria-label', label(b) + '（方向键移动，Delete 删除）');
    e.innerHTML = `<span class="face">${artHtml(b)}${ringSvg(b.id, b.ring)}<span class="holo"></span><span class="gloss"></span></span>`;
    place(e, b);
    if (isNew) setTimeout(() => e.classList.remove('new'), 800);
    return e;
  }
  function measure() { scale = clamp(bag.clientWidth / 700, .6, 1.1); $$('.badge', bag).forEach((e) => { const b = items.find((x) => x.id === e.dataset.id); b && place(e, b); }); }
  function front(b) { b.z = Math.max(0, ...items.map((x) => x.z || 0)) + 1; const e = el(b); e && (e.style.zIndex = b.z); }
  function select(b) {
    sel = b; $$('.badge', bag).forEach((e) => e.classList.toggle('sel', !!b && e.dataset.id === b.id));
    $('#badgeTools').hidden = !b;
  }
  function act(a) {
    if (!sel) return; const b = sel, e = el(b);
    if (a === 'rotL') b.rot = (b.rot || 0) - 15; else if (a === 'rotR') b.rot = (b.rot || 0) + 15;
    else if (a === 'big') b.s = clamp(b.s + 14, 64, 190); else if (a === 'small') b.s = clamp(b.s - 14, 64, 190);
    else if (a === 'front') front(b);
    else if (a === 'del') { items = items.filter((x) => x !== b); if (e) { e.style.transition = 'transform .3s, opacity .3s'; e.style.transform = 'scale(.2) rotate(40deg)'; e.style.opacity = '0'; setTimeout(() => e.remove(), 300); } select(null); save(); toast('吧唧已取下'); return; }
    e && place(e, b); save();
  }
  /* ---------- 拖拽 ---------- */
  let drag = null;
  function onDown(ev) {
    const e = ev.target.closest('.badge');
    if (!e) { select(null); return; }
    const b = items.find((x) => x.id === e.dataset.id); if (!b) return;
    ev.preventDefault();
    drag = { b, e, sx: ev.clientX, sy: ev.clientY, ox: b.x, oy: b.y, lx: ev.clientX, moved: false, r: bag.getBoundingClientRect(), pid: ev.pointerId };
    try { e.setPointerCapture(ev.pointerId); } catch (_) {}
    front(b); e.classList.add('drag');
  }
  function onMove(ev) {
    if (drag && ev.pointerId === drag.pid) {
      const { b, e, r } = drag, dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      b.x = clamp(drag.ox + (dx / r.width) * 100, 3, 97); b.y = clamp(drag.oy + (dy / r.height) * 100, 4, 96);
      const vx = ev.clientX - drag.lx; drag.lx = ev.clientX;
      e.style.left = b.x + '%'; e.style.top = b.y + '%';
      e.style.setProperty('--rot', (b.rot || 0) + clamp(vx * 1.6, -20, 20) + 'deg');
    }
    light(ev.clientX, ev.clientY);
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const { b, e, moved } = drag; drag = null;
    e.classList.remove('drag'); e.style.setProperty('--rot', (b.rot || 0) + 'deg');
    if (!moved) select(sel === b ? null : b); else save();
  }
  let lightRaf = 0, lp = [0, 0];
  function light(x, y) {
    lp = [x, y]; if (lightRaf) return;
    lightRaf = requestAnimationFrame(() => {
      lightRaf = 0;
      $$('.badge', bag).forEach((e) => {
        const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = (lp[0] - cx) / r.width, dy = (lp[1] - cy) / r.height;
        e.style.setProperty('--hx', 50 + clamp(dx, -1.5, 1.5) * 40 + '%'); e.style.setProperty('--hy', 50 + clamp(dy, -1.5, 1.5) * 40 + '%');
        e.style.setProperty('--gx', 30 + clamp(dx, -1, 1) * 25 + '%'); e.style.setProperty('--gy', 24 + clamp(dy, -1, 1) * 22 + '%');
        e.style.setProperty('--ha', Math.round(Math.atan2(dy, dx) * 57.3) + 'deg');
      });
    });
  }
  function onKey(ev) {
    const e = ev.target.closest && ev.target.closest('.badge'); if (!e) return;
    const b = items.find((x) => x.id === e.dataset.id); if (!b) return;
    const st = ev.shiftKey ? 6 : 2; let used = true;
    if (ev.key === 'ArrowLeft') b.x = clamp(b.x - st, 3, 97); else if (ev.key === 'ArrowRight') b.x = clamp(b.x + st, 3, 97);
    else if (ev.key === 'ArrowUp') b.y = clamp(b.y - st, 4, 96); else if (ev.key === 'ArrowDown') b.y = clamp(b.y + st, 4, 96);
    else if (ev.key === '+' || ev.key === '=') b.s = clamp(b.s + 10, 64, 190); else if (ev.key === '-') b.s = clamp(b.s - 10, 64, 190);
    else if (ev.key === 'r' || ev.key === 'R') b.rot = (b.rot || 0) + 15;
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { select(b); act('del'); return ev.preventDefault(); }
    else used = false;
    if (used) { ev.preventDefault(); place(e, b); save(); }
  }
  /* ---------- 排列 / 摇一摇 ---------- */
  function arrange() {
    const n = items.length; if (!n) return toast('痛包还空着，先放几张吧唧吧');
    const W = bag.clientWidth - 60, H = bag.clientHeight - 60;
    let best = { cell: 0, cols: 1 };
    for (let c = 1; c <= n; c++) { const r = Math.ceil(n / c), cell = Math.min(W / c, H / r); if (cell > best.cell) best = { cell, cols: c }; }
    const cols = best.cols, rows = Math.ceil(n / cols), cell = best.cell, size = clamp((cell * .86) / scale, 64, 170);
    const sorted = items.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    bag.classList.add('arranging');
    sorted.forEach((b, i) => {
      const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols, c = i - r * cols;
      const x0 = (bag.clientWidth - inRow * cell) / 2 + cell * (c + .5), y0 = (bag.clientHeight - rows * cell) / 2 + cell * (r + .5);
      b.x = (x0 / bag.clientWidth) * 100; b.y = (y0 / bag.clientHeight) * 100; b.s = Math.round(size); b.rot = 0;
      const e = el(b); e && place(e, b);
    });
    setTimeout(() => bag.classList.remove('arranging'), 800); save(); toast('✦ 已对称排列，强迫症狂喜');
  }
  function shake() {
    bag.classList.add('arranging');
    items.forEach((b) => { b.x = clamp(b.x + (Math.random() - .5) * 8, 3, 97); b.y = clamp(b.y + (Math.random() - .5) * 8, 4, 96); b.rot = Math.round((b.rot || 0) + (Math.random() - .5) * 24); const e = el(b); if (e) { e.style.setProperty('--dl', (Math.random() * .2).toFixed(2) + 's'); place(e, b); } });
    bag.classList.add('shake'); setTimeout(() => { bag.classList.remove('shake', 'arranging'); }, 900); save();
  }
  function add(o) {
    const b = { id: nid(), shape: 'round', ring: '', color: COLORS[(Math.random() * COLORS.length) | 0], s: 112, rot: Math.round((Math.random() - .5) * 20), x: 25 + Math.random() * 50, y: 25 + Math.random() * 50, ...o };
    b.z = Math.max(0, ...items.map((x) => x.z || 0)) + 1;
    items.push(b); bag.insertBefore(make(b, true), $('.bag-window', bag)); save(); select(b);
    return b;
  }
  /* ---------- 制作面板 ---------- */
  const mk = { tab: 'emoji', emoji: '🐻', img: null, color: COLORS[0], shape: 'round' };
  function initMaker() {
    $('#emojiGrid').innerHTML = EMOJIS.map((e, i) => `<button type="button" data-e="${e}" aria-pressed="${i === 0}" aria-label="${e}">${e}</button>`).join('');
    $('#emojiGrid').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; mk.emoji = b.dataset.e; $$('#emojiGrid button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
    $('#textPresets').innerHTML = TEXTS.map((t) => `<button type="button">${t}</button>`).join('');
    $('#textPresets').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) $('#mkText').value = b.textContent; });
    $('#mkColors').innerHTML = COLORS.map((c, i) => `<button type="button" role="radio" aria-checked="${i === 0}" aria-label="底色 ${c}" data-c="${c}" style="background:${c}"></button>`).join('');
    $('#mkColors').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; mk.color = b.dataset.c; $$('#mkColors button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); });
    $('#mkShape').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; mk.shape = b.dataset.v; $$('#mkShape button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); });
    $$('.mk-tabs button').forEach((t) => t.addEventListener('click', () => { mk.tab = t.dataset.mk; $$('.mk-tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === t))); $$('.mk-panel').forEach((p) => { p.hidden = p.dataset.panel !== mk.tab; }); }));
    $('#mkFile').addEventListener('change', async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      try { mk.img = await shrink(f); $('#upload span').textContent = '✓ 已选好图片，点下方放进痛包'; $('#upload').style.backgroundImage = `url(${mk.img})`; $('#upload').style.backgroundSize = 'cover'; } catch (e) { toast('图片读取失败'); }
      ev.target.value = '';
    });
    $('#mkAdd').addEventListener('click', () => {
      const base = { color: mk.color, shape: mk.shape, ring: $('#mkRing').value.trim() };
      if (mk.tab === 'emoji') add({ ...base, type: 'emoji', v: mk.emoji });
      else if (mk.tab === 'text') { const v = $('#mkText').value.trim(); if (!v) { toast('先写几个字吧'); $('#mkText').focus(); return; } add({ ...base, type: 'text', v }); }
      else { if (!mk.img) { toast('先上传一张图片'); return; } if (items.filter((x) => x.type === 'img').length >= 12) { toast('图片吧唧最多 12 张'); return; } add({ ...base, type: 'img', v: mk.img }); mk.img = null; $('#upload span').textContent = '＋ 上传自家崽崽图'; $('#upload').style.backgroundImage = ''; }
      toast('啪嗒～吧唧已别上');
    });
    $('#badgeTools').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) act(b.dataset.act); });
  }
  function shrink(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { const im = new Image(); im.onload = () => { const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const k = Math.max(S / im.width, S / im.height), w = im.width * k, h = im.height * k; c.getContext('2d').drawImage(im, (S - w) / 2, (S - h) / 2, w, h); res(c.toDataURL('image/jpeg', .85)); }; im.onerror = rej; im.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  function init(opts) {
    bag = $('#bag'); toast = opts.toast || toast;
    items = load(); render(); measure();
    bag.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    bag.addEventListener('keydown', onKey);
    $('#bagArrange').addEventListener('click', arrange);
    $('#bagShake').addEventListener('click', shake);
    $('#bagClear').addEventListener('click', () => { if (!items.length) return; if (!confirm('确定取下所有吧唧吗？')) return; items = []; render(); select(null); save(); toast('痛包已清空'); });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
    initMaker();
  }
  window.Bag = { init, add, arrange, shake, get items() { return items; }, COLORS };
})();
