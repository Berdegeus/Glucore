"""Gera o banner do e-mail de recuperação de senha (src/lib/emailAssets.ts).

    python3 scripts/generate_email_assets.py

Desenha em 3x e reduz para suavizar as bordas. O PNG vai embutido em base64 no
TypeScript: o e-mail o anexa por CID, sem depender de hospedagem de imagem.
"""
import base64, io, math, pathlib
from PIL import Image, ImageDraw, ImageFont

W, H, S = 1200, 380, 3
BLUE, SKY = (0, 82, 255), (2, 132, 199)
GREEN = (5, 177, 105)
FONT = '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf'

img = Image.new('RGB', (W * S, H * S))
px = img.load()
for y in range(H * S):          # gradiente diagonal azul -> azul-céu
    for x in range(0, W * S):
        t = (x / (W * S) * 0.75 + y / (H * S) * 0.25)
        px[x, y] = tuple(int(BLUE[i] + (SKY[i] - BLUE[i]) * t) for i in range(3))

over = Image.new('RGBA', img.size, (0, 0, 0, 0))
d = ImageDraw.Draw(over)

# faixa-alvo (70-180 mg/dL) translúcida
top, bot = 150 * S, 290 * S
d.rectangle([0, top, W * S, bot], fill=(255, 255, 255, 30))
for yy in (top, bot):
    for x in range(0, W * S, 24 * S):
        d.line([x, yy, x + 12 * S, yy], fill=(255, 255, 255, 70), width=2 * S)

# curva de glicose
def curve(x):
    u = x / W
    return 235 - 55 * math.sin(u * 7.2 + 0.4) - 25 * math.sin(u * 16 + 1.1) - 20 * u
pts = [(x * S, curve(x) * S) for x in range(0, W + 1, 4)]
area = pts + [(W * S, H * S), (0, H * S)]
d.polygon(area, fill=(255, 255, 255, 38))
d.line(pts, fill=(255, 255, 255, 255), width=6 * S, joint='curve')
ex, ey = pts[int(len(pts) * 0.86)]
for r, a in ((26, 60), (16, 120)):
    d.ellipse([ex - r * S, ey - r * S, ex + r * S, ey + r * S], fill=(255, 255, 255, a))
d.ellipse([ex - 9 * S, ey - 9 * S, ex + 9 * S, ey + 9 * S], fill=GREEN + (255,), outline=(255, 255, 255, 255), width=3 * S)

# logo: gota + pulso, e o nome
lx, ly = 64 * S, 56 * S
def drop(cx, cy, r):
    pts = [(cx, cy - r * 1.9)]
    for a in range(-60, 241, 5):
        pts.append((cx + r * math.cos(math.radians(a)) * 1.0, cy + r * 0.35 + r * math.sin(math.radians(a)) * 1.0))
    return pts
cx, cy, r = lx + 30 * S, ly + 36 * S, 30 * S
d.polygon(drop(cx, cy, r), fill=(255, 255, 255, 255))
d.line([(cx - 20 * S, cy + 10 * S), (cx - 8 * S, cy + 10 * S), (cx - 2 * S, cy - 8 * S),
        (cx + 6 * S, cy + 22 * S), (cx + 12 * S, cy + 10 * S), (cx + 22 * S, cy + 10 * S)],
       fill=BLUE + (255,), width=4 * S, joint='curve')
f = ImageFont.truetype(FONT, 58 * S)
d.text((lx + 78 * S, ly + 2 * S), 'Glucore', font=f, fill=(255, 255, 255, 255))

img = Image.alpha_composite(img.convert('RGBA'), over).convert('RGB').resize((W, H), Image.LANCZOS)
buf = io.BytesIO()
img.quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE).save(buf, 'PNG', optimize=True)
data = buf.getvalue()

out = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'lib' / 'emailAssets.ts'
out.write_text(
    '// Gerado por scripts/generate_email_assets.py. Não edite à mão.\n'
    f'export const EMAIL_BANNER_PNG_BASE64 =\n  "{base64.b64encode(data).decode()}";\n'
)
img.save('/private/tmp/claude-501/-Users-berdegeus-Glucore/716e7c84-e9b5-4060-8f4f-eea8c1ec415c/scratchpad/banner-preview.png')
print(len(data), 'bytes')
