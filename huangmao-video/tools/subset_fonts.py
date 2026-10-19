#!/usr/bin/env python3
"""Subset the three OFL fonts used by the film (js/) down to the glyphs it actually draws.

Sources (not stored in the repo, all SIL OFL 1.1):
  Resource Han Rounded CN Heavy / Bold  https://github.com/CyanoHao/Resource-Han-Rounded
  Smiley Sans Oblique (得意黑)           https://github.com/atelier-anchor/smiley-sans
Usage:  python3 tools/subset_fonts.py [--src fonts/src]      (tools/fetch_assets.sh downloads the sources there)
Output: assets/fonts/RHR-Heavy.ttf, RHR-Bold.ttf, SmileySans.ttf (+ prints glyph counts / sizes)
"""
import argparse, glob, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = [  # (output, source relative to --src)
    ('RHR-Heavy.ttf', 'ResourceHanRoundedCN-Heavy.ttf'),
    ('RHR-Bold.ttf', 'ResourceHanRoundedCN-Bold.ttf'),
    ('SmileySans.ttf', 'smiley/SmileySans-Oblique.ttf'),
]
EXTRA = ''.join(chr(c) for c in range(0x20, 0x7F)) + '“”‘’，。？！：；、（）《》【】…—～·￥%✓×→←↑↓'


def used_chars():
    chars = set(EXTRA)
    for p in sorted(glob.glob(os.path.join(ROOT, 'js', '*.js'))):
        if os.path.basename(p) == 'test.js':
            continue
        chars.update(ch for ch in open(p, encoding='utf-8').read() if ord(ch) >= 0x20)
    return ''.join(sorted(chars))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(ROOT, 'fonts', 'src'))
    a = ap.parse_args()
    text = used_chars()
    out_dir = os.path.join(ROOT, 'assets', 'fonts')
    os.makedirs(out_dir, exist_ok=True)
    txt = os.path.join(out_dir, '.subset_chars.txt')
    open(txt, 'w', encoding='utf-8').write(text)
    for out, src in FONTS:
        dst = os.path.join(out_dir, out)
        if os.path.islink(dst):  # never write through a symlink into the source font
            os.unlink(dst)
        subprocess.run(['pyftsubset', os.path.join(a.src, src), f'--text-file={txt}', f'--output-file={dst}',
                        '--layout-features=*', '--name-IDs=*', '--name-languages=*', '--name-legacy',
                        '--notdef-outline', '--glyph-names'], check=True)
        from fontTools.ttLib import TTFont
        n = len(TTFont(dst).getGlyphOrder())
        print(f'{out:16s} {n:5d} glyphs  {os.path.getsize(dst) / 1024:7.1f} KB')
    os.remove(txt)
    print(len(text), 'chars requested')


if __name__ == '__main__':
    sys.exit(main())
