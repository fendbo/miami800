# Draws the Miami 800 icon: the oval track seen from above with its red and white kerb,
# cars on it, and a blocky 800 in the infield. Run: python3 tools/make_icon.py
import math, os
from PIL import Image, ImageDraw
S = 2048
img = Image.new('RGB', (S, S), (7, 11, 22))
d = ImageDraw.Draw(img)
cx, cy = S / 2, S / 2

def oval(rx, ry, n=720):
    # a rounded-rectangle ("stadium") path
    k = 3.2
    return [(cx + rx * math.copysign(abs(math.cos(a)) ** (2 / k), math.cos(a)),
             cy + ry * math.copysign(abs(math.sin(a)) ** (2 / k), math.sin(a))) for a in [i * 2 * math.pi / n for i in range(n)]]

mid = oval(S * 0.36, S * 0.34)
def stroke(pts, w, col):
    d.line(pts + pts[:2], fill=col, width=w, joint='curve')
    r = w / 2
    for (x, y) in pts[::4]: d.ellipse([x - r, y - r, x + r, y + r], fill=col)
road = int(S * 0.2)
stroke(mid, road + 70, (238, 242, 251))
# red dashes on the white kerb
for i in range(0, len(mid), 24):
    seg = mid[i:i + 13]
    d.line(seg, fill=(255, 77, 77), width=road + 70)
stroke(mid, road, (24, 34, 63))
# start line
x0 = cx + S * 0.02; sq = road / 6
for i in range(6):
    for j in range(2):
        col = (238, 242, 251) if (i + j) % 2 else (7, 11, 22)
        y = cy - S * 0.34 - road / 2 + i * sq
        d.rectangle([x0 + j * sq, y, x0 + (j + 1) * sq, y + sq], fill=col)

def car(i, lat, col):
    x, y = mid[i]; x2, y2 = mid[(i + 3) % len(mid)]
    h = math.atan2(y2 - y, x2 - x); nx, ny = -math.sin(h), math.cos(h)
    x += nx * lat; y += ny * lat
    c = Image.new('RGBA', (360, 360), (0, 0, 0, 0)); g = ImageDraw.Draw(c); u = 11
    def r(a, b, w, hh, f): g.rectangle([180 + a * u, 180 + b * u, 180 + (a + w) * u, 180 + (b + hh) * u], fill=f)
    t = (170, 179, 200)
    r(-9, -7.5, 6, 3.4, t); r(-9, 4.1, 6, 3.4, t); r(4, -7, 5, 3, t); r(4, 4, 5, 3, t)
    r(-10, -3.6, 17, 7.2, col); r(7, -2.2, 5, 4.4, col); r(-12, -6, 2.6, 12, col); r(10.5, -5, 1.8, 10, col)
    r(-3, -2.2, 5, 4.4, (7, 11, 22))
    c = c.rotate(-math.degrees(h), resample=Image.BICUBIC)
    img.paste(c, (int(x - 180), int(y - 180)), c)
car(628, -60, (56, 189, 248)); car(575, 70, (255, 77, 77)); car(250, -40, (255, 210, 63)); car(110, 60, (74, 222, 128)); car(400, 50, (255, 159, 67))

# blocky 800 in the infield
D = {'8': ['111', '101', '111', '101', '111'], '0': ['111', '101', '101', '101', '111']}
b = S * 0.036; gap = b * 0.9; w = 3 * b * 3 + 2 * gap; x = cx - w / 2; y = cy - 2.5 * b
for ch in '800':
    for ry, row in enumerate(D[ch]):
        for rx, v in enumerate(row):
            if v == '1': d.rectangle([x + rx * b, y + ry * b, x + (rx + 1) * b + 1, y + (ry + 1) * b + 1], fill=(255, 210, 63))
    x += 3 * b + gap
out = os.path.join(os.path.dirname(__file__), '..', 'public')
for n in (1024, 512, 192, 180):
    img.resize((n, n), Image.LANCZOS).save(os.path.join(out, 'icon-%d.png' % n))
