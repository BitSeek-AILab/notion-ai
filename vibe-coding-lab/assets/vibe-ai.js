/*!
 * VibeAI · 可选的大模型引擎（OpenAI 兼容接口）
 * - 默认不启用：所有工具都有本地离线引擎，打开即用
 * - 启用后：API Key 只保存在你自己浏览器的 localStorage，直接请求你填写的接口地址
 * - 样式通过 CSS 变量适配各工具主题：--vai-bg --vai-panel --vai-fg --vai-muted --vai-accent --vai-on-accent --vai-border --vai-font --vai-radius
 */
(function () {
  const KEY = 'vibe-ai-config-v1';
  const PRESETS = [
    { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { name: 'Kimi · Moonshot', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    { name: '通义千问 · 百炼', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    { name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    { name: '硅基流动', base: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
    { name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ];

  function get() {
    try { return Object.assign({ base: '', key: '', model: '', on: false }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return { base: '', key: '', model: '', on: false }; }
  }
  function set(cfg) { localStorage.setItem(KEY, JSON.stringify(cfg)); emit(); }
  function enabled() { const c = get(); return !!(c.on && c.key && c.base && c.model); }
  const listeners = new Set();
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit() { listeners.forEach((fn) => { try { fn(enabled(), get()); } catch (e) {} }); }

  function extractJSON(text) {
    if (!text) throw new Error('模型没有返回内容');
    let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    return JSON.parse(t);
  }

  async function post(c, body, signal) {
    return fetch(c.base.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key },
      body: JSON.stringify(body),
      signal,
    });
  }

  async function chat(messages, opts = {}) {
    const c = get();
    if (!c.key || !c.base || !c.model) throw new Error('还没有配置大模型');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 45000);
    try {
      const body = { model: c.model, messages, temperature: opts.temperature ?? 0.8 };
      if (opts.json) body.response_format = { type: 'json_object' };
      let res = await post(c, body, ctrl.signal);
      // 个别服务不支持 response_format，自动降级重试一次
      if (!res.ok && opts.json && res.status === 400) {
        delete body.response_format;
        res = await post(c, body, ctrl.signal);
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error('接口返回 ' + res.status + (txt ? '：' + txt.slice(0, 160) : ''));
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      return opts.json ? extractJSON(content) : content;
    } finally {
      clearTimeout(timer);
    }
  }

  const CSS = `
  .vai-mask{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;animation:vaiFade .2s ease}
  .vai-box{width:min(520px,100%);max-height:90vh;overflow:auto;background:var(--vai-panel,#141821);color:var(--vai-fg,#eee);border:1px solid var(--vai-border,rgba(255,255,255,.18));border-radius:var(--vai-radius,10px);font-family:var(--vai-font,system-ui,sans-serif);padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
  .vai-box h3{margin:0 0 6px;font-size:20px;color:var(--vai-accent,#5e9fe8)}
  .vai-box p.vai-tip{margin:0 0 18px;font-size:14px;line-height:1.6;color:var(--vai-muted,rgba(255,255,255,.65))}
  .vai-presets{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
  .vai-presets button{font:inherit;font-size:14px;min-height:36px;padding:6px 10px;border-radius:calc(var(--vai-radius,10px)*.6);border:1px solid var(--vai-border,rgba(255,255,255,.2));background:transparent;color:inherit;cursor:pointer}
  .vai-presets button:hover,.vai-presets button.on{border-color:var(--vai-accent,#5e9fe8);color:var(--vai-accent,#5e9fe8)}
  .vai-box label{display:block;font-size:14px;margin:12px 0 6px;color:var(--vai-muted,rgba(255,255,255,.7))}
  .vai-box input[type=text],.vai-box input[type=password]{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:11px 12px;border-radius:calc(var(--vai-radius,10px)*.6);border:1px solid var(--vai-border,rgba(255,255,255,.2));background:var(--vai-bg,#0c0f15);color:inherit;outline:none}
  .vai-box input:focus{border-color:var(--vai-accent,#5e9fe8)}
  .vai-row{display:flex;align-items:center;gap:10px;margin-top:16px;font-size:14px}
  .vai-row input{width:18px;height:18px;accent-color:var(--vai-accent,#5e9fe8)}
  .vai-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}
  .vai-actions button{font:inherit;font-size:15px;min-height:44px;padding:0 18px;border-radius:calc(var(--vai-radius,10px)*.6);border:1px solid var(--vai-border,rgba(255,255,255,.2));background:transparent;color:inherit;cursor:pointer}
  .vai-actions .vai-primary{background:var(--vai-accent,#5e9fe8);border-color:var(--vai-accent,#5e9fe8);color:var(--vai-on-accent,#000)}
  .vai-actions button:focus-visible,.vai-presets button:focus-visible{outline:2px solid var(--vai-accent,#5e9fe8);outline-offset:2px}
  .vai-status{font-size:14px;margin-top:12px;min-height:18px;color:var(--vai-muted,rgba(255,255,255,.65));word-break:break-all}
  @keyframes vaiFade{from{opacity:0}to{opacity:1}}`;

  function injectCSS() {
    if (document.getElementById('vai-css')) return;
    const s = document.createElement('style');
    s.id = 'vai-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

  function openSettings(opts = {}) {
    injectCSS();
    const c = get();
    const mask = document.createElement('div');
    mask.className = 'vai-mask';
    mask.innerHTML = `
      <div class="vai-box" role="dialog" aria-modal="true" aria-labelledby="vai-title">
        <h3 id="vai-title">${esc(opts.title || '接入大模型（可选）')}</h3>
        <p class="vai-tip">${esc(opts.tip || '不配置也能用：内置本地引擎离线运行。填写任意 OpenAI 兼容接口后，结果会更聪明、更个性化。Key 只保存在当前浏览器，不会上传到任何第三方服务器。')}</p>
        <div class="vai-presets">${PRESETS.map((p, i) => `<button type="button" data-i="${i}" class="${c.base === p.base ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>
        <label for="vai-base">接口地址 Base URL</label>
        <input id="vai-base" type="text" placeholder="https://api.deepseek.com/v1" value="${esc(c.base)}" autocomplete="off">
        <label for="vai-model">模型名 Model</label>
        <input id="vai-model" type="text" placeholder="deepseek-chat" value="${esc(c.model)}" autocomplete="off">
        <label for="vai-key">API Key</label>
        <input id="vai-key" type="password" placeholder="sk-..." value="${esc(c.key)}" autocomplete="off">
        <div class="vai-row"><input id="vai-on" type="checkbox" ${c.on ? 'checked' : ''}><label for="vai-on" style="margin:0">启用大模型引擎</label></div>
        <div class="vai-status" id="vai-status" aria-live="polite"></div>
        <div class="vai-actions">
          <button type="button" id="vai-test">测试连接</button>
          <button type="button" id="vai-cancel">取消</button>
          <button type="button" class="vai-primary" id="vai-save">保存</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const $ = (id) => mask.querySelector('#' + id);
    const close = () => { mask.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    mask.querySelectorAll('.vai-presets button').forEach((b) => b.addEventListener('click', () => {
      const p = PRESETS[+b.dataset.i];
      $('vai-base').value = p.base; $('vai-model').value = p.model;
      mask.querySelectorAll('.vai-presets button').forEach((x) => x.classList.toggle('on', x === b));
      $('vai-key').focus();
    }));
    const read = () => ({ base: $('vai-base').value.trim(), model: $('vai-model').value.trim(), key: $('vai-key').value.trim(), on: $('vai-on').checked });
    $('vai-cancel').onclick = close;
    $('vai-save').onclick = () => {
      const v = read();
      if (v.on && (!v.base || !v.model || !v.key)) { $('vai-status').textContent = '启用前请填完整：接口地址、模型名和 Key。'; return; }
      set(v); close(); opts.onSave && opts.onSave(enabled());
    };
    $('vai-test').onclick = async () => {
      const prev = localStorage.getItem(KEY);
      const v = read();
      localStorage.setItem(KEY, JSON.stringify(Object.assign({}, v, { on: true })));
      $('vai-status').textContent = '连接中…';
      try {
        const r = await chat([{ role: 'user', content: '只回复两个字：在线' }], { temperature: 0, timeout: 20000 });
        $('vai-status').textContent = '✅ 连接成功：' + String(r).slice(0, 40);
      } catch (e) {
        $('vai-status').textContent = '❌ ' + (e.name === 'AbortError' ? '请求超时' : e.message) + '（若是跨域 CORS 报错，可换一个服务商或填自建代理地址）';
      } finally {
        if (prev === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, prev);
      }
    };
    setTimeout(() => (c.key ? $('vai-save') : $('vai-base')).focus(), 30);
  }

  window.VibeAI = { get, set, enabled, chat, extractJSON, openSettings, onChange, PRESETS };
})();
