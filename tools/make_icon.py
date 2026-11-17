# Draws the Miami 800 icon on a 128x128 grid and blows it up with hard edges, like the 1975 arcade screen:
# a track of soft white dots, a big white 800 with stepped (pixel-rounded) corners, and the eight cars in their colours.
# Run: python3 tools/make_icon.py   (writes public/icon-*.png; Lubowcade keeps a copy as public/icons/miami800.png)
import math, os
from PIL import Image, ImageDraw
N = 128
K = (0, 0, 0); DOT = (185, 192, 207); WHITE = (244, 246, 251); TYRE = (170, 179, 200)
CARS = [(63, 143, 245), (232, 57, 43), (244, 246, 251), (69, 216, 230), (95, 208, 110), (217, 240, 156), (207, 176, 240), (125, 99, 242)]
img = Image.new('RGB', (N, N), K); d = ImageDraw.Draw(img)

# track: one row of dots round a rounded square
m, r, step = 7, 24, 7.0
pts = []
def arc(cx, cy, a0, a1):
    n = max(2, int(abs(a1 - a0) * r / 1.0))
    for i in range(n): a = a0 + (a1 - a0) * i / n; pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
def line(x0, y0, x1, y1):
    n = int(math.hypot(x1 - x0, y1 - y0))
    for i in range(n): pts.append((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n))
lo, hi = m, N - 1 - m
line(lo + r, lo, hi - r, lo); arc(hi - r, lo + r, -math.pi / 2, 0); line(hi, lo + r, hi, hi - r); arc(hi - r, hi - r, 0, math.pi / 2)
line(hi - r, hi, lo + r, hi); arc(lo + r, hi - r, math.pi / 2, math.pi); line(lo, hi - r, lo, lo + r); arc(lo + r, lo + r, math.pi, 1.5 * math.pi)
total = len(pts); count = round(total / step)
for i in range(count):
    x, y = pts[int(i * total / count)]
    d.rectangle([round(x) - 1, round(y) - 1, round(x) + 1, round(y) + 1], fill=DOT)

# 800: 7x9 cells per digit, corner cells left out so the corners step round
GLYPH = {'8': ['.11111.', '1100011', '1100011', '1100011', '.11111.', '1100011', '1100011', '1100011', '.11111.'],
         '0': ['.11111.', '1100011', '1100011', '1100011', '1100011', '1100011', '1100011', '1100011', '.11111.']}
u = 4; gap = 5; w = 3 * 7 * u + 2 * gap; x = (N - w) // 2; y = 23
for ch in '800':
    for ry, row in enumerate(GLYPH[ch]):
        for rx, v in enumerate(row):
            if v == '1': d.rectangle([x + rx * u, y + ry * u, x + rx * u + u - 1, y + ry * u + u - 1], fill=WHITE)
    x += 7 * u + gap

# the eight cars, drawn exactly as in the game (wings, tyres, cockpit), in two rows of four
def car(cx, cy, col):
    def rct(a, b, ww, hh, f): d.rectangle([cx + a, cy + b, cx + a + ww - 1, cy + b + hh - 1], fill=f)
    rct(-9, -8, 6, 4, TYRE); rct(-9, 4, 6, 4, TYRE); rct(4, -7, 5, 3, TYRE); rct(4, 4, 5, 3, TYRE)
    rct(-10, -4, 17, 8, col); rct(7, -2, 5, 4, col); rct(-12, -6, 3, 12, col); rct(10, -5, 2, 10, col); rct(-3, -2, 5, 4, K)
for i, col in enumerate(CARS):
    car(26 + (i % 4) * 26, 79 + (i // 4) * 21, col)

out = os.path.join(os.path.dirname(__file__), '..', 'public')
for n in (1024, 512, 192, 180):
    img.resize((n, n), Image.NEAREST if n % N == 0 else Image.LANCZOS).save(os.path.join(out, 'icon-%d.png' % n))
