"""Builds the paper plates (1080x1920 portrait) from ambientCG Paper001 (CC0).
Adapted from mg-styles-15 demos/05-cel-boil/tools/gen_paper.py (MIT).
assets/paper_base.jpg  : warm cream animation-bond paper (fibre tooth + soft mottling + edge falloff)
assets/paper_night.jpg : deep-indigo "night" plate with the same fibre tooth (lights-off scenes)
assets/paper_tooth.png : near-white tooth plate for a multiply pass over the whole frame (re-offset per drawing = paper boil)
"""
import numpy as np, os, sys
from PIL import Image, ImageFilter
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tex', 'Paper001_4K-JPG_Color.jpg')
src = Image.open(SRC).convert('L')
if src.width > src.height:  # Paper001 is landscape (4096x2402): rotate so portrait crops stay in bounds
    src = src.transpose(Image.Transpose.ROTATE_90)
a = np.asarray(src, np.float32) / 255.0
blur = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(24)), np.float32) / 255.0
hp = a - blur
hp = hp / (np.std(hp) + 1e-6)

def crop_resize(x, x0, y0, w, h, W, H):
    im = Image.fromarray(np.clip((x * 40 + 128), 0, 255).astype(np.uint8)).crop((x0, y0, x0 + w, y0 + h)).resize((W, H), Image.LANCZOS)
    return (np.asarray(im, np.float32) - 128) / 40

W, H = 1080, 1920
d = crop_resize(hp, 300, 100, 1800, 3200, W, H)
cream = np.array([246, 236, 212], np.float32) / 255.0     # #F6ECD4
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
nx, ny = (xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)
vig = 1.0 - 0.07 * np.clip((nx ** 2 + ny ** 2 * 0.8) - 0.3, 0, None)
rng = np.random.default_rng(7)
m = rng.normal(0, 1, (16, 9)).astype(np.float32)
mot = np.asarray(Image.fromarray(((m - m.min()) / (np.ptp(m)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255.0
mot = (mot - 0.5) * 0.028
lum = vig * (1 + 0.018 * d) + mot
img = np.clip(cream[None, None, :] * lum[..., None], 0, 1)
os.makedirs(os.path.join(ROOT, 'assets'), exist_ok=True)
Image.fromarray((img * 255).astype(np.uint8)).save(os.path.join(ROOT, 'assets', 'paper_base.jpg'), quality=94)
# night plate: indigo ground, stronger vignette, same fibre tooth
night = np.array([31, 42, 88], np.float32) / 255.0      # #1F2A58
vign = 1.0 - 0.22 * np.clip((nx ** 2 + ny ** 2 * 0.8) - 0.15, 0, None)
lumn = vign * (1 + 0.05 * d) + mot * 1.6
imgn = np.clip(night[None, None, :] * lumn[..., None], 0, 1)
Image.fromarray((imgn * 255).astype(np.uint8)).save(os.path.join(ROOT, 'assets', 'paper_night.jpg'), quality=94)

TW, TH = 1400, 2400
t = crop_resize(hp, 380, 500, 1866, 3200, TW, TH)
tooth = 1.0 - 0.10 * np.clip(-t, 0, None)
tooth = np.clip(tooth, 0.6, 1.0)
Image.fromarray((tooth * 255).astype(np.uint8)).save(os.path.join(ROOT, 'assets', 'paper_tooth.png'))
print('ok', (img.mean(axis=(0, 1)) * 255).round(1), round(float(tooth.mean()), 3))
