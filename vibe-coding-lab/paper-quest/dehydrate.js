/* 文献脱水引擎：PDF/文本 → 章节关卡 → 核心论点 / 关键词 / 思维导图 / 通关小测（纯本地） */
(function () {
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  const CJK = /[\u3400-\u9fff]/;
  const isCJK = (s) => (s.match(/[\u3400-\u9fff]/g) || []).length > s.length * 0.25;

  // PDF 常见问题：康熙部首/部首补充字符（⼤⽂⻛）、中文之间被插入空格
  const RAD = { '⺠': '民', '⺟': '母', '⺮': '竹', '⺶': '羊', '⺸': '羊', '⺻': '聿', '⻁': '虎', '⻄': '西', '⻅': '见', '⻆': '角', '⻉': '贝', '⻋': '车', '⻓': '长', '⻔': '门', '⻘': '青', '⻙': '韦', '⻚': '页', '⻛': '风', '⻜': '飞', '⻝': '食', '⻢': '马', '⻣': '骨', '⻤': '鬼', '⻥': '鱼', '⻦': '鸟', '⻧': '卤', '⻨': '麦', '⻩': '黄', '⻬': '齐', '⻮': '齿', '⻰': '龙', '⻳': '龟', '⻊': '足', '⻌': '辶', '⻍': '辶', '⻎': '辶', '⻏': '阝', '⻖': '阝', '⺁': '厂', '⺅': '亻', '⺈': '⺈', '⺊': '卜', '⺌': '小', '⺍': '小', '⺗': '心', '⺝': '月', '⺩': '王', '⺧': '牛', '⺪': '疋', '⺫': '罒', '⺬': '示', '⺯': '糸', '⺰': '纟', '⺴': '网', '⺺': '肀', '⺾': '艹', '⻊': '足', '⻑': '長', '⻒': '镸', '⻗': '雨', '⻢': '马' };
  const CJKP = '\\u2e80-\\u9fff\\u3000-\\u303f\\uff00-\\uffef“”‘’';
  const RE_SP_CJK = new RegExp('([' + CJKP + '])[ \\t]+(?=[' + CJKP + '])', 'g');
  function normText(t) {
    t = String(t || '').replace(/[\u2f00-\u2fdf\uf900-\ufaff]/g, (c) => c.normalize('NFKC')).replace(/[\u2e80-\u2eff]/g, (c) => RAD[c] || c);
    return t.replace(RE_SP_CJK, '$1').replace(/[ \t]+(?=[，。、；：！？）」』”])/g, '').replace(/([（「『“])[ \t]+/g, '$1');
  }

  const SECTION_NAMES = /^(abstract|introduction|background|related works?|literature review|preliminar(y|ies)|methods?|methodology|approach|materials and methods|model|framework|experiments?|experimental (setup|results)|evaluation|results?( and discussion)?|analysis|discussion|conclusions?( and future work)?|limitations?|future work|summary|摘要|关键词|引言|前言|绪论|导论|背景|研究背景|相关工作|相关研究|文献综述|理论基础|研究方法|方法|模型|实验|实验设计|实验结果|结果|结果与分析|结果与讨论|分析|讨论|结论|总结|结语|展望|结论与展望)$/i;
  const STOP_SECTION = /^(references?|bibliography|acknowledge?ments?|参考文献|致谢|附录|appendix)/i;
  const NUM_HEAD = /^((?:第[一二三四五六七八九十百零\d]+[章节篇部分])|(?:[一二三四五六七八九十]+[、.．])|(?:（[一二三四五六七八九十]+）)|(?:\d{1,2}(?:\.\d{1,2}){0,2}[.、．]?))\s*(.{1,40})$/;

  /* ---------- PDF 解析 ---------- */
  let pdfReady = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfReady) return pdfReady;
    pdfReady = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = () => rej(new Error('PDF 解析库加载失败，请检查网络'));
      document.head.appendChild(s);
    });
    return pdfReady;
  }

  async function pdfToText(buf, onProgress) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: buf, cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/', cMapPacked: true, standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/' }).promise;
    const maxPages = Math.min(doc.numPages, 80);
    const pages = [];
    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const lines = [];
      let cur = null;
      for (const it of tc.items) {
        if (!('str' in it)) continue;
        const y = Math.round(it.transform[5]);
        const size = Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10 || it.height || 10;
        if (!cur || Math.abs(y - cur.y) > Math.max(2, size * 0.45)) {
          if (cur && cur.text.trim()) lines.push(cur);
          cur = { y, size, text: '', x: it.transform[4] };
        }
        const prev = cur.text.slice(-1);
        if (cur.text && it.str && !CJK.test(prev) && !CJK.test(it.str[0]) && prev !== ' ' && it.str[0] !== ' ' && prev !== '-') cur.text += ' ';
        cur.text += it.str;
        cur.size = Math.max(cur.size, size);
        if (it.hasEOL) { if (cur.text.trim()) lines.push(cur); cur = null; }
      }
      if (cur && cur.text.trim()) lines.push(cur);
      pages.push(lines);
      onProgress && onProgress(p, maxPages);
    }
    // 正文字号 = 按字符数加权的众数
    const hist = {};
    pages.flat().forEach((l) => { const k = Math.round(l.size); hist[k] = (hist[k] || 0) + l.text.length; });
    const body = +Object.entries(hist).sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
    // 去掉每页重复的页眉页脚
    const freq = {};
    pages.forEach((ls) => new Set(ls.map((l) => l.text.trim())).forEach((t) => { freq[t] = (freq[t] || 0) + 1; }));
    let title = '';
    const out = [];
    pages.forEach((ls, pi) => {
      let lastBig = null;
      ls.forEach((l) => {
        const raw = l.text.replace(/\s+/g, ' ').trim();
        if (!raw || /^\d{1,4}$/.test(raw) || (freq[raw] >= 3 && pages.length >= 4)) { lastBig = null; return; }
        const t = normText(raw);
        const big = l.size >= body * 1.12 && t.length <= 80 && !/[.。,，;；]$/.test(t);
        if (big && lastBig && Math.abs(lastBig.size - l.size) < 0.6 && lastBig.size >= body * 1.3 && lastBig.text.length + t.length < 140) {
          // 跨行大标题合并
          const glue = CJK.test(lastBig.text.slice(-1)) || CJK.test(t[0]) ? '' : ' ';
          lastBig.text += glue + t; out[lastBig.k] = '\n## ' + lastBig.text + '\n';
          if (lastBig.isTitle) title = lastBig.text;
          return;
        }
        if (big) {
          const isTitle = pi === 0 && !title && l.size >= body * 1.3 && t.length > 4 && t.length < 120;
          if (isTitle) title = t;
          lastBig = { size: l.size, text: t, k: out.length, isTitle };
          out.push('\n## ' + t + '\n');
        } else { lastBig = null; out.push(t); }
      });
      out.push('');
    });
    return { text: out.join('\n'), title, pages: doc.numPages };
  }

  /* ---------- 文本 → 章节 ---------- */
  function classify(line) {
    const t = line.trim();
    if (!t || t.length > 64) return null;
    let m = t.match(/^(#{1,4})\s+(.+)$/);
    if (m) {
      const inner = m[2].trim();
      if (STOP_SECTION.test(inner.replace(/^[\d.\s、．]+/, ''))) return { title: inner, depth: 1, stop: true, strong: true };
      const n = inner.match(NUM_HEAD);
      const depth = n && /^\d/.test(n[1]) ? n[1].replace(/[.、．]$/, '').split('.').length : SECTION_NAMES.test(inner.replace(/[:：]$/, '')) ? 1 : m[1].length;
      return { title: inner, depth: Math.min(depth, 3), strong: true };
    }
    const bare = t.replace(/^[\d.\s、．]+/, '').replace(/[:：]$/, '');
    if (SECTION_NAMES.test(bare) || SECTION_NAMES.test(t)) return { title: t.replace(/[:：]$/, ''), depth: /^\d+\.\d/.test(t) ? 2 : 1, strong: true };
    if (STOP_SECTION.test(bare)) return { title: t, depth: 1, stop: true, strong: true };
    m = t.match(NUM_HEAD);
    if (m) {
      const body = m[2].trim();
      if (/[.。,，;；:：!?！？]$/.test(body)) return null;
      if (!isCJK(body) && body.split(/\s+/).length > 9) return null;
      if (isCJK(body) && body.length > 24) return null;
      if (/^\d/.test(body) || body.length < 2) return null;
      const depth = /^\d/.test(m[1]) ? m[1].replace(/[.、．]$/, '').split('.').length : /^（/.test(m[1]) ? 2 : 1;
      return { title: t, depth, strong: false };
    }
    return null;
  }

  function joinLines(lines) {
    let out = '';
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) { out += '\n\n'; continue; }
      if (!out || out.endsWith('\n')) { out += l; continue; }
      const a = out.slice(-1), b = l[0];
      if (a === '-' && /[a-z]/i.test(b)) out = out.slice(0, -1) + l;
      else if (CJK.test(a) || CJK.test(b) || /[，。、；：！？“”（）]/.test(a)) out += l;
      else out += ' ' + l;
    }
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  function splitSections(raw, fallbackTitle) {
    const text = normText(String(raw || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' '));
    const lines = [];
    text.split('\n').forEach((l) => {
      const m = l.match(/^\s*(?:#{1,4}\s*)?(摘\s*要|内容提要|abstract)\s*[:：.—–-]\s*(\S.{8,})$/i);
      if (m) { lines.push('## ' + m[1].replace(/\s/g, '')); lines.push(m[2]); } else lines.push(l);
    });
    let title = '';
    const heads = [];
    lines.forEach((l, i) => { const c = classify(l); if (c) heads.push({ i, ...c }); });
    // 文档标题：第一个非空行（若不是章节名）
    const firstIdx = lines.findIndex((l) => l.trim());
    if (firstIdx >= 0) {
      const fl = lines[firstIdx].trim().replace(/^#+\s*/, '');
      const fc = classify(lines[firstIdx]);
      if (fl.length <= 80 && (!fc || (fc.strong && !SECTION_NAMES.test(fl) && heads.length > 2 && heads[0].i === firstIdx))) {
        title = fl;
        if (heads.length && heads[0].i === firstIdx) heads.shift();
      }
    }
    // 选择合适的标题层级，使关卡数落在 3~14
    let chosen = [];
    for (const maxDepth of [1, 2, 3]) {
      chosen = heads.filter((h) => h.depth <= maxDepth || h.stop);
      const n = chosen.filter((h) => !h.stop).length;
      if (n >= 3) break;
    }
    if (chosen.filter((h) => h.strong).length >= 3) chosen = chosen.filter((h) => h.strong || h.depth === 1);
    let sections = [];
    if (chosen.filter((h) => !h.stop).length >= 2) {
      const pre = lines.slice(firstIdx + (title ? 1 : 0), chosen[0].i);
      if (joinLines(pre).length > 120) sections.push({ title: '开篇', text: joinLines(pre) });
      for (let k = 0; k < chosen.length; k++) {
        const h = chosen[k];
        if (h.stop) break;
        const end = k + 1 < chosen.length ? chosen[k + 1].i : lines.length;
        const body = lines.slice(h.i + 1, end).filter((l) => !(classify(l) || {}).stop);
        sections.push({ title: h.title.replace(/^#+\s*/, '').trim(), text: joinLines(body) });
      }
    } else {
      // 无章节结构：按段落切块
      let stopAt = lines.findIndex((l) => (classify(l) || {}).stop);
      const body = joinLines(lines.slice(firstIdx + (title ? 1 : 0), stopAt > 0 ? stopAt : lines.length));
      const paras = body.split(/\n\n+/).filter(Boolean);
      const total = body.length;
      const target = Math.max(600, Math.min(2200, total / Math.min(10, Math.max(3, Math.round(total / 1500)))));
      let buf = '';
      paras.forEach((p) => { buf += (buf ? '\n\n' : '') + p; if (buf.length >= target) { sections.push({ title: '', text: buf }); buf = ''; } });
      if (buf) { if (sections.length && buf.length < target * 0.4) sections[sections.length - 1].text += '\n\n' + buf; else sections.push({ title: '', text: buf }); }
      if (sections.length === 1 && paras.length === 1) {
        // 单段长文：按句子切
        const sents = splitSentences(body);
        sections = []; buf = '';
        sents.forEach((s) => { buf += s; if (buf.length >= target) { sections.push({ title: '', text: buf }); buf = ''; } });
        if (buf) sections.push({ title: '', text: buf });
      }
    }
    // 合并过短、拆分过长
    const merged = [];
    const avgLen = sections.reduce((a, s) => a + s.text.length, 0) / Math.max(1, sections.length);
    sections.forEach((s) => {
      const prev = merged[merged.length - 1];
      if (prev && prev.text.length < Math.min(isCJK(prev.text) ? 80 : 160, avgLen * 0.5)) { prev.text = (prev.text ? prev.text + '\n\n' : '') + s.text; prev.title = prev.title ? prev.title + ' · ' + s.title : s.title; }
      else merged.push({ ...s });
    });
    const final = [];
    merged.forEach((s) => {
      if (s.text.length <= 5200) { final.push(s); return; }
      const paras = s.text.split(/\n\n+/);
      const parts = Math.ceil(s.text.length / 4000);
      const per = s.text.length / parts;
      let buf = '', k = 1;
      paras.forEach((p) => { buf += (buf ? '\n\n' : '') + p; if (buf.length >= per && k < parts) { final.push({ title: (s.title || '') + `（${k}）`, text: buf }); buf = ''; k++; } });
      if (buf) final.push({ title: (s.title || '') + (k > 1 ? `（${k}）` : ''), text: buf });
    });
    while (final.length > 16) {
      let bi = 0, bl = Infinity;
      for (let i = 0; i < final.length - 1; i++) { const l = final[i].text.length + final[i + 1].text.length; if (l < bl) { bl = l; bi = i; } }
      final.splice(bi, 2, { title: final[bi].title + ' · ' + final[bi + 1].title, text: final[bi].text + '\n\n' + final[bi + 1].text });
    }
    const cleaned = final.filter((s) => s.text.replace(/\s/g, '').length > 40);
    return { title: title || fallbackTitle || '未命名文献', sections: cleaned };
  }

  /* ---------- 分句 / 分词 ---------- */
  function splitSentences(text) {
    const protectedText = text
      .replace(/\b(e\.g|i\.e|et al|etc|Fig|Figs|Eq|Eqs|vs|cf|Dr|Mr|Ms|No|Sec|Tab)\./gi, (m) => m.replace(/\./g, '§'))
      .replace(/(\d)\.(\d)/g, '$1§$2');
    const parts = protectedText.split(/(?<=[。！？!?；])|(?<=[.])\s+(?=[A-Z“"(\[])|\n+/);
    return parts.map((s) => s.replace(/§/g, '.').trim()).filter((s) => s.replace(/[\s\p{P}]/gu, '').length >= 6);
  }

  const EN_STOP = new Set(('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how however i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves using used use based show shows shown paper propose proposed approach method methods results result study studies work works new also may might one two three first second however thus therefore et al fig figure table section data model models different various well within without across among many much each per via can also each between since given such rather although though whether yet still often even either neither instead despite around roughly percent less did not about after before both than').split(' '));
  const ZH_STOP = '的了是在和与及或而也都就将把被对从以于为之其这那一个中上下等并且但如所我们你他她它有没不很更最能会可要到说让给地得着过还又每该此即则因由至用使种些各已再如果因为所以通过进行可以我们他们这些那些这种一种以及其中对于由于虽然但是而且或者并且然后之后之前时候问题方面方式情况内容需要可能出现提高认为表明发现研究本文我们'.split('');
  const ZH_STOP_SET = new Set(ZH_STOP);
  const ZH_BAD_WORD = new Set(['我们', '他们', '这些', '那些', '这种', '一种', '以及', '其中', '对于', '由于', '虽然', '但是', '而且', '或者', '并且', '然后', '之后', '之前', '时候', '因此', '所以', '如果', '因为', '通过', '进行', '可以', '本文', '一个', '没有', '什么', '这样', '那样', '已经', '还是', '就是', '不是', '这个', '那个', '一些', '自己', '例如', '比如', '需要', '能够', '同样', '真正', '往往', '其实', '另外', '此外', '同时', '最后', '首先', '其次', '第一', '第二', '第三', '第四', '之所以', '是因为']);

  const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;
  ['意味着', '意味', '必须', '生成', '完成', '逐渐', '几天', '最初', '随后', '通常', '普遍', '共同', '不同', '一定', '一次', '每次', '每一', '简单', '主要', '重要', '有效', '更好', '越来越', '很多', '大量', '许多', '只是', '只有', '甚至', '不仅', '当下', '日后', '时间', '基于', '上述', '属于', '对应', '选择', '包括', '利用', '采用', '具有', '相关', '一定', '实现', '成为', '作为', '为了', '关于', '根据', '之间', '以上', '以下', '目前', '现在', '已经', '开始', '得到', '看到', '提出', '这一', '那么', '怎么', '如何', '为什么', '可以', '一起', '常见', '某些', '所有', '任何', '每个', '一样', '非常', '比较', '容易', '方法', '结果', '证据', '过程', '能力', '程度', '部分', '问题', '情况', '方面', '方式', '内容', '需要', '可能', '出现', '提高', '认为', '表明', '发现', '研究', '本文', '来说', '而言', '例如', '比如', '一步', '第一步', '第二步', '第三步', '第四步', '最后', '同时', '此外', '另外', '因此', '所以', '然而', '但是', '其中', '而不是', '不是', '未来', '一周', '一节', '一句', '一篇', '一关', '一段', '一下', '读完', '之所以', '在于', '是否', '能否', '究竟', '哪些', '多少', '两个', '其他', '更加', '明显', '显著', '分别', '平均', '超过', '至少', '大约', '约为', '达到', '以来', '随着', '难以', '就是说', '也就是', '试图', '回答', '尝试', '针对', '对比', '基础', '形成', '提供', '产生', '导致', '带来', '应当', '应该', '不能', '无法', '一项', '一名', '名受访者'].forEach((w) => ZH_BAD_WORD.add(w));

  function zhNgrams(text) {
    const out = [];
    const runs = text.match(/[\u3400-\u9fff]+/g) || [];
    for (const run of runs) {
      for (let n = 2; n <= 4; n++) {
        for (let i = 0; i + n <= run.length; i++) {
          const g = run.slice(i, i + n);
          if (ZH_STOP_SET.has(g[0]) || ZH_STOP_SET.has(g[g.length - 1]) || ZH_BAD_WORD.has(g)) continue;
          out.push(g);
        }
      }
    }
    return out;
  }
  // 词典分词（Intl.Segmenter）+ 复合术语（如“提取+练习”“遗忘+曲线”）+ 单字连写（人名/译名）
  function zhTerms(text) {
    if (!SEG) return zhNgrams(text);
    const out = [];
    for (const run of text.match(/[\u3400-\u9fff]+/g) || []) {
      const toks = [];
      let buf = '';
      for (const { segment: w } of SEG.segment(run)) {
        if (w.length === 1 && !ZH_STOP_SET.has(w)) { buf += w; continue; }
        if (buf) { toks.push(buf); buf = ''; }
        toks.push(w);
      }
      if (buf) toks.push(buf);
      const ok = (t) => t && t.length >= 2 && !ZH_BAD_WORD.has(t);
      for (let i = 0; i < toks.length; i++) {
        const a = toks[i];
        if (!ok(a)) continue;
        out.push(a);
        const b = toks[i + 1];
        if (ok(b) && a.length + b.length <= 6) out.push(a + b);
      }
    }
    return out;
  }
  function enTerms(text) {
    const words = (text.toLowerCase().match(/[a-z](?:[a-z\-]*[a-z])?/g) || []);
    const out = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (EN_STOP.has(w) || w.length < 3) continue;
      out.push(w);
      const nx = words[i + 1];
      if (nx && !EN_STOP.has(nx) && nx.length >= 3) out.push(w + ' ' + nx);
    }
    return out;
  }
  const termsOf = (t) => zhTerms(t).concat(enTerms(t));

  function count(arr) { const m = new Map(); arr.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return m; }

  /* ---------- 关键词 ---------- */
  function keywordModel(sections) {
    const docCounts = new Map();
    const BADK = /^第[一二三四五六七八九十百零\d]+[章节篇部]?|^[一二三四五六七八九十百零]+$|小时|分钟|^\d/;
    const secCounts = sections.map((s) => { const c = count(termsOf(s.title + '。' + s.text).filter((k) => !BADK.test(k))); c.forEach((v, k) => docCounts.set(k, (docCounts.get(k) || 0) + v)); return c; });
    // 删除被更长词“吞并”的子串（如“注意力机”≈“注意力机制”）
    const keys = [...docCounts.keys()].filter((k) => docCounts.get(k) >= 2);
    const keep = new Set(keys);
    const byLen = keys.slice().sort((a, b) => b.length - a.length);
    for (const long of byLen) {
      if (!keep.has(long) || /\s/.test(long)) continue;
      const lc = docCounts.get(long);
      for (let n = 2; n < long.length; n++) {
        for (let i = 0; i + n <= long.length; i++) {
          const sub = long.slice(i, i + n);
          if (keep.has(sub) && docCounts.get(sub) <= lc * 1.25) keep.delete(sub);
        }
      }
      // 太长的 n-gram 若只出现 2 次，多半是短语碎片
      if (long.length >= 5 && lc < 3) keep.delete(long);
    }
    const df = new Map();
    secCounts.forEach((c) => c.forEach((_, k) => { if (keep.has(k)) df.set(k, (df.get(k) || 0) + 1); }));
    const N = sections.length;
    const idf = (k) => Math.log(1 + N / (df.get(k) || 1));
    const lenBonus = (k) => (/\s/.test(k) ? 1.35 : k.length >= 3 ? (CJK.test(k) ? 1.3 : 1.1) : 1);
    const secKeywords = secCounts.map((c, si) => {
      const sc = [];
      c.forEach((v, k) => { if (keep.has(k) && (v >= 2 || sections[si].title.includes(k))) sc.push([k, v * idf(k) * lenBonus(k) * (sections[si].title.toLowerCase().includes(k) ? 1.6 : 1)]); });
      sc.sort((a, b) => b[1] - a[1]);
      const picked = [];
      for (const [k, w] of sc) {
        if (picked.some((p) => p.k.includes(k) || k.includes(p.k))) continue;
        picked.push({ k, w });
        if (picked.length >= 8) break;
      }
      // 短章节兜底：放宽到只出现一次的术语
      if (picked.length < 4) {
        const extra = [];
        c.forEach((v, k) => { if (v < 2 && !/^\d/.test(k) && (keep.has(k) || (CJK.test(k) ? k.length >= 3 : k.length >= 6))) extra.push([k, (keep.has(k) ? 2 : 1) * idf(k) * lenBonus(k) * Math.log(1 + (docCounts.get(k) || 1))]); });
        extra.sort((a, b) => b[1] - a[1]);
        for (const [k, w] of extra) {
          if (picked.length >= 4) break;
          if (picked.some((p) => p.k.includes(k) || k.includes(p.k))) continue;
          picked.push({ k, w: w * 0.5 });
        }
      }
      return picked;
    });
    const global = [];
    docCounts.forEach((v, k) => { if (keep.has(k) && v >= 3) global.push({ k, w: v * Math.log(1 + (df.get(k) || 1)) * lenBonus(k) }); });
    global.sort((a, b) => b.w - a.w);
    const gPicked = [];
    for (const g of global) { if (gPicked.some((p) => p.k.includes(g.k) || g.k.includes(p.k))) continue; gPicked.push(g); if (gPicked.length >= 14) break; }
    return { secKeywords, global: gPicked, docCounts };
  }

  /* ---------- 核心论点 ---------- */
  const CUE = /本文|我们提出|提出了|研究发现|结果表明|表明|发现|证明|核心|关键在于|关键|因此|总之|综上|意味着|结论|指出|主要|最有效|显著|we propose|we present|this paper|our results|we find|we show|results show|demonstrate|suggest|conclude|key|significant|in summary|therefore|thus/i;
  function jaccard(a, b) { const A = new Set(a), B = new Set(b); let i = 0; A.forEach((x) => { if (B.has(x)) i++; }); return i / (A.size + B.size - i || 1); }

  function keyPoints(sec, kws, globalKw) {
    const sents = splitSentences(sec.text);
    const w = new Map(); kws.forEach((x, i) => w.set(x.k, 1.6 - i * 0.12)); globalKw.forEach((x) => { if (!w.has(x.k)) w.set(x.k, 0.5); });
    const scored = sents.map((s, i) => {
      const zh = isCJK(s);
      const len = zh ? s.length : s.split(/\s+/).length;
      let sc = 0;
      w.forEach((v, k) => { if (s.toLowerCase().includes(k)) sc += v; });
      sc = sc / Math.sqrt(Math.max(4, zh ? len / 4 : len / 2));
      if (CUE.test(s)) sc += 0.45;
      if (i === 0) sc += 0.3; else if (i === 1) sc += 0.12;
      if (i === sents.length - 1 && sents.length > 3) sc += 0.15;
      if (zh ? (len < 14 || len > 150) : (len < 7 || len > 60)) sc *= 0.45;
      if (/\[\d|\(\d{4}\)|et al|图\s*\d|表\s*\d|Fig|Table|http/i.test(s)) sc *= 0.7;
      if ((s.match(/\d/g) || []).length > 8) sc *= 0.7;
      return { s, i, sc, toks: termsOf(s) };
    });
    const k = Math.max(2, Math.min(4, Math.round(sents.length / 3)));
    const picked = [];
    const pool = scored.slice().sort((a, b) => b.sc - a.sc);
    while (picked.length < k && pool.length) {
      let best = null, bv = -Infinity;
      for (const c of pool.slice(0, 12)) {
        const red = picked.length ? Math.max(...picked.map((p) => jaccard(p.toks, c.toks))) : 0;
        const v = c.sc - red * 1.2;
        if (v > bv) { bv = v; best = c; }
      }
      picked.push(best); pool.splice(pool.indexOf(best), 1);
    }
    picked.sort((a, b) => a.i - b.i);
    return { points: picked.map((p) => trimSentence(p.s)), sentences: sents, keyIdx: picked.map((p) => p.i) };
  }
  function trimSentence(s) {
    s = s.replace(/^[（(]?\d+[)）.、]\s*/, '').replace(/^(首先|其次|此外|另外|同时|因此|所以|总之|然而|但是)[，,]/, '').trim();
    if (isCJK(s) && s.length > 96) { const cut = s.slice(0, 92); const p = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf('；')); s = (p > 40 ? cut.slice(0, p) : cut) + '…'; }
    if (!isCJK(s) && s.length > 280) s = s.slice(0, 270).replace(/\s\S*$/, '') + '…';
    return s;
  }

  /* ---------- 思维导图 & 小测 ---------- */
  function shortTitle(t, i) {
    const s = String(t || '').replace(/^#+\s*/, '').replace(/^((第[一二三四五六七八九十百\d]+[章节篇部分])|([一二三四五六七八九十]+[、.．])|(\d+(\.\d+)*[.、．]?))\s*/, '').trim();
    return s || `第 ${i + 1} 段`;
  }
  function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function mindmap(sec, kws, sentences) {
    const used = new Set();
    const clauses = [];
    sentences.forEach((st) => {
      const t = st.replace(/[。.!！?？]+$/, '');
      (isCJK(t) ? t.split(/[，,；;：:]/) : [t]).forEach((c) => { c = c.trim(); if (c.length >= 4) clauses.push(c); });
    });
    const branches = kws.slice(0, 5).map((x) => {
      const k = x.k;
      const hits = clauses.filter((c) => c.toLowerCase().includes(k));
      const score = (c) => (used.has(c) ? 100 : 0) + (isCJK(c) ? Math.abs(c.length - 14) : Math.abs(c.length - 50) / 4) + (c.replace(k, '').length < 3 ? 50 : 0);
      hits.sort((a, b) => score(a) - score(b));
      let leaf = '';
      if (hits[0]) { used.add(hits[0]); leaf = leafText(hits[0], k); }
      return { name: k, children: leaf ? [leaf] : [] };
    });
    // 去重：重复叶子只保留第一次
    const seen = new Set();
    branches.forEach((b) => { if (b.children[0] && seen.has(b.children[0])) b.children = []; else if (b.children[0]) seen.add(b.children[0]); });
    return { center: sec.short, branches };
  }
  function leafText(s, k) {
    s = s.replace(/[。.!！?？；;]+$/, '').trim();
    if (isCJK(s)) {
      if (s.length <= 22) return s;
      const idx = s.indexOf(k);
      if (idx < 0) return clip(s, 22);
      const st = Math.max(0, Math.min(idx - 6, s.length - 21));
      return (st > 0 ? '…' : '') + clip(s.slice(st), 21);
    }
    return clip(s, 60);
  }

  function shuffle(a, seed) { let x = seed || 1; const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function makeQuiz(si, secs) {
    const sec = secs[si];
    const allKw = secs.flatMap((s, i) => s.keywords.map((k) => ({ k, i })));
    const cands = [];
    sec.points.forEach((p) => sec.keywords.forEach((k, rank) => { if (p.toLowerCase().includes(k) && p.length - k.length > 8) cands.push({ p, k, rank }); }));
    cands.sort((a, b) => a.rank - b.rank);
    for (const c of cands) {
      const zh = isCJK(c.k);
      const dis = allKw.filter((x) => x.k !== c.k && !c.k.includes(x.k) && !x.k.includes(c.k) && isCJK(x.k) === zh && !c.p.toLowerCase().includes(x.k)).map((x) => x.k);
      const uniq = [...new Set(dis)].sort((a, b) => Math.abs(a.length - c.k.length) - Math.abs(b.length - c.k.length));
      if (uniq.length < 3) continue;
      const opts = shuffle([c.k, ...shuffle(uniq.slice(0, 8), si + 7).slice(0, 3)], si * 13 + 5);
      const ek = c.k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(zh ? ek : '\\b' + ek + '(?:e?s)?\\b', 'i');
      return { type: 'blank', question: c.p.replace(re, '＿＿＿＿'), options: opts, answer: opts.indexOf(c.k), explain: c.p };
    }
    // 兜底：哪一句出自本关
    const others = secs.filter((_, i) => i !== si).flatMap((s) => s.points);
    if (others.length >= 3 && sec.points.length) {
      const right = sec.points[0];
      const opts = shuffle([right, ...shuffle(others.slice(), si + 3).slice(0, 3)], si + 11).map((s) => clip(s, 70));
      return { type: 'which', question: '下面哪一句是本关的核心论点？', options: opts, answer: opts.indexOf(clip(right, 70)), explain: right };
    }
    return { type: 'none', question: '', options: [], answer: -1, explain: '' };
  }

  /* ---------- 主流程 ---------- */
  function stats(text) {
    const zh = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const en = (text.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z]+/g) || []).length;
    return { chars: zh + en, minutes: Math.max(1, Math.round(zh / 400 + en / 220)) };
  }

  function build(raw, fallbackTitle) {
    const { title, sections } = splitSections(raw, fallbackTitle);
    if (!sections.length) throw new Error('没有识别到可阅读的正文，换一份文件试试？');
    const model = keywordModel(sections);
    const secs = sections.map((s, i) => {
      const kws = model.secKeywords[i];
      const kp = keyPoints(s, kws, model.global);
      const st = stats(s.text);
      const short = shortTitle(s.title, i) === `第 ${i + 1} 段` && kws[0] ? kws[0].k : shortTitle(s.title, i);
      const sec = { idx: i, title: s.title || short, short: clip(short, 14), text: s.text, keywords: kws.map((x) => x.k).slice(0, 6), points: kp.points, sentences: kp.sentences, keyIdx: kp.keyIdx, chars: st.chars, minutes: st.minutes };
      const pc = stats(sec.points.join('')).chars;
      sec.dry = Math.max(0, Math.min(99, Math.round((1 - pc / Math.max(1, st.chars)) * 100)));
      sec.mind = mindmap(sec, kws, kp.sentences);
      return sec;
    });
    secs.forEach((s, i) => { s.quiz = makeQuiz(i, secs); });
    const total = stats(raw);
    return { title, sections: secs, keywords: model.global.map((x) => x.k), chars: total.chars, minutes: total.minutes, hash: hashStr(title + raw.length + raw.slice(0, 2000)) };
  }

  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  window.Dehydrate = { build, pdfToText, splitSections, splitSentences, makeQuiz, stats, clip, isCJK };
})();
