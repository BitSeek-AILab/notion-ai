/* 文献脱水 · 闯关看板 —— 交互层 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const D = window.Dehydrate, SP = window.Sprites, AI = window.VibeAI;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => Number(n).toLocaleString('zh-CN');

  /* ================= 存档 ================= */
  const LV = [0, 300, 700, 1200, 1800, 2600, 3600, 5000];
  const LV_NAME = ['文献萌新', '摘要猎人', '方法论学徒', '实验骑士', '结论法师', '综述贤者', '脱水宗师', '学术传说'];
  const BADGES = [
    { id: 'first', name: '初出茅庐', desc: '通关第一个关卡', spr: 'b_star' },
    { id: 'combo', name: '三连击', desc: '连续 3 关一次答对', spr: 'b_bolt' },
    { id: 'sharp', name: '火眼金睛', desc: '累计 5 次首答即对', spr: 'b_target' },
    { id: 'half', name: '半程勇者', desc: '一篇文献通关过半', spr: 'b_flame' },
    { id: 'master', name: '脱水大师', desc: '一篇文献全部通关', spr: 'b_crown' },
    { id: 'night', name: '夜读侠', desc: '22:00 后完成通关', spr: 'b_moon' },
    { id: 'early', name: '早起鸟', desc: '8:00 前完成通关', spr: 'b_sun' },
    { id: 'focus', name: '专注之心', desc: '单关专注阅读 3 分钟', spr: 'b_heart' },
    { id: 'atlas', name: '图谱学者', desc: '打开全书思维导图', spr: 'b_net' },
    { id: 'notes', name: '笔记达人', desc: '导出一份脱水笔记', spr: 'b_scroll' },
  ];
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  let profile = load('pq-profile', { xp: 0, badges: {}, streak: 0, firstTry: 0 });
  let doc = null, prog = null;
  const progKey = () => 'pq-prog-' + doc.hash;
  const saveProfile = () => save('pq-profile', profile);
  const saveProg = () => save(progKey(), prog);

  /* ================= 像素天空 ================= */
  function sky() {
    const cv = $('#sky'), c = cv.getContext('2d');
    const S = 4; let w, h, stars = [], hills = [], clouds = [];
    const rnd = (() => { let x = 7; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); })();
    const resize = () => {
      w = Math.ceil(innerWidth / S); h = Math.ceil(innerHeight / S); cv.width = w; cv.height = h;
      stars = Array.from({ length: Math.round(w * h / 180) }, () => ({ x: (rnd() * w) | 0, y: (rnd() * h * 0.62) | 0, p: rnd() * 6, b: rnd() < 0.15 }));
      const mk = (base, amp, step) => { const a = []; let y = base; for (let x = 0; x <= w; x += step) { y += (rnd() - 0.5) * amp; y = Math.max(base - amp * 2, Math.min(base + amp, y)); a.push(y | 0); } return a; };
      hills = [mk(h * 0.74, 6, 3), mk(h * 0.84, 4, 2)];
      clouds = Array.from({ length: 5 }, () => ({ x: rnd() * w, y: 8 + rnd() * h * 0.35, l: 10 + ((rnd() * 14) | 0), v: 0.05 + rnd() * 0.08 }));
    };
    resize(); addEventListener('resize', resize);
    const band = (y0, y1, a, b) => { for (let y = y0; y < y1; y++) { const t = (y - y0) / (y1 - y0); for (let x = 0; x < w; x++) { const dither = ((x + y) % 2) * 0.5; c.fillStyle = t + dither * 0.25 > 0.6 ? b : a; c.fillRect(x, y, 1, 1); } } };
    let frame = 0, last = 0;
    const draw = (t) => {
      if (!reduce) requestAnimationFrame(draw);
      if (t - last < 125 && !reduce) return; last = t || 0; frame++;
      c.fillStyle = '#1a1c2c'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1e2240'; c.fillRect(0, (h * 0.35) | 0, w, h);
      band((h * 0.5) | 0, (h * 0.62) | 0, '#1e2240', '#29366f');
      c.fillStyle = '#29366f'; c.fillRect(0, (h * 0.62) | 0, w, h);
      band((h * 0.66) | 0, (h * 0.74) | 0, '#29366f', '#5d275d');
      stars.forEach((s) => { const on = s.b ? Math.sin(frame / 3 + s.p) > -0.2 : Math.sin(frame / 8 + s.p) > -0.7; if (!on) return; c.fillStyle = s.b ? '#ffcd75' : '#94b0c2'; c.fillRect(s.x, s.y, 1, 1); if (s.b && Math.sin(frame / 3 + s.p) > 0.8) { c.fillRect(s.x - 1, s.y, 3, 1); c.fillRect(s.x, s.y - 1, 1, 3); } });
      // 月亮
      const mx = (w * 0.82) | 0, my = (h * 0.16) | 0, R = 7;
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (x * x + y * y <= R * R) { c.fillStyle = (x + 3) ** 2 + (y - 2) ** 2 < 6 || (x - 3) ** 2 + (y + 3) ** 2 < 3 ? '#ef7d57' : '#ffcd75'; c.fillRect(mx + x, my + y, 1, 1); }
      clouds.forEach((cl) => { cl.x += cl.v; if (cl.x > w + 30) cl.x = -30; c.fillStyle = '#333c57'; c.fillRect(cl.x | 0, cl.y | 0, cl.l, 3); c.fillRect((cl.x + 3) | 0, (cl.y - 2) | 0, cl.l - 6, 2); });
      ['#333c57', '#1a1c2c'].forEach((col, li) => { c.fillStyle = col; const hs = hills[li], step = li ? 2 : 3; hs.forEach((y, i) => c.fillRect(i * step, y, step, h - y)); });
    };
    requestAnimationFrame(draw);
  }

  /* ================= HUD ================= */
  function levelOf(xp) { let i = 0; while (i < LV.length - 1 && xp >= LV[i + 1]) i++; return i; }
  function renderHUD() {
    const i = levelOf(profile.xp), lo = LV[i], hi = LV[Math.min(i + 1, LV.length - 1)];
    $('#pTitle').textContent = `Lv.${i + 1} ${LV_NAME[i]}`;
    $('#xpText').textContent = hi > lo ? `XP ${profile.xp - lo} / ${hi - lo}` : `XP ${profile.xp} · MAX`;
    $('#xpFill').style.width = (hi > lo ? ((profile.xp - lo) / (hi - lo)) * 100 : 100) + '%';
    $('#streak').textContent = profile.streak || 0;
    $('#badgeCount').textContent = Object.keys(profile.badges).length + '/' + BADGES.length;
  }

  /* ================= 开始页 ================= */
  function initStart() {
    $('#avatar').src = SP.url('hero', 3);
    $$('.f-ico').forEach((el) => { el.innerHTML = SP.img(el.dataset.spr, 4); });
    $('#loadSpr').innerHTML = SP.img('drop', 4) + SP.img('drop', 4) + SP.img('drop', 4);
    const drop = $('#drop'), file = $('#file');
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); $('#dropText').textContent = '松手，插入卡带！'; }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); $('#dropText').textContent = '拖入 PDF / TXT，或点击选择文件'; }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    file.addEventListener('change', () => { if (file.files[0]) handleFile(file.files[0]); file.value = ''; });
    $('#demoBtn').addEventListener('click', () => ingest('text', window.PQ_DEMO.text, window.PQ_DEMO.name));
    $('#pasteBtn').addEventListener('click', () => { const b = $('#pasteBox'); b.hidden = !b.hidden; $('#pasteBtn').setAttribute('aria-expanded', String(!b.hidden)); if (!b.hidden) $('#pasteText').focus(); });
    $('#pasteGo').addEventListener('click', () => { const t = $('#pasteText').value.trim(); if (t.length < 200) return toast('文本太短啦，至少粘贴 200 字～'); ingest('text', t, t.split('\n')[0].slice(0, 40)); });
    const last = load('pq-last-doc', null);
    if (last && last.sections) { $('#resumeBtn').hidden = false; $('#resumeBtn').textContent = '继续：' + D.clip(last.title, 12); $('#resumeBtn').onclick = () => openDoc(last); }
  }
  function handleFile(f) {
    const name = f.name.replace(/\.[^.]+$/, '');
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) f.arrayBuffer().then((buf) => ingest('pdf', buf, name));
    else if (/text|markdown/.test(f.type) || /\.(txt|md)$/i.test(f.name)) f.text().then((t) => ingest('text', t, name));
    else toast('目前支持 PDF / TXT / MD 文件');
  }
  function show(id) { ['start', 'loading', 'mapScreen'].forEach((s) => { $('#' + s).hidden = s !== id; }); scrollTo({ top: 0 }); }
  function step(text, pct) { $('#loadStep').textContent = text; $('#loadFill').style.width = pct + '%'; }

  async function ingest(kind, payload, name) {
    show('loading'); step('读取卡带', 6);
    try {
      let raw = payload, title = name;
      if (kind === 'pdf') {
        step('加载 PDF 解析引擎', 10);
        const r = await D.pdfToText(payload, (p, n) => step(`解析第 ${p}/${n} 页`, 10 + (p / n) * 66));
        raw = r.text; title = r.title || name;
        if (raw.replace(/\s/g, '').length < 200) throw new Error('这份 PDF 几乎没有可提取的文字（可能是扫描版图片），换一份试试？');
      }
      await sleep(200); step('识别章节结构', 82);
      await sleep(250);
      const d = D.build(raw, title);
      step(`生成 ${d.sections.length} 个关卡 · 提炼核心论点`, 96);
      await sleep(450);
      d.source = name; d.created = Date.now();
      save('pq-last-doc', d);
      openDoc(d);
    } catch (e) {
      console.error(e); show('start'); toast(e.message || '解析失败了，换一份文件试试');
    }
  }

  /* ================= 地图 ================= */
  let pos = [];
  function openDoc(d) {
    doc = d; prog = load(progKey(), { done: {}, free: false });
    show('mapScreen');
    $('#docTitle').textContent = doc.title;
    $('#freeBtn').setAttribute('aria-pressed', String(!!prog.free));
    renderMap();
  }
  const unlocked = (i) => prog.free || i === 0 || !!prog.done[i - 1];
  const currentIdx = () => { for (let i = 0; i < doc.sections.length; i++) if (!prog.done[i] && unlocked(i)) return i; return doc.sections.length - 1; };

  function renderStats() {
    const n = doc.sections.length, done = Object.keys(prog.done).length;
    const dryChars = doc.sections.reduce((a, s) => a + D.stats(s.points.join('')).chars, 0);
    const saved = Math.max(0, doc.minutes - Math.ceil(dryChars / 400));
    $('#docStats').innerHTML = `共 <b>${n}</b> 关 · 已通关 <b>${done}</b> · 原文 <b>${fmt(doc.chars)}</b> 字 → 脱水 <b>${fmt(dryChars)}</b> 字 · 预计省时 <b>${saved}</b> 分钟`;
    $('#docFill').style.width = (done / n) * 100 + '%';
  }

  function renderMap() {
    renderStats();
    const world = $('#world'), W = world.clientWidth, n = doc.sections.length;
    const cols = W >= 960 ? 4 : W >= 640 ? 3 : 2, rowH = W < 640 ? 210 : 220, top = 110;
    const rows = Math.ceil(n / cols);
    world.style.height = top + rows * rowH - 10 + 'px';
    pos = doc.sections.map((_, i) => { const r = Math.floor(i / cols), c0 = i % cols, c = r % 2 === 0 ? c0 : cols - 1 - c0; return { x: (c + 0.5) * (W / cols), y: top + r * rowH }; });
    // 路径
    const d = pos.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    const cur = currentIdx(), doneUpto = Object.keys(prog.done).length ? Math.max(...Object.keys(prog.done).map(Number)) : -1;
    const dp = pos.slice(0, Math.max(1, Math.min(n, doneUpto + 2))).map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    $('#worldPath').innerHTML = `<path d="${d}" fill="none" stroke="#1a1c2c" stroke-width="14" stroke-linecap="square" stroke-linejoin="miter"/>
      <path d="${d}" fill="none" stroke="#566c86" stroke-width="6" stroke-dasharray="12 10" stroke-linecap="butt"/>
      ${doneUpto >= 0 ? `<path d="${dp}" fill="none" stroke="#ffcd75" stroke-width="6" stroke-linecap="square"/>` : ''}`;
    // 装饰
    let seed = n * 31 + 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const decos = []; const kinds = ['tree', 'pine', 'rock', 'flower', 'tree', 'pine'];
    const H = world.clientHeight;
    for (let k = 0; k < 160 && decos.length < rows * cols * 1.6; k++) {
      const x = 16 + rnd() * (W - 48), y = 20 + rnd() * (H - 56);
      if (pos.some((p) => Math.abs(p.x - x) < 95 && y > p.y - 70 && y < p.y + 110)) continue;
      if (pos.some((p, i) => i && segDist(x + 12, y + 12, pos[i - 1], p) < 34)) continue;
      if (decos.some((q) => Math.hypot(q.x - x, q.y - y) < 46)) continue;
      decos.push({ x, y, s: kinds[(rnd() * kinds.length) | 0] });
    }
    $('#deco').innerHTML = decos.map((q) => `<img class="spr" src="${SP.url(q.s, 4)}" style="left:${q.x | 0}px;top:${q.y | 0}px" alt="">`).join('') +
      `<span class="marker" style="left:${pos[0].x}px;top:${pos[0].y - 98}px">START</span>`;
    // 节点
    $('#nodes').innerHTML = doc.sections.map((s, i) => {
      const done = !!prog.done[i], open = !done && unlocked(i), boss = i === n - 1 && n > 2;
      const cls = done ? 'done' : open ? 'open' : 'locked';
      const icon = done ? SP.img('star', 4) : open ? SP.img(boss ? 'castle' : 'flag', 4) : SP.img('lock', 4);
      const meta = done ? (prog.done[i].first ? '★ 完美通关' : '✓ 已通关') : `⏱${s.minutes}min · 💧${s.dry}%`;
      const half = boss ? 46 : 38;
      return `<button type="button" role="listitem" class="node ${cls} ${boss ? 'boss' : ''}" data-i="${i}" style="left:${pos[i].x}px;top:${pos[i].y - half}px" aria-label="第 ${i + 1} 关 ${esc(s.short)}，${done ? '已通关' : open ? '可挑战' : '未解锁'}">
        <span class="tile"><span class="no">${boss ? 'BOSS' : String(i + 1).padStart(2, '0')}</span>${icon}${done && prog.done[i].first ? `<img class="spr crown-mini" src="${SP.url('b_crown', 2)}" alt="">` : ''}</span>
        <span class="n-label">${esc(s.short)}</span><span class="n-meta">${meta}</span></button>`;
    }).join('');
    $$('#nodes .node').forEach((b) => b.addEventListener('click', () => openLevel(+b.dataset.i)));
    placeHero(cur, false);
  }
  function segDist(x, y, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1; let t = ((x - a.x) * dx + (y - a.y) * dy) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)); }
  function placeHero(i, animate) {
    const h = $('#heroSpr'); h.src = SP.url('hero', 3);
    if (!animate) h.style.transition = 'none';
    const boss = i === doc.sections.length - 1 && doc.sections.length > 2;
    h.style.left = pos[i].x + 'px'; h.style.top = pos[i].y - (boss ? 50 : 42) + 'px';
    if (!animate) requestAnimationFrame(() => { h.style.transition = ''; });
  }
  let resizeT; addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (doc && !$('#mapScreen').hidden) renderMap(); }, 150); });

  /* ================= 关卡面板 ================= */
  let lv = -1, lvOpenAt = 0, attempts = 0, tab = 'dry', lastFocus = null;
  function openLevel(i) {
    if (!unlocked(i)) { toast(`🔒 先通关第 ${i} 关，或开启「自由模式」`); const n = $(`.node[data-i="${i}"]`); n && n.animate && n.animate([{ transform: 'translateX(-50%)' }, { transform: 'translateX(calc(-50% - 6px))' }, { transform: 'translateX(calc(-50% + 6px))' }, { transform: 'translateX(-50%)' }], { duration: 300 }); return; }
    lv = i; lvOpenAt = Date.now(); attempts = 0; tab = 'dry'; lastFocus = document.activeElement;
    const s = doc.sections[i];
    $('#lvNo').textContent = i === doc.sections.length - 1 && doc.sections.length > 2 ? 'BOSS STAGE' : 'STAGE ' + String(i + 1).padStart(2, '0');
    $('#lvTitle').textContent = s.title;
    const dryChars = D.stats(s.points.join('')).chars;
    $('#lvStats').innerHTML = `<span>原文 <b>${fmt(s.chars)}</b> 字</span><span>⏱ 约 <b>${s.minutes}</b> 分钟</span><span>脱水后 <b>${fmt(dryChars)}</b> 字</span><span class="dry">💧 脱水率 <b>${s.dry}%</b></span>${s.ai ? '<span>🤖 <b>AI 深度脱水</b></span>' : ''}`;
    $('#drawer').hidden = false; document.body.style.overflow = 'hidden';
    renderTab('dry'); renderFoot();
    setTimeout(() => $('#tabs [data-tab="dry"]').focus(), 50);
  }
  function closeLevel() {
    if ($('#drawer').hidden) return;
    $('#drawer').hidden = true; document.body.style.overflow = '';
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  function renderTab(t) {
    tab = t; const s = doc.sections[lv];
    $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    const body = $('#lvBody');
    if (t === 'dry') {
      body.innerHTML = `<ol class="points">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
        <p class="kw-title">▌关键词 KEYWORDS</p><div class="kws">${s.keywords.map((k) => `<span class="kw">${esc(k)}</span>`).join('')}</div>
        <div class="ai-row"><button class="px-btn ghost" type="button" id="aiDeep">🤖 AI 深度脱水</button><span>${AI.enabled() ? '用大模型重写论点、导图与小测' : '可选：接入大模型后，论点与题目更精准'}</span></div>`;
      $('#aiDeep').onclick = aiDeep;
    } else if (t === 'mind') {
      const m = s.mind;
      body.innerHTML = `<div class="mm"><div class="mm-root">${esc(m.center)}</div><div class="mm-branches">${m.branches.map((b) => `<div class="mm-branch"><span class="mm-kw">${esc(b.name)}</span>${b.children[0] ? `<span class="mm-leaf">${esc(b.children[0])}</span>` : ''}</div>`).join('')}</div></div>`;
    } else if (t === 'raw') {
      const keys = new Set(s.keyIdx.map((k) => s.sentences[k]));
      const paras = s.text.split(/\n\n+/);
      body.innerHTML = `<div class="raw">${paras.map((p) => { let h = esc(p); keys.forEach((k) => { const e = esc(k); if (e && h.includes(e)) h = h.replace(e, `<mark>${e}</mark>`); }); return `<p>${h}</p>`; }).join('')}</div>`;
    }
    body.scrollTop = 0;
  }
  function renderFoot() {
    const s = doc.sections[lv], done = prog.done[lv];
    const next = lv + 1 < doc.sections.length ? lv + 1 : -1;
    if (done) {
      $('#lvFoot').innerHTML = `<div class="foot-row"><p>✅ 已通关 · ${done.first ? '首次即答对 ★' : '已完成'} · +${done.xp} XP</p><div style="display:flex;gap:16px;flex-wrap:wrap"><button class="px-btn ghost" type="button" id="retry">重新挑战</button>${next >= 0 ? '<button class="px-btn" type="button" id="goNext">下一关 ▶</button>' : '<button class="px-btn" type="button" id="toAtlas">🧠 查看全书图谱</button>'}</div></div>`;
      $('#retry').onclick = () => battle(true);
      if (next >= 0) $('#goNext').onclick = () => openLevel(next); else $('#toAtlas').onclick = () => { closeLevel(); openAtlas(); };
    } else {
      $('#lvFoot').innerHTML = `<div class="foot-row"><p>⚔ 读完了？击败${lv === doc.sections.length - 1 && doc.sections.length > 2 ? '「遗忘大魔王」' : '「拖延怪」'}即可通关</p><button class="px-btn primary" type="button" id="fight">开始挑战 ▶</button></div><button class="skip" type="button" id="skipQ">已读完，跳过挑战直接通关（经验减半）</button>`;
      $('#fight').onclick = () => battle(false);
      $('#skipQ').onclick = () => complete('skip');
    }
  }

  function battle(replay) {
    const s = doc.sections[lv], q = s.quiz, boss = lv === doc.sections.length - 1 && doc.sections.length > 2;
    $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', 'false'));
    if (!q || !q.options || q.options.length < 2) { complete('skip'); return; }
    const body = $('#lvBody');
    body.innerHTML = `<div class="battle">
      <div class="monster" id="mon"><img class="spr" src="${SP.url(boss ? 'boss' : 'slime', 8)}" alt=""><div class="hp"><i id="hp"></i></div><span class="m-name">${boss ? '遗忘大魔王 Lv.99' : '拖延怪 Lv.' + (lv + 1)}</span></div>
      <div class="q-box"><h4>${q.type === 'which' ? '▌WHICH ONE? · 找出本关论点' : q.type === 'ai' ? '▌AI QUIZ · 深度理解题' : '▌FILL THE BLANK · 填空'}</h4><p class="q-text">${esc(q.question).replace(/＿{2,}/g, '<span class="blank" aria-label="空格"></span>')}</p>
        <div class="opts ${q.type === 'which' ? 'which' : ''}">${q.options.map((o, k) => `<button class="opt" type="button" data-k="${k}"><b>${'ABCD'[k]}</b>${esc(o)}</button>`).join('')}</div>
        <p class="q-msg" id="qmsg" aria-live="polite">选出正确答案，对拖延怪造成致命一击！</p></div></div>`;
    $('#lvFoot').innerHTML = `<div class="foot-row"><button class="px-btn ghost" type="button" id="backRead">◀ 回去再读读</button><p>${replay ? '重温模式：不重复计算经验' : '首次答对 +150 XP，答错可重试'}</p></div>`;
    $('#backRead').onclick = () => { renderTab('dry'); renderFoot(); };
    $$('.opt', body).forEach((b) => b.addEventListener('click', async () => {
      const k = +b.dataset.k;
      if (k === q.answer) {
        b.classList.add('right'); $$('.opt', body).forEach((x) => { x.disabled = true; });
        $('#hp').style.width = '0%'; $('#mon').classList.add('hit');
        $('#qmsg').textContent = attempts ? '命中！拖延怪倒下了～' : 'CRITICAL HIT！一击必杀！';
        await sleep(reduce ? 0 : 500); $('#mon').classList.add('dead'); await sleep(reduce ? 0 : 650);
        if (replay) { toast('重温完成，记忆 +1'); renderTab('dry'); renderFoot(); return; }
        complete(attempts === 0 ? 'first' : 'retry');
      } else {
        attempts++; b.classList.add('wrong'); b.disabled = true;
        $('#drawer .drawer-box').classList.remove('shake-screen'); void $('#drawer .drawer-box').offsetWidth; $('#drawer .drawer-box').classList.add('shake-screen');
        $('#qmsg').textContent = ['被拖延怪反击了！再想想～', '提示：回到「原文」找找高亮句子', '别慌，排除法也是一种实力'][Math.min(attempts - 1, 2)];
      }
    }));
  }

  function complete(mode) {
    const i = lv, s = doc.sections[i];
    const focusSec = (Date.now() - lvOpenAt) / 1000;
    let xp = mode === 'first' ? 150 : mode === 'retry' ? 100 : 40;
    if (focusSec >= 120) xp += 30;
    if (i === doc.sections.length - 1 && doc.sections.length > 2 && mode !== 'skip') xp += 100;
    prog.done[i] = { first: mode === 'first', t: Date.now(), xp };
    profile.xp += xp;
    profile.streak = mode === 'first' ? (profile.streak || 0) + 1 : 0;
    if (mode === 'first') profile.firstTry = (profile.firstTry || 0) + 1;
    saveProg(); saveProfile();
    // 勋章
    const n = doc.sections.length, done = Object.keys(prog.done).length, hr = new Date().getHours();
    unlock('first');
    if (profile.streak >= 3) unlock('combo');
    if (profile.firstTry >= 5) unlock('sharp');
    if (done >= Math.ceil(n / 2)) unlock('half');
    if (done >= n) unlock('master');
    if (hr >= 22 || hr < 5) unlock('night');
    if (hr >= 5 && hr < 8) unlock('early');
    if (focusSec >= 180) unlock('focus');
    renderHUD();
    confetti();
    const next = i + 1 < n ? i + 1 : -1;
    $('#lvBody').innerHTML = `<div class="clear-banner"><h4>${done >= n ? 'ALL CLEAR!' : 'STAGE CLEAR!'}</h4><p>+${xp} XP ${mode === 'first' ? '· 一击必杀 ★' : mode === 'skip' ? '· 跳过挑战' : ''}${focusSec >= 120 ? ' · 专注奖励 +30' : ''}</p></div>
      ${s.quiz && s.quiz.explain && mode !== 'skip' ? `<p class="explain"><b>${s.quiz.type === 'ai' ? '💡 解析' : '✔ 原句'}</b>${esc(s.quiz.explain)}</p>` : ''}
      <p class="kw-title">▌本关脱水笔记</p><ol class="points">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>`;
    $('#lvFoot').innerHTML = `<div class="foot-row"><p>${next >= 0 ? `第 ${next + 1} 关「${esc(doc.sections[next].short)}」已解锁` : '🎉 整篇文献脱水完成！'}</p><div style="display:flex;gap:16px;flex-wrap:wrap"><button class="px-btn ghost" type="button" id="toMap">返回地图</button>${next >= 0 ? '<button class="px-btn" type="button" id="goNext">下一关 ▶</button>' : '<button class="px-btn" type="button" id="toAtlas">🧠 全书图谱</button>'}</div></div>`;
    $('#toMap').onclick = () => { closeLevel(); };
    if (next >= 0) $('#goNext').onclick = () => { renderMap(); openLevel(next); };
    else $('#toAtlas').onclick = () => { closeLevel(); openAtlas(); };
    renderMapKeepHero(i);
  }
  function renderMapKeepHero(from) {
    const to = currentIdx();
    renderMap(); placeHero(from, false);
    setTimeout(() => placeHero(to, true), 400);
  }

  async function aiDeep() {
    if (!AI.enabled()) { AI.openSettings({ title: '接入大模型 · 深度脱水', onSave: (on) => { if (on) aiDeep(); } }); return; }
    const s = doc.sections[lv], btn = $('#aiDeep');
    btn.disabled = true; btn.textContent = '🤖 深度脱水中…';
    try {
      const sys = '你是严谨又会讲人话的学术阅读助手，帮助考研党和科研新人快速读懂文献。必须忠于原文，不编造数据。只输出 JSON。';
      const user = `文献：《${doc.title}》\n章节：${s.title}\n正文：\n${s.text.slice(0, 7000)}\n\n用中文输出（专业术语可保留英文）JSON：\n{"points":["3-4 条核心论点，每条 ≤60 字"],"keywords":["4-6 个关键术语"],"mind":[{"name":"导图分支（关键词）","leaf":"≤20 字的人话解释"}](4-5 个),"quiz":{"question":"一道检验是否真正读懂本节的单选题","options":["A","B","C","D"],"answer":正确选项下标0-3,"explain":"一句解析"}}`;
      const j = await AI.chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, temperature: 0.4, timeout: 60000 });
      if (Array.isArray(j.points) && j.points.length) s.points = j.points.map(String).slice(0, 5);
      if (Array.isArray(j.keywords) && j.keywords.length) s.keywords = j.keywords.map(String).slice(0, 8);
      if (Array.isArray(j.mind) && j.mind.length) s.mind = { center: s.short, branches: j.mind.slice(0, 6).map((m) => ({ name: String(m.name || ''), children: m.leaf ? [String(m.leaf)] : [] })) };
      if (j.quiz && Array.isArray(j.quiz.options) && j.quiz.options.length >= 2 && Number.isInteger(+j.quiz.answer)) s.quiz = { type: 'ai', question: String(j.quiz.question || ''), options: j.quiz.options.map(String).slice(0, 4), answer: Math.max(0, Math.min(3, +j.quiz.answer)), explain: String(j.quiz.explain || '') };
      s.ai = true; s.dry = Math.max(0, Math.min(99, Math.round((1 - D.stats(s.points.join('')).chars / Math.max(1, s.chars)) * 100)));
      save('pq-last-doc', doc);
      openLevel(lv); toast('🤖 深度脱水完成');
    } catch (e) {
      console.warn(e); toast('大模型调用失败：' + (e.name === 'AbortError' ? '超时' : e.message).slice(0, 40));
      if (btn) { btn.disabled = false; btn.textContent = '🤖 AI 深度脱水'; }
    }
  }

  /* ================= 勋章 & 特效 ================= */
  const achvQ = []; let achvBusy = false;
  function unlock(id) {
    if (profile.badges[id]) return;
    profile.badges[id] = Date.now(); saveProfile(); renderHUD();
    achvQ.push(BADGES.find((b) => b.id === id)); runAchv();
  }
  async function runAchv() {
    if (achvBusy) return; achvBusy = true;
    while (achvQ.length) {
      const b = achvQ.shift(), el = $('#achv');
      el.innerHTML = `${SP.img(b.spr, 5)}<div><small>ACHIEVEMENT UNLOCKED</small><b>${b.name}</b></div>`;
      el.classList.add('show'); await sleep(2600); el.classList.remove('show'); await sleep(450);
    }
    achvBusy = false;
  }
  function renderBadges() {
    $('#badgeGrid').innerHTML = BADGES.map((b) => { const on = !!profile.badges[b.id]; return `<div class="badge ${on ? 'on' : ''}"><span class="bimg">${SP.img(b.spr, 4, '', on ? {} : { gray: true })}</span><b>${on ? b.name : '？？？'}</b><span>${b.desc}</span></div>`; }).join('');
  }
  function confetti() {
    if (reduce) return;
    const cv = $('#fx'), c = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#ffcd75', '#a7f070', '#73eff7', '#ef7d57', '#41a6f6', '#f4f4f4', '#b13e53'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth * (0.35 + Math.random() * 0.3), y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 16, vy: -6 - Math.random() * 12, s: 6 + ((Math.random() * 3) | 0) * 2, c: cols[(Math.random() * cols.length) | 0] }));
    const t0 = performance.now();
    const f = (t) => { c.clearRect(0, 0, cv.width, cv.height); ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.45; p.vx *= 0.99; c.fillStyle = p.c; c.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.s, p.s); }); if (t - t0 < 1800) requestAnimationFrame(f); else c.clearRect(0, 0, cv.width, cv.height); };
    requestAnimationFrame(f);
  }

  /* ================= 全书图谱 ================= */
  function openAtlas() {
    if (!doc) return;
    unlock('atlas');
    const secs = doc.sections, N = secs.length;
    const R1 = 230 + N * 8, R2 = R1 + 190;
    const tw = (t, fs) => [...t].reduce((a, ch) => a + (/[\u3400-\u9fff\uff00-\uffef]/.test(ch) ? fs : fs * 0.6), 0) + 24;
    const box = (x, y, t, fs, fill, color, cls) => { const w = tw(t, fs), h = fs + 18; return `<g class="${cls || ''}"><rect x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" fill="${fill}" stroke="#1a1c2c" stroke-width="4"/><text x="${x.toFixed(1)}" y="${(y + fs * 0.36).toFixed(1)}" font-size="${fs}" fill="${color}" text-anchor="middle">${esc(t)}</text></g>`; };
    let links = '', nodes = '';
    secs.forEach((s, i) => {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      const x = Math.cos(a) * R1, y = Math.sin(a) * R1;
      const done = !!prog.done[i];
      links += `<path d="M0 0 Q ${(Math.cos(a - 0.25) * R1 * 0.55).toFixed(1)} ${(Math.sin(a - 0.25) * R1 * 0.55).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${done ? '#ffcd75' : '#566c86'}" stroke-width="${done ? 5 : 3}" ${done ? '' : 'stroke-dasharray="10 8"'}/>`;
      const kws = s.keywords.slice(0, 3), spread = Math.min(0.42, (Math.PI * 2) / N * 0.32);
      kws.forEach((k, j) => {
        const b = a + (j - (kws.length - 1) / 2) * spread;
        const kx = Math.cos(b) * R2, ky = Math.sin(b) * R2;
        links += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${kx.toFixed(1)}" y2="${ky.toFixed(1)}" stroke="${done ? '#73eff7' : '#333c57'}" stroke-width="3"/>`;
        nodes += box(kx, ky, D.clip(k, 10), 14, done ? '#257179' : '#20233a', done ? '#f4f4f4' : '#94b0c2');
      });
      nodes += box(x, y, String(i + 1).padStart(2, '0') + ' ' + D.clip(s.short, 9), 16, done ? '#38b764' : '#29366f', done ? '#1a1c2c' : '#f4f4f4');
    });
    nodes += box(0, 0, D.clip(doc.title, 14), 24, '#ffcd75', '#1a1c2c');
    const pad = 120, vb = { x: -R2 - pad, y: -R2 - 50, w: (R2 + pad) * 2, h: (R2 + 50) * 2 };
    $('#atlas').innerHTML = `<svg viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" role="img" aria-label="全书思维导图"><g>${links}</g><g>${nodes}</g></svg>`;
    $('#atlasModal').hidden = false; document.body.style.overflow = 'hidden';
    // 平移 & 缩放
    const svg = $('#atlas svg'); let drag = null;
    const setVB = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); const k = e.deltaY > 0 ? 1.12 : 0.89; const px = vb.x + ((e.clientX - r.left) / r.width) * vb.w, py = vb.y + ((e.clientY - r.top) / r.height) * vb.h; vb.w *= k; vb.h *= k; vb.x = px - (px - vb.x) * k; vb.y = py - (py - vb.y) * k; setVB(); }, { passive: false });
    svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }; svg.setPointerCapture(e.pointerId); $('#atlas').style.cursor = 'grabbing'; });
    svg.addEventListener('pointermove', (e) => { if (!drag) return; const r = svg.getBoundingClientRect(); vb.x = drag.vx - ((e.clientX - drag.x) / r.width) * vb.w; vb.y = drag.vy - ((e.clientY - drag.y) / r.height) * vb.h; setVB(); });
    svg.addEventListener('pointerup', () => { drag = null; $('#atlas').style.cursor = ''; });
    setTimeout(() => $('#atlasModal [data-close]').focus(), 30);
  }

  /* ================= 导出 ================= */
  function exportMd() {
    const date = new Date().toLocaleDateString('zh-CN');
    const dryChars = doc.sections.reduce((a, s) => a + D.stats(s.points.join('')).chars, 0);
    let md = `# ${doc.title}\n\n> 由「文献脱水 · 闯关看板」生成 · ${date}\n> 原文 ${doc.chars} 字 → 脱水 ${dryChars} 字 · 已通关 ${Object.keys(prog.done).length}/${doc.sections.length}\n\n`;
    if (doc.keywords.length) md += `**全书关键词**：${doc.keywords.slice(0, 12).join(' · ')}\n\n`;
    doc.sections.forEach((s, i) => {
      md += `## ${prog.done[i] ? '✅' : '⬜'} 第 ${i + 1} 关 · ${s.title}\n\n**核心论点**\n\n${s.points.map((p, k) => `${k + 1}. ${p}`).join('\n')}\n\n**关键词**：${s.keywords.join('、')}\n\n**思维导图**\n\n- ${s.mind.center}\n${s.mind.branches.map((b) => `  - ${b.name}${b.children[0] ? '：' + b.children[0] : ''}`).join('\n')}\n\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    a.download = (doc.title || '脱水笔记').slice(0, 40) + '.脱水笔记.md';
    document.body.appendChild(a); a.click(); a.remove();
    unlock('notes'); toast('脱水笔记已导出（Markdown）');
  }

  /* ================= 杂项 ================= */
  let toastT;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

  function initEvents() {
    $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) { renderTab(b.dataset.tab); renderFoot(); } });
    $('#tabs').addEventListener('keydown', (e) => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; const ts = ['dry', 'mind', 'raw']; const i = (ts.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3; renderTab(ts[i]); renderFoot(); $(`#tabs [data-tab="${ts[i]}"]`).focus(); });
    $('#drawer').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeLevel(); });
    ['badgeModal', 'atlasModal'].forEach((id) => $('#' + id).addEventListener('click', (e) => { if (e.target.id === id || e.target.closest('[data-close]')) { $('#' + id).hidden = true; document.body.style.overflow = ''; } }));
    document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!$('#atlasModal').hidden) { $('#atlasModal').hidden = true; document.body.style.overflow = ''; } else if (!$('#badgeModal').hidden) { $('#badgeModal').hidden = true; document.body.style.overflow = ''; } else closeLevel(); });
    $('#badgeBtn').addEventListener('click', () => { renderBadges(); $('#badgeModal').hidden = false; document.body.style.overflow = 'hidden'; $('#badgeModal [data-close]').focus(); });
    $('#atlasBtn').addEventListener('click', openAtlas);
    $('#exportBtn').addEventListener('click', exportMd);
    $('#freeBtn').addEventListener('click', () => { prog.free = !prog.free; saveProg(); $('#freeBtn').setAttribute('aria-pressed', String(prog.free)); renderMap(); toast(prog.free ? '🔓 自由模式：所有关卡已解锁' : '🔒 已恢复按顺序闯关'); });
    $('#newBtn').addEventListener('click', () => { show('start'); const last = load('pq-last-doc', null); if (last) { $('#resumeBtn').hidden = false; $('#resumeBtn').textContent = '继续：' + D.clip(last.title, 12); $('#resumeBtn').onclick = () => openDoc(last); } });
    $('#aiBtn').addEventListener('click', () => AI.openSettings({ title: '接入大模型 · 深度脱水', onSave: (on) => toast(on ? '🤖 大模型已就绪：关卡内点「AI 深度脱水」' : '已切回本地引擎') }));
  }

  sky(); initStart(); initEvents(); renderHUD();
  if (new URLSearchParams(location.search).has('demo')) ingest('text', window.PQ_DEMO.text, window.PQ_DEMO.name);
  window.__pq = { get doc() { return doc; }, openLevel, complete: (m) => complete(m), openAtlas };
})();
