# contact sheet of out/stills/t_*.png for the given times: python3 tools/sheet.py out/sheet.png 1.0,2.0,... [cols]
import sys
from PIL import Image, ImageDraw
out, ts = sys.argv[1], sys.argv[2].split(',')
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
ims = [Image.open(f'out/stills/t_{float(t):.3f}.png') for t in ts]
if scale != 1.0: ims = [im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS) for im in ims]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), (40, 40, 40))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y)); d.text((x + 6, y + 6), ts[i], fill=(255, 80, 80))
sheet.save(out)
