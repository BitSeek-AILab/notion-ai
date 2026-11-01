/* 反PUA翻译器 · 交互层 */
(() => {
  const E = window.PUAEngine;
  const AI = window.VibeAI;
  const $ = (s, r = document) => r.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PIX = "'Fusion Pixel 12px Proportional SC', monospace";
  const state = { role: 'boss', text: '', result: null, nonce: { soft: 0, firm: 0, hard: 0 }, aiIdx: { soft: 0, firm: 0, hard: 0 }, ecg: { mode: 'idle', score: 0, color: '#3dff9a' } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  /* ---------------- 开机 ---------------- */
  function boot() {
    const el = $('#boot'), log = $('#bootLog');
    if (reduce || sessionStorage.getItem('apua-booted')) { el.remove(); return; }
    sessionStorage.setItem('apua-booted', '1');
    const lines = ['> BOOT CYBER-CLINIC OS v2.0', '> 载入黑话词典 ........ 42 条', '> 校准情商模块 ........ OK', '> 加载反PUA协议 ....... OK', '> 赛博医生已上线。', ''];
    let i = 0, done = false;
    const finish = () => { if (done) return; done = true; el.classList.add('hide'); setTimeout(() => el.remove(), 450); };
    el.addEventListener('click', finish);
    (function next() {
      if (done) return;
      if (i >= lines.length) return setTimeout(finish, 250);
      log.textContent += lines[i++] + '\n';
      setTimeout(next, 170);
    })();
  }

  /* ---------------- 黑话雨 ---------------- */
  function rain() {
    const cv = $('#rain'), ctx = cv.getContext('2d');
    const CH = '画饼赋能抓手闭环颗粒度对齐拉通格局福报狼性兜底复盘倒逼沉淀链路痛点打法组合拳毕业优化底层逻辑向上管理KPI996OKR';
    let W, H, cols, drops, fs = 16;
    const resize = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      cols = Math.ceil(W / (fs + 6)); drops = Array.from({ length: cols }, () => Math.random() * -H / fs);
      ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, W, H);
    };
    resize(); addEventListener('resize', resize);
    let last = 0;
    const draw = (t) => {
      requestAnimationFrame(draw);
      if (document.hidden || t - last < 60) return;
      last = t;
      ctx.fillStyle = 'rgba(5,7,11,0.16)'; ctx.fillRect(0, 0, W, H);
      ctx.font = fs + 'px ' + PIX;
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * fs;
        const ch = CH[(Math.random() * CH.length) | 0];
        ctx.fillStyle = Math.random() < 0.02 ? '#ff3d9a' : (Math.random() < 0.5 ? '#3dff9a' : '#1d9e62');
        ctx.fillText(ch, i * (fs + 6), y);
        if (y > H && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.6 + (i % 3) * 0.2;
      }
    };
    if (reduce) { ctx.font = fs + 'px ' + PIX; for (let i = 0; i < 300; i++) { ctx.fillStyle = 'rgba(61,255,154,.4)'; ctx.fillText(CH[i % CH.length], Math.random() * W, Math.random() * H); } }
    else requestAnimationFrame(draw);
  }

  /* ---------------- 像素机器人 ---------------- */
  const SPRITE = [
    '.......MM.......', '.......MM.......', '........G.......', '..GGGGGGGGGGGG..',
    '..GDDDDDDDDDDG..', '..GDKKKKKKKKDG..', '..GDKCCKKCCKDG..', '..GDKCCKKCCKDG..',
    '..GDKKKKKKKKDG..', '..GDKKMMMMKKDG..', '..GDDDDDDDDDDG..', '...GGGGGGGGGG...',
    '....DWWWWWWD....', '....DWWMMWWD....', '....DWMMMMWD....', '....DWWMMWWD....',
  ];
  const PAL = { G: '#3dff9a', D: '#0f6a3f', K: '#031b10', C: '#35e0ff', M: '#ff3d9a', W: '#dcffec', Y: '#ffd84d', R: '#ff4d5e' };
  function drawSprite(ctx, ox, oy, px, opt = {}) {
    SPRITE.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      let c = PAL[ch];
      if (ch === 'C') c = opt.blink && (y === 6) ? PAL.K : (opt.eye || PAL.C);
      if (ch === 'M' && y === 9) c = opt.mouth || PAL.M;
      ctx.fillStyle = c; ctx.fillRect(ox + x * px, oy + y * px, px, px);
    }));
  }
  const bot = { eye: PAL.C, mouth: PAL.M };
  function botLoop() {
    const cv = $('#bot'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const render = (blink) => { ctx.clearRect(0, 0, 16, 16); drawSprite(ctx, 0, 0, 1, { blink, eye: bot.eye, mouth: bot.mouth }); };
    render(false);
    if (reduce) return;
    setInterval(() => { if (!document.body.contains(cv)) return; render(true); setTimeout(() => render(false), 160); }, 3200);
  }

  /* ---------------- 心电监护 ---------------- */
  function ecg() {
    const cv = $('#ecg'), ctx = cv.getContext('2d');
    let W = 0, H = 0, ys = [], x = 0, ph = 0, d = 1;
    const resize = () => {
      d = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      ys = new Array(Math.ceil(W)).fill(H / 2); x = 0;
    };
    resize(); addEventListener('resize', resize);
    const beat = (p) => {
      // P 波 - QRS - T 波
      const g = (c, w, a) => a * Math.exp(-((p - c) ** 2) / (2 * w * w));
      return g(0.12, 0.025, 0.12) + g(0.28, 0.008, -0.18) + g(0.31, 0.01, 1) + g(0.34, 0.01, -0.32) + g(0.58, 0.05, 0.24);
    };
    const tick = () => {
      requestAnimationFrame(tick);
      if (document.hidden) return;
      const m = state.ecg;
      const bpm = m.mode === 'scan' ? 170 : m.mode === 'result' ? 62 + m.score * 1.1 : 64;
      const amp = m.mode === 'scan' ? 0.55 + Math.random() * 0.4 : m.mode === 'result' ? 0.45 + m.score / 140 : 0.42;
      const speed = 2.2;
      for (let s = 0; s < speed; s++) {
        ph += bpm / 60 / 60 / speed;
        if (ph > 1) ph -= 1;
        let v = beat(ph) * amp;
        v += (Math.random() - 0.5) * (m.mode === 'scan' ? 0.12 : 0.02);
        if (m.mode === 'scan' && Math.random() < 0.01) v += (Math.random() - 0.5) * 0.9;
        ys[x] = H * 0.62 - v * H * 0.55;
        x = (x + 1) % ys.length;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(61,255,154,.07)'; ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 20) { ctx.beginPath(); ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 20) { ctx.beginPath(); ctx.moveTo(0, gy + .5); ctx.lineTo(W, gy + .5); ctx.stroke(); }
      const col = m.mode === 'scan' ? '#ffd84d' : m.color;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < ys.length; i++) {
        const gap = (i - x + ys.length) % ys.length;
        if (gap < 14) { pen = false; continue; }
        if (!pen) { ctx.moveTo(i, ys[i]); pen = true; } else ctx.lineTo(i, ys[i]);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      const hx = (x - 1 + ys.length) % ys.length;
      ctx.fillStyle = '#fff'; ctx.fillRect(hx - 2, ys[hx] - 2, 4, 4);
    };
    if (reduce) { state.ecg.mode = 'idle'; }
    requestAnimationFrame(tick);
  }

  /* ---------------- 输入区 ---------------- */
  function initInput() {
    const roles = $('#roles');
    roles.innerHTML = Object.entries(E.ROLES).map(([k, r]) => `<button type="button" class="role" role="radio" data-k="${k}" aria-checked="${k === state.role}">${r.label}</button>`).join('');
    roles.addEventListener('click', (e) => { const b = e.target.closest('.role'); if (b) setRole(b.dataset.k); });
    roles.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      const keys = Object.keys(E.ROLES); let i = keys.indexOf(state.role);
      i = (i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length; setRole(keys[i]); roles.querySelector(`[data-k="${keys[i]}"]`).focus();
    });
    const ta = $('#input');
    ta.addEventListener('input', () => { $('#count').textContent = ta.value.length + '/500'; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); diagnose(); } });
    $('#scanBtn').addEventListener('click', diagnose);
    $('#shuffle').addEventListener('click', renderSamples);
    renderSamples();
    renderHistory();
  }
  function setRole(k) {
    state.role = k;
    document.querySelectorAll('.role').forEach((b) => { b.setAttribute('aria-checked', b.dataset.k === k); b.tabIndex = b.dataset.k === k ? 0 : -1; });
  }
  let sampleOffset = 0;
  function renderSamples() {
    const all = E.SAMPLES; const n = innerWidth < 560 ? 4 : 6;
    const list = Array.from({ length: n }, (_, i) => all[(sampleOffset + i) % all.length]);
    sampleOffset = (sampleOffset + n) % all.length;
    $('#samples').innerHTML = list.map((s) => `<button type="button" class="chip" data-role="${s.role}" data-text="${esc(s.text)}"><b>${E.ROLES[s.role].label}</b>${esc(s.text.length > 22 ? s.text.slice(0, 22) + '…' : s.text)}</button>`).join('');
    $('#samples').querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
      $('#input').value = c.dataset.text; $('#count').textContent = c.dataset.text.length + '/500'; setRole(c.dataset.role); diagnose();
    }));
  }

  /* ---------------- 历史 ---------------- */
  const HKEY = 'apua-history-v1';
  const getHist = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } };
  function saveHist(r) {
    const h = getHist().filter((x) => x.text !== state.text);
    h.unshift({ text: state.text, role: state.role, score: r.score, color: r.levelColor, t: Date.now() });
    localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 6)));
    renderHistory();
  }
  function renderHistory() {
    const h = getHist(); $('#historyBox').hidden = !h.length;
    $('#history').innerHTML = h.map((x, i) => `<li><button type="button" data-i="${i}"><span class="h-score" style="background:${x.color}">${x.score}</span><span class="h-text">${esc(x.text)}</span></button></li>`).join('');
    $('#history').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const x = getHist()[+b.dataset.i]; if (!x) return; $('#input').value = x.text; setRole(x.role); diagnose();
    }));
  }

  /* ---------------- 大模型 ---------------- */
  function refreshEngine() {
    const on = AI.enabled();
    $('#led').classList.toggle('ai', on);
    $('#engineLabel').textContent = on ? '大模型引擎 · ' + AI.get().model : '本地引擎 · 离线可用';
    $('#aiBtn').textContent = on ? '⚙ 模型设置' : '⚙ 接入大模型';
  }
  async function aiAnalyze(text, roleKey) {
    const role = E.ROLES[roleKey];
    const names = E.CATS.map((c) => c.name).join('/');
    const sys = '你是「反PUA翻译器·赛博诊断室」的首席诊断医生，专门拆解职场与学术场景里的 PUA 话术和黑话。风格犀利、幽默、一针见血；但给出的回复必须体面、可直接发送、有高情商，不辱骂、不阴阳怪气过度。只输出 JSON，不要任何额外文字。';
    const user = `施压来源：${role.label}\n原话：「${text}」\n\n输出 JSON：\n{"score":0-100的整数(PUA浓度；正常沟通给0-20),\n"tags":[{"name":"成分名，优先从这些里选：${names}","percent":整数}](1-4个，合计100；正常沟通给空数组),\n"summary":"一句话真实意图(≤30字)",\n"breakdown":[{"quote":"原话片段","subtext":"潜台词翻译，幽默扎心(≤40字)","tag":"对应成分名"}](按原话顺序1-5条),\n"jargon":[{"word":"黑话","meaning":"人话翻译(≤20字)"}](没有就空数组),\n"replies":{"soft":["温和太极型","另一版"],"firm":["有理有据·划清边界型","另一版"],"hard":["体面反杀·硬核型","另一版"]}(每条30-90字，可直接发送，称呼对方为“${role.addr || '你'}”),\n"advice":"一句医嘱(≤20字)"}`;
    const j = await AI.chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true, temperature: 0.85 });
    const score = Math.max(0, Math.min(100, Math.round(+j.score || 0)));
    const lv = E.levelOf(score);
    const colorOf = (name) => (E.CATS.find((c) => name && (c.name === name || name.includes(c.name) || c.name.includes(name))) || {}).color || ['#35e0ff', '#ff3d9a', '#ffd84d', '#3dff9a'][(name || '').length % 4];
    const emojiOf = (name) => (E.CATS.find((c) => name && (c.name === name || name.includes(c.name))) || {}).emoji || '🧪';
    const tags = (Array.isArray(j.tags) ? j.tags : []).slice(0, 4).map((t) => ({ name: String(t.name || '未知成分'), percent: Math.max(1, Math.round(+t.percent || 0)), color: colorOf(t.name), emoji: emojiOf(t.name) }));
    const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String).filter(Boolean);
    const replies = { soft: arr(j.replies?.soft), firm: arr(j.replies?.firm), hard: arr(j.replies?.hard) };
    const local = E.analyze(text, roleKey, 0);
    ['soft', 'firm', 'hard'].forEach((k) => { if (!replies[k].length) replies[k] = [local.replies[k]]; });
    const breakdown = (Array.isArray(j.breakdown) ? j.breakdown : []).slice(0, 6).map((b) => ({ quote: String(b.quote || ''), subtext: String(b.subtext || ''), tag: String(b.tag || (tags[0] || {}).name || '话术'), color: colorOf(b.tag || (tags[0] || {}).name), emoji: emojiOf(b.tag) })).filter((b) => b.subtext);
    return {
      engine: 'ai', score, level: lv.lv, levelName: lv.name, levelDesc: lv.desc, levelColor: lv.color,
      tags, breakdown: breakdown.length ? breakdown : local.breakdown, jargon: Array.isArray(j.jargon) ? j.jargon.slice(0, 6).filter((x) => x && x.word) : [],
      summary: String(j.summary || local.summary), advice: String(j.advice || local.advice), role: role.label,
      aiReplies: replies, replies: { soft: replies.soft[0], firm: replies.firm[0], hard: replies.hard[0] },
    };
  }

  /* ---------------- 诊断流程 ---------------- */
  let busy = false;
  async function diagnose() {
    if (busy) return;
    const text = $('#input').value.trim();
    if (!text) { toast('先粘贴一句原话～'); $('#input').focus(); return; }
    busy = true; state.text = text; state.nonce = { soft: 0, firm: 0, hard: 0 }; state.aiIdx = { soft: 0, firm: 0, hard: 0 };
    const btn = $('#scanBtn'); btn.disabled = true; $('.scan-text', btn).textContent = '▶ 诊断中…';
    state.ecg.mode = 'scan'; $('#vNum').textContent = '??'; $('#vLv').textContent = 'SCANNING'; $('#vNum').style.color = '#ffd84d';
    if (innerWidth < 900) $('.report-panel').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const pre = E.analyze(text, state.role, 0);
    const useAI = AI.enabled();
    const aiP = useAI ? aiAnalyze(text, state.role).catch((err) => { console.warn(err); toast('大模型调用失败，已切换本地引擎'); return null; }) : Promise.resolve(null);
    await Promise.all([scanAnim(pre, useAI, aiP), aiP]);
    const r = (await aiP) || pre;
    state.result = r;
    render(r);
    saveHist(r);
    btn.disabled = false; $('.scan-text', btn).textContent = '▶ 再诊一句'; busy = false;
  }

  async function scanAnim(pre, useAI, aiP) {
    const report = $('#report');
    report.innerHTML = `<div class="scanning"><canvas width="16" height="16" class="bot" id="bot" aria-hidden="true" style="width:96px;height:96px;align-self:center"></canvas><pre class="scan-log" id="scanLog"></pre><div class="scan-bar" id="scanBar">${'<i></i>'.repeat(30)}</div></div>`;
    bot.eye = PAL.Y; bot.mouth = PAL.Y; botLoop();
    const log = $('#scanLog'), bars = [...$('#scanBar').children];
    const id = Math.random().toString(16).slice(2, 6).toUpperCase();
    const t = pre.tags;
    const lines = [
      [`> 载入病例 #${id} · 来源：${E.ROLES[state.role].label}`, 'OK'],
      ['> 解析语义层 / 语气 / 标点', 'OK'],
      ...t.slice(0, 3).map((x) => [`> 检测「${x.name}」浓度`, x.percent + '%', x.percent > 40 ? 'bad' : 'warn']),
      ['> 比对黑话词典', pre.jargon.length ? pre.jargon.length + ' 处命中' : '未命中'],
      [useAI ? '> 呼叫大模型会诊' : '> 本地引擎生成回复处方', useAI ? '…' : 'OK'],
    ];
    let html = '';
    for (let i = 0; i < lines.length; i++) {
      const [a, b, cls] = lines[i];
      html += `${esc(a)} ${'.'.repeat(Math.max(2, 26 - a.length))} <span class="${cls || ''}">${esc(b)}</span>\n`;
      log.innerHTML = html + '<span class="cursor"></span>';
      const upto = Math.round(((i + 1) / lines.length) * 30);
      bars.forEach((b, j) => b.classList.toggle('on', j < upto));
      await sleep(260);
    }
    if (useAI) {
      let k = 0; let fin = false; aiP.then(() => { fin = true; });
      while (!fin) { k++; log.innerHTML = html.replace(/…\n$/, '.'.repeat(k % 4) + '\n') + '<span class="cursor"></span>'; await sleep(300); if (reduce) await new Promise((r) => setTimeout(r, 300)); }
    }
    await sleep(200);
  }

  function render(r) {
    state.ecg.mode = 'result'; state.ecg.score = r.score; state.ecg.color = r.levelColor;
    const vNum = $('#vNum'); vNum.style.color = r.levelColor; $('#vLv').textContent = r.level + ' ' + r.levelName; $('#vLv').style.color = r.levelColor;
    countUp(vNum, r.score);
    const segOn = Math.round(r.score / 5);
    const segColor = (i) => (i < 6 ? '#3dff9a' : i < 10 ? '#7cf3ff' : i < 13 ? '#ffd84d' : i < 16 ? '#ff8a3d' : '#ff3d5f');
    const lvl = [
      { k: 'soft', name: '太极推手', lv: 'LV.1', c: '#3dff9a', n: 1, d: '温和 · 不伤和气' },
      { k: 'firm', name: '有理有据', lv: 'LV.2', c: '#ffd84d', n: 2, d: '划清边界 · 讲规则' },
      { k: 'hard', name: '体面反杀', lv: 'LV.3', c: '#ff3d9a', n: 3, d: '硬核 · 但不失体面' },
    ];
    let delay = 0; const d = () => `style="animation-delay:${(delay += 0.12).toFixed(2)}s"`;
    const html = `
      <div class="sec" ${d()}>
        <div class="summary">
          <div class="lv-badge" style="background:${r.levelColor};box-shadow:0 0 24px ${r.levelColor}55"><span class="lv">${r.level}</span><span class="nm">${esc(r.levelName)}</span></div>
          <div class="sum-text"><p class="big">真实意图：${esc(r.summary)}</p><p class="desc">${esc(r.levelDesc)} · 施压来源：${esc(r.role)}</p></div>
          <div class="segbar" aria-label="PUA 指数 ${r.score}">${Array.from({ length: 20 }, (_, i) => `<i class="${i < segOn ? 'on' : ''}" style="${i < segOn ? `background:${segColor(i)};animation-delay:${(0.3 + i * 0.04).toFixed(2)}s;box-shadow:0 0 6px ${segColor(i)}` : ''}"></i>`).join('')}</div>
        </div>
      </div>
      ${r.tags.length ? `<div class="sec" ${d()}><h3 class="sec-title">▌成分分析 COMPOSITION</h3><div class="tags">${r.tags.map((t) => `
        <div class="tag-row"><span class="tag-name">${t.emoji} ${esc(t.name)}</span><span class="tag-bar"><i data-w="${t.percent}" style="background:${t.color};box-shadow:0 0 10px ${t.color}"></i></span><span class="tag-pct">${t.percent}%</span></div>`).join('')}</div></div>` : ''}
      <div class="sec" ${d()}><h3 class="sec-title">▌潜台词拆解 DECODE</h3><div class="bd">${r.breakdown.map((b) => `
        <div class="bd-item" style="border-left-color:${b.color}">
          <span class="bd-tag" style="background:${b.color}">#${esc(b.tag)}</span>
          <p class="bd-quote">${esc(b.quote)}</p>
          <p class="bd-sub" data-text="${esc(b.subtext)}"></p>
        </div>`).join('')}</div>
        <p class="bd-intent"><b>INTENT</b>${esc(r.summary)}</p>
      </div>
      ${r.jargon && r.jargon.length ? `<div class="sec" ${d()}><h3 class="sec-title">▌黑话词典 JARGON · 命中 ${r.jargon.length} 处</h3><div class="jargon">${r.jargon.map((j) => `<div class="jg"><b>「${esc(j.word)}」</b><span>${esc(j.meaning)}</span></div>`).join('')}</div></div>` : ''}
      <div class="sec" ${d()}><h3 class="sec-title">▌回复处方 PRESCRIPTION · 按硬气程度</h3><div class="replies">${lvl.map((l) => `
        <article class="rp" style="--rc:${l.c}" data-k="${l.k}">
          <div class="rp-head"><span class="rp-name">${l.name}</span><span class="rp-lv">${l.lv}</span></div>
          <div class="rp-meter"><span>硬气</span>${[1, 2, 3].map((i) => `<i class="${i <= l.n ? 'on' : ''}"></i>`).join('')}</div><p class="rp-desc">${l.d}</p>
          <p class="rp-text">${esc(r.replies[l.k])}</p>
          <div class="rp-actions"><button type="button" data-act="copy">复制</button><button type="button" data-act="swap">换一句 »</button></div>
        </article>`).join('')}</div></div>
      <div class="sec" ${d()}>
        <div class="advice"><span class="rx" aria-hidden="true">℞</span><p><small>医嘱 · DOCTOR'S NOTE</small>${esc(r.advice)}</p></div>
        <div class="actions">
          <button class="btn-solid" type="button" id="makeCard">📸 生成诊断书</button>
          <button class="btn-ghost" type="button" id="tagFriend">🔗 @好友会诊</button>
          <button class="btn-ghost" type="button" id="again">🎲 随机病例</button>
        </div>
        <p class="engine-tag">ENGINE · ${r.engine === 'ai' ? '大模型会诊 · ' + esc(AI.get().model) : '本地规则引擎 · 离线'}${r.engine === 'ai' ? '' : ' ｜ 接入大模型可获得更个性化的回复'}</p>
      </div>`;
    const report = $('#report');
    report.innerHTML = html;
    requestAnimationFrame(() => setTimeout(() => report.querySelectorAll('.tag-bar i').forEach((i) => { i.style.width = i.dataset.w + '%'; }), 250));
    typeAll(report.querySelectorAll('.bd-sub'));
    report.querySelectorAll('.rp').forEach((card) => card.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const k = card.dataset.k, p = $('.rp-text', card);
      if (b.dataset.act === 'copy') copy(p.textContent, '已复制，去回复吧 ✊');
      else { p.textContent = nextReply(k); p.animate && !reduce && p.animate([{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'none' }], { duration: 280 }); }
    }));
    $('#makeCard').onclick = makeCard;
    $('#tagFriend').onclick = () => copy(shareText(), '已复制，去 @ 你那个同样被 PUA 的朋友 👀');
    $('#again').onclick = () => { const s = E.SAMPLES[(Math.random() * E.SAMPLES.length) | 0]; $('#input').value = s.text; setRole(s.role); diagnose(); };
  }

  function nextReply(k) {
    const r = state.result;
    if (r.engine === 'ai' && r.aiReplies && r.aiReplies[k].length > 1) {
      state.aiIdx[k] = (state.aiIdx[k] + 1) % r.aiReplies[k].length; r.replies[k] = r.aiReplies[k][state.aiIdx[k]]; return r.replies[k];
    }
    const cur = r.replies[k];
    for (let i = 0; i < 6; i++) { state.nonce[k]++; const v = E.analyze(state.text, state.role, state.nonce[k]).replies[k]; if (v !== cur) { r.replies[k] = v; return v; } }
    return cur;
  }

  async function typeAll(nodes) {
    for (const n of nodes) {
      const t = n.dataset.text;
      if (reduce) { n.textContent = t; continue; }
      const cur = document.createElement('span'); cur.className = 'cursor';
      for (let i = 1; i <= t.length; i++) { n.textContent = t.slice(0, i); n.appendChild(cur); await new Promise((r) => setTimeout(r, 22)); }
      cur.remove();
    }
  }
  function countUp(el, to) {
    if (reduce) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------------- 分享 ---------------- */
  function shareText() {
    const r = state.result;
    return `【赛博诊断室】${r.role}说：“${state.text}”\n诊断：PUA 指数 ${r.score}（${r.levelName}）\n潜台词：${(r.breakdown[0] || {}).subtext || r.summary}\n我的回复：${r.replies.firm}\n快来测测你的 👉 ${location.href.split('#')[0]}\n@ 你那个同样被 PUA 的朋友`;
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    toast(msg || '已复制');
  }
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }

  function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    const chars = [...String(text)]; let line = '', lines = [];
    const noStart = '，。！？、；：”’）》…,.!?;:)';
    for (const ch of chars) { if (ctx.measureText(line + ch).width > maxW && line && !noStart.includes(ch)) { lines.push(line); line = ch; } else line += ch; }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; }
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    return y + lines.length * lh;
  }

  async function makeCard() {
    const r = state.result;
    try { await document.fonts.load('48px "Fusion Pixel 12px Proportional SC"', '诊断书'); } catch (e) {}
    const W = 1080, H = 1440, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#05070b'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(61,255,154,.07)'; c.lineWidth = 1;
    for (let i = 0; i < W; i += 36) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, H); c.stroke(); }
    for (let i = 0; i < H; i += 36) { c.beginPath(); c.moveTo(0, i); c.lineTo(W, i); c.stroke(); }
    // 像素边框
    c.fillStyle = '#3dff9a';
    c.fillRect(36, 30, W - 72, 6); c.fillRect(36, H - 36, W - 72, 6); c.fillRect(30, 36, 6, H - 72); c.fillRect(W - 36, 36, 6, H - 72);
    const F = (s) => `${s}px ${PIX}`;
    c.textBaseline = 'top';
    c.fillStyle = '#3dff9a'; c.font = F(72); c.shadowColor = '#3dff9a'; c.shadowBlur = 18; c.fillText('诊断书', 84, 84); c.shadowBlur = 0;
    c.fillStyle = '#35e0ff'; c.font = F(24); c.fillText('CYBER CLINIC · 反PUA翻译器', 84, 176);
    const no = 'No.' + Math.random().toString(16).slice(2, 8).toUpperCase();
    c.fillStyle = '#5c8b76'; c.fillText(no + '  ' + new Date().toLocaleDateString('zh-CN'), 84, 212);
    drawSprite(c, W - 84 - 160, 70, 10, { eye: r.score > 60 ? PAL.M : PAL.C, mouth: r.score > 60 ? PAL.R : PAL.M });
    // 原话
    c.fillStyle = 'rgba(53,224,255,.08)'; c.fillRect(84, 270, W - 168, 220);
    c.fillStyle = '#35e0ff'; c.fillRect(84, 270, 6, 220);
    c.fillStyle = '#8fc4aa'; c.font = F(24); c.fillText('施压来源：' + r.role + ' ｜ 原话', 112, 292);
    c.fillStyle = '#dcffec'; c.font = F(36); wrap(c, '“' + state.text + '”', 112, 336, W - 240, 48, 3);
    // 指数
    c.fillStyle = '#8fc4aa'; c.font = F(24); c.fillText('PUA 指数', 84, 530);
    c.fillStyle = r.levelColor; c.font = F(168); c.shadowColor = r.levelColor; c.shadowBlur = 30; c.fillText(String(r.score), 78, 560); c.shadowBlur = 0;
    c.fillStyle = r.levelColor; c.fillRect(470, 590, 380, 72);
    c.fillStyle = '#05070b'; c.font = F(48); c.fillText(r.level + ' ' + r.levelName, 490, 602);
    c.fillStyle = '#dcffec'; c.font = F(24);
    wrap(c, r.tags.map((t) => `${t.name} ${t.percent}%`).join(' · ') || '未检出明显套路', 470, 690, W - 560, 34, 2);
    // 分段条
    const seg = Math.round(r.score / 5);
    for (let i = 0; i < 20; i++) { c.fillStyle = i < seg ? (i < 6 ? '#3dff9a' : i < 10 ? '#7cf3ff' : i < 13 ? '#ffd84d' : i < 16 ? '#ff8a3d' : '#ff3d5f') : '#10201b'; c.fillRect(84 + i * 46, 780, 40, 20); }
    // 潜台词
    let y = 840;
    c.fillStyle = '#ff3d9a'; c.font = F(24); c.fillText('▌潜台词', 84, y); y += 44;
    c.fillStyle = '#dcffec'; c.font = F(36);
    y = wrap(c, (r.breakdown[0] || {}).subtext || r.summary, 84, y, W - 168, 50, 3) + 24;
    c.fillStyle = '#ffd84d'; c.font = F(24); c.fillText('▌推荐回复 · 有理有据', 84, y); y += 44;
    c.fillStyle = '#dcffec'; c.font = F(30);
    y = wrap(c, r.replies.firm, 84, y, W - 168, 44, 5) + 24;
    // 医嘱
    c.fillStyle = 'rgba(255,61,154,.12)'; c.fillRect(84, Math.max(y, 1180), W - 168, 90);
    c.fillStyle = '#ff3d9a'; c.font = F(48); c.fillText('℞', 104, Math.max(y, 1180) + 20);
    c.fillStyle = '#dcffec'; c.font = F(30); wrap(c, r.advice, 170, Math.max(y, 1180) + 30, W - 300, 40, 1);
    c.fillStyle = '#5c8b76'; c.font = F(24); c.fillText('输入老板原话 → 一键拆穿潜台词 · 搜「反PUA翻译器」', 84, H - 100);
    const url = cv.toDataURL('image/png');
    $('#shareImg').src = url; $('#dlShare').href = url;
    $('#shareModal').hidden = false; $('#closeShare').focus();
  }
  function initModal() {
    const m = $('#shareModal');
    $('#closeShare').onclick = () => { m.hidden = true; };
    m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') m.hidden = true; });
    $('#copyShare').onclick = () => copy(shareText(), '文案已复制');
  }

  /* ---------------- 启动 ---------------- */
  boot(); rain(); ecg(); botLoop(); initInput(); initModal(); refreshEngine();
  $('#aiBtn').addEventListener('click', () => AI.openSettings({ title: '接入大模型 · 会诊模式', onSave: (on) => { refreshEngine(); toast(on ? '大模型会诊已启用' : '已切回本地引擎'); } }));
  AI.onChange(refreshEngine);
  const q = new URLSearchParams(location.search).get('q');
  if (q) { $('#input').value = q; setTimeout(diagnose, 600); }
})();
