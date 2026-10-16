"""Extract flattened glyph outlines for every character used in js/*.js (string literals) into assets/glyphs.json.
Fonts (all SIL OFL 1.1):
  SB  Noto Serif CJK SC Black   (titles)            /usr/share/fonts/google-noto-cjk/NotoSerifCJK-Black.ttc, face 2
  SM  Noto Serif CJK SC Bold    (sub-titles)        /usr/share/fonts/google-noto-cjk/NotoSerifCJK-Bold.ttc,  face 2
  WK  LXGW WenKai Medium        (hand-written notes) fonts/LXGWWenKai-Medium.ttf
Coordinates in font units, y flipped (canvas y-down). Run: python3 tools/glyphs.py
"""
import json, math, os, re, glob
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
NOTO = os.environ.get('NOTO_DIR', '/usr/share/fonts/google-noto-cjk')
FONTS = {
    'SB': (os.path.join(NOTO, 'NotoSerifCJK-Black.ttc'), 2),
    'SM': (os.path.join(NOTO, 'NotoSerifCJK-Bold.ttc'), 2),
    'WK': (os.path.join(ROOT, 'fonts', 'LXGWWenKai-Medium.ttf'), 0),
}
STEP = 7.0  # font units per flattened segment (~0.8 px at 120 px size)

class FlatPen(BasePen):
    def __init__(self, gs):
        super().__init__(gs); self.contours = []; self.cur = None
    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p):
        a = self.cur[-1]; n = max(1, int(math.hypot(p[0]-a[0], p[1]-a[1]) / (STEP * 4)))
        for k in range(1, n + 1): self.cur.append((a[0] + (p[0]-a[0]) * k / n, a[1] + (p[1]-a[1]) * k / n))
    def _qCurveToOne(self, p1, p2):
        a = self.cur[-1]; L = math.hypot(p1[0]-a[0], p1[1]-a[1]) + math.hypot(p2[0]-p1[0], p2[1]-p1[1])
        n = max(2, int(L / STEP))
        for k in range(1, n + 1):
            t = k / n; u = 1 - t
            self.cur.append((u*u*a[0] + 2*u*t*p1[0] + t*t*p2[0], u*u*a[1] + 2*u*t*p1[1] + t*t*p2[1]))
    def _curveToOne(self, p1, p2, p3):
        a = self.cur[-1]; L = math.hypot(p1[0]-a[0], p1[1]-a[1]) + math.hypot(p2[0]-p1[0], p2[1]-p1[1]) + math.hypot(p3[0]-p2[0], p3[1]-p2[1])
        n = max(2, int(L / STEP))
        for k in range(1, n + 1):
            t = k / n; u = 1 - t
            self.cur.append((u**3*a[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0], u**3*a[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
    def _closePath(self):
        if self.cur and len(self.cur) > 2:
            if math.hypot(self.cur[0][0]-self.cur[-1][0], self.cur[0][1]-self.cur[-1][1]) < 1e-6: self.cur.pop()
            self.contours.append(self.cur)
        self.cur = None
    def _endPath(self): self._closePath()

def charset():
    s = set()
    for fn in glob.glob(os.path.join(ROOT, 'js', '*.js')):
        src = open(fn, encoding='utf-8').read()
        for m in re.finditer(r"'([^'\\\n]*)'|\"([^\"\\\n]*)\"|`([^`\\]*)`", src):
            for ch in (m.group(1) or m.group(2) or m.group(3) or ''):
                s.add(ch)
    for c in range(32, 127): s.add(chr(c))
    return s

def main():
    chars = charset(); out = {}
    for key, (path, idx) in FONTS.items():
        f = TTFont(path, fontNumber=idx); gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f['hmtx']
        os2 = f['OS/2']; data = {'upem': f['head'].unitsPerEm, 'asc': os2.sTypoAscender, 'desc': os2.sTypoDescender, 'glyphs': {}}
        miss = []
        for ch in sorted(chars):
            if ord(ch) not in cmap: miss.append(ch); continue
            gn = cmap[ord(ch)]; pen = FlatPen(gs); gs[gn].draw(pen)
            cs = [[v for p in c for v in (int(round(p[0])), int(round(-p[1])))] for c in pen.contours]
            data['glyphs'][ch] = {'adv': hmtx[gn][0], 'c': cs}
        out[key] = data
        print(key, len(data['glyphs']), 'glyphs; missing:', ''.join(m for m in miss if ord(m) > 127))
    os.makedirs(os.path.join(ROOT, 'assets'), exist_ok=True)
    with open(os.path.join(ROOT, 'assets', 'glyphs.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('size', os.path.getsize(os.path.join(ROOT, 'assets', 'glyphs.json')))
main()
