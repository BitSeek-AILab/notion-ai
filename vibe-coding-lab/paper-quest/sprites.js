/* 像素精灵：Sweetie-16 调色板 + 字符画 → dataURL */
(function () {
  const P = {
    k: '#1a1c2c', u: '#5d275d', r: '#b13e53', o: '#ef7d57', y: '#ffcd75', l: '#a7f070', g: '#38b764', t: '#257179',
    n: '#29366f', b: '#3b5dc9', s: '#41a6f6', c: '#73eff7', w: '#f4f4f4', e: '#94b0c2', m: '#566c86', d: '#333c57',
  };
  const S = {
    hero: ['....dddd....', '...dddddd...', '...dyyyyd...', '...kykkyk...', '...yyyyyy...', '....yyyy....', '...rrrrrr...', '..yrrwrrry..', '..yrrrrrry..', '...rrrrrr...', '...nn..nn...', '..ddd..ddd..'],
    slime: ['....uuuu....', '..uuuuuuuu..', '.uuuuuuuuuu.', '.uuwwuuwwuu.', '.uuwkuuwkuu.', 'uuuuuuuuuuuu', 'uuuurrrruuuu', '.uuuuuuuuuu.', '..u.uu.uu.u.'],
    boss: ['.y...yy...y.', '.yy.yyyy.yy.', '.yyyyyyyyyy.', '..rrrrrrrr..', '.rrrrrrrrrr.', 'rrwwrrrrwwrr', 'rrwkrrrrwkrr', 'rrrrrrrrrrrr', 'rrrkwkwkwrrr', '.rrrrrrrrrr.', '..r.rr.rr.r.'],
    flag: ['.wy.......', '.wyyyy....', '.wyyyyyy..', '.wyyyy....', '.wy.......', '.w........', '.w........', '.w........', 'ddd.......'],
    lock: ['...eeee...', '..e....e..', '..e....e..', '.yyyyyyyy.', '.yyyykyyy.', '.yyyykyyy.', '.yyyyyyyy.', '.oooooooo.'],
    star: ['....yy....', '....yy....', '...yyyy...', 'yyyyyyyyyy', '.yyyyyyyy.', '..yyyyyy..', '..yyyyyy..', '.yyy..yyy.', '.yy....yy.', 'yy......yy'],
    castle: ['r.........r.', 'r..r....r.r.', 'ee.e.ee.e.ee', 'eeeeeeeeeeee', 'eeekeeeekeee', 'eeeeeeeeeeee', 'eeeeekkeeeee', 'eeeeekkeeeee', 'mmmmmkkmmmmm'],
    tree: ['...gg...', '..gggg..', '.gglggg.', 'gggggggg', '.gggggg.', '..gggg..', '...dd...', '...dd...'],
    pine: ['...t....', '..ttt...', '..ttt...', '.ttgtt..', '.ttttt..', 'tttgttt.', '...d....', '...d....'],
    rock: ['..mmm...', '.meemm..', 'meeemmm.', 'mmmmmmmd'],
    flower: ['.r.r.', 'ryryr', '.r.r.', '..g..', '.gg..'],
    drop: ['...s...', '..sss..', '..scs..', '.sscss.', '.sssss.', 'ssscsss', 'sssssss', '.sssss.', '..sss..'],
    // 勋章图标 10×10
    b_star: ['....yy....', '....yy....', '...yyyy...', 'yyyyyyyyyy', '.yyyyyyyy.', '..yyyyyy..', '..yyyyyy..', '.yyy..yyy.', '.yy....yy.', 'yy......yy'],
    b_bolt: ['.....ccc..', '....ccc...', '...ccc....', '..cccccc..', '.....cc...', '....cc....', '...cc.....', '..cc......', '.cc.......', '.c........'],
    b_target: ['...rrrr...', '.rrwwwwrr.', '.rwwrrwwr.', 'rwwrwwrwwr', 'rwrwyywrwr', 'rwrwyywrwr', 'rwwrwwrwwr', '.rwwrrwwr.', '.rrwwwwrr.', '...rrrr...'],
    b_flame: ['....o.....', '...oo.....', '...ooo.o..', '..ooooo.o.', '..oooooo..', '.oooooooo.', '.oooyyooo.', '.ooyyyyoo.', '.ooyyyyoo.', '..oooooo..'],
    b_crown: ['y...yy...y', 'yy.yyyy.yy', 'yyyyyyyyyy', 'yrryccyrry', 'yyyyyyyyyy', 'yyyyyyyyyy', '.yyyyyyyy.', '..........'],
    b_moon: ['...eeee...', '..ee......', '.ee.......', '.ee.......', 'ee........', 'ee........', '.ee.......', '.eee....e.', '..eeeeeee.', '...eeeee..'],
    b_sun: ['o...oo...o', '.o..oo..o.', '...yyyy...', '..yyyyyy..', 'ooyyyyyyoo', 'ooyyyyyyoo', '..yyyyyy..', '...yyyy...', '.o..oo..o.', 'o...oo...o'],
    b_heart: ['.rr...rr..', 'rrrr.rrrr.', 'rrwrrrrrr.', 'rrrrrrrrr.', '.rrrrrrr..', '..rrrrr...', '...rrr....', '....r.....'],
    b_net: ['.ss....ss.', '.ss....ss.', '...s..s...', '....ss....', '...cccc...', '...cccc...', '....ss....', '...s..s...', '.ss....ss.', '.ss....ss.'],
    b_scroll: ['.llllllll.', 'lwlwwwwwwl', '.lwwwwwwl.', '.lwkkkkwl.', '.lwwwwwwl.', '.lwkkkwwl.', '.lwwwwwwl.', '.lwkkkkwl.', 'lwwwwwwlwl', '.llllllll.'],
  };
  const cache = {};
  function url(name, scale = 4, opts = {}) {
    const key = name + scale + JSON.stringify(opts);
    if (cache[key]) return cache[key];
    const rows = S[name]; if (!rows) return '';
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
    const c = cv.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      let col = P[ch];
      if (opts.gray) { const v = parseInt(col.slice(1, 3), 16) * 0.3 + parseInt(col.slice(3, 5), 16) * 0.59 + parseInt(col.slice(5, 7), 16) * 0.11; const g = Math.round(v * 0.55 + 40).toString(16).padStart(2, '0'); col = '#' + g + g + g; }
      if (opts.map && opts.map[ch]) col = opts.map[ch];
      c.fillStyle = col; c.fillRect(x * scale, y * scale, scale, scale);
    }));
    return (cache[key] = cv.toDataURL());
  }
  function img(name, scale, cls, opts) { return `<img class="spr ${cls || ''}" src="${url(name, scale, opts)}" alt="" aria-hidden="true">`; }
  window.Sprites = { P, S, url, img };
})();
