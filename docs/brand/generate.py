"""Articuno brand kit generator.

Usage: uv run --no-project --with fonttools --with skia-pathops --with resvg-py \
           python generate.py <Inter.ttf> <outdir>
Font: Inter (SIL OFL), google/fonts ofl/inter. Variable fonts are instanced at wght 700
(and opsz 32 when the axis exists, as Herald). Needs `magick` for favicon.ico.
"""
import os, sys, subprocess
import pathops, resvg_py
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path

FONT, OUT = sys.argv[1], sys.argv[2]
for sub in ("", "png", "web", "stream-deck"):
    os.makedirs(os.path.join(OUT, sub), exist_ok=True)

INK, WHITE = "#111111", "#ffffff"
ORANGE = "#E27A43"        # Meridian accent [data-svc="articuno"]: mark on dark, tile
ORANGE_DARK = "#BE551D"   # mark on light grounds (4.66:1 on white)
DARK = "#0d1117"

# ── Geometry helpers (pathops = Skia boolean ops) ───────────────────────
def P(d):
    p = pathops.Path()
    parse_path(d, p.getPen())
    return p

U, D = pathops.PathOp.UNION, pathops.PathOp.DIFFERENCE
op = pathops.op

def poly(*pts):
    return P("M" + "L".join(f"{x:.3f} {y:.3f}" for x, y in pts) + "Z")

def xf(path, m):
    out = pathops.Path()
    path.draw(TransformPen(out.getPen(), m))
    return out

def d(path):
    pen = SVGPathPen(None, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    path.draw(pen)
    return pen.getCommands()

T60, T30, T15 = 1.73205, 0.57735, 0.26795       # tan 60°, 30°, 15°

# ── Symbol: a pen nib pointing up; slit + breather hole are the A's counter ──
# Outer point and counter are 60° triangles (parallel sides → even legs); the waist
# tapers in at 15° to the base like a real nib; the feet open under a 30° roof and
# splay at 15° (parallel to the waist, so the legs keep an even width)
# (the crossbar is the band between counter and roof).
def nib(small=False):
    apex, shoulder, base = 32, 156, 216
    if small:   # ≤ 48 px: wider slit, bigger counter, wider feet
        c_apex, c_base, slit, feet, roof = 96, 146, 12, 22, 196
    else:
        c_apex, c_base, slit, feet, roof = 100, 146, 8, 18, 196
    xs = (shoulder - apex) / T60
    waist = xs - (base - shoulder) * T15
    body = poly((128, apex), (128 + xs, shoulder), (128 + waist, base),
                (128 - waist, base), (128 - xs, shoulder))
    ch = (c_base - c_apex) / T60
    counter = poly((128, c_apex), (128 + ch, c_base), (128 - ch, c_base))
    cut = poly((128 - slit / 2, apex - 10), (128 + slit / 2, apex - 10),
               (128 + slit / 2, c_apex + slit * T60), (128 - slit / 2, c_apex + slit * T60))   # runs into the counter: no ledge
    spread = feet + (base + 10 - roof) * T15     # inner leg edges splay at 15°, parallel to the waist
    foot = poly((128 - spread, base + 10), (128 - feet, roof), (128, roof - feet * T30),
                (128 + feet, roof), (128 + spread, base + 10))
    m = body
    for q in (counter, cut, foot):
        m = op(m, q, D)
    x0, y0, x1, y1 = m.bounds
    if small:                                   # fill the canvas: the larger side to 216
        s = 216 / max(x1 - x0, y1 - y0)
        m = xf(m, (s, 0, 0, s, 0, 0))
        x0, y0, x1, y1 = m.bounds
    return xf(m, (1, 0, 0, 1, 128 - (x0 + x1) / 2, 126 - (y0 + y1) / 2))   # lifted 2 (optical centre)

def symbol(color, small=False):
    return f'<path fill="{color}" fill-rule="evenodd" d="{d(nib(small))}"/>'

# ── Wordmark: Inter Bold in paths, cap height 120, tracking −3 (as Herald) ──
vf = TTFont(FONT)
if "fvar" in vf:
    axes = {a.axisTag: a for a in vf["fvar"].axes}
    loc = {t: (700 if t == "wght" else 32 if t == "opsz" else a.defaultValue) for t, a in axes.items()}
    font = instancer.instantiateVariableFont(vf, loc)
else:
    font = vf
gs, cmap = font.getGlyphSet(), font.getBestCmap()
K = 120 / font["OS/2"].sCapHeight

def wordmark(x, baseline):
    out = pathops.Path()
    for ch in "Articuno":
        g = pathops.Path()
        gs[cmap[ord(ch)]].draw(TransformPen(g.getPen(gs), (K, 0, 0, -K, x, baseline)))
        out = op(out, g, U)
        x += gs[cmap[ord(ch)]].width * K - 3
    return out

SYM = nib()
_, sy0, sx1, sy1 = SYM.bounds
LOCK = op(SYM, wordmark(sx1 + 48, (sy0 + sy1) / 2 + 60), U)   # cap centred on the mark
LX0, LY0, LX1, LY1 = LOCK.bounds
PAD = 40
LVB = f"0 0 {LX1 - LX0 + 2 * PAD:.0f} {LY1 - LY0 + 2 * PAD:.0f}"

def lockup(color):
    return (f'<path fill="{color}" fill-rule="evenodd" transform="translate({PAD - LX0:.2f} {PAD - LY0:.2f})" '
            f'd="{d(LOCK)}"/>')

def svg(vb, body, title="Articuno"):
    w, h = vb.split()[2:]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" role="img">'
            f'<title>{title}</title>{body}</svg>\n')

def tile(size, rx, inset, bg, color, small=False):
    s = (size - 2 * inset) / 256
    return (f'<rect width="{size}" height="{size}"{rx} fill="{bg}"/>'
            f'<g transform="translate({inset} {inset}) scale({s:.4f})">{symbol(color, small)}</g>')

SMALL = "Articuno (small sizes)"
files = {
    "articuno-lockup.svg": svg(LVB, lockup(INK)),
    "articuno-lockup-black.svg": svg(LVB, lockup("#000000")),
    "articuno-lockup-white.svg": svg(LVB, lockup(WHITE)),
    "articuno-lockup-orange.svg": svg(LVB, lockup(ORANGE)),
    "articuno-lockup-orange-dark.svg": svg(LVB, lockup(ORANGE_DARK)),
    "articuno-symbol.svg": svg("0 0 256 256", symbol(INK)),
    "articuno-symbol-black.svg": svg("0 0 256 256", symbol("#000000")),
    "articuno-symbol-white.svg": svg("0 0 256 256", symbol(WHITE)),
    "articuno-symbol-orange.svg": svg("0 0 256 256", symbol(ORANGE)),
    "articuno-symbol-orange-dark.svg": svg("0 0 256 256", symbol(ORANGE_DARK)),
    "articuno-symbol-small.svg": svg("0 0 256 256", symbol(INK, True), SMALL),
    "articuno-symbol-small-white.svg": svg("0 0 256 256", symbol(WHITE, True), SMALL),
    "articuno-symbol-small-orange.svg": svg("0 0 256 256", symbol(ORANGE, True), SMALL),
    "articuno-symbol-square.svg": svg("0 0 256 256", f'<g transform="translate(25.6 25.6) scale(0.8)">{symbol(INK)}</g>'),
    # ink on orange: the nib writes in ink (white on orange is only 2.96:1)
    "articuno-symbol-app-icon.svg": svg("0 0 256 256", tile(256, ' rx="57.6"', 44, ORANGE, INK)),
    # adapts to the tab bar: ink on light, white on dark
    "articuno-symbol-favicon.svg": svg("16 16 224 224",
        '<style>g{color:#111}@media (prefers-color-scheme:dark){g{color:#fff}}</style>'
        f'<g>{symbol("currentColor", True)}</g>'),
    "articuno-stream-deck-orange.svg": svg("0 0 288 288", tile(288, "", 58, ORANGE, INK)),
    "articuno-stream-deck-dark.svg": svg("0 0 288 288", tile(288, "", 58, DARK, ORANGE)),
}
for name, content in files.items():
    open(os.path.join(OUT, name), "w").write(content)

def png(src_svg, dst, width):
    open(os.path.join(OUT, dst), "wb").write(bytes(resvg_py.svg_to_bytes(svg_string=src_svg, width=width)))

png(files["articuno-lockup-black.svg"], "png/articuno-lockup-black.png", 1000)
png(files["articuno-lockup-orange.svg"], "png/articuno-lockup-orange.png", 1000)
png(files["articuno-lockup-white.svg"], "../../app_logo.png", 1000)
for v in ("black", "white", "orange"):
    png(files[f"articuno-symbol-{v}.svg"], f"png/articuno-symbol-{v}.png", 512)
small_icon = svg("0 0 256 256", tile(256, ' rx="57.6"', 20, ORANGE, INK, True))  # ≤48 px: small cut, bigger in the tile
for n in (16, 32, 48):
    png(small_icon, f"web/favicon-{n}.png", n)
icon = files["articuno-symbol-app-icon.svg"]
for n in (192, 512):
    png(icon, f"web/icon-{n}.png", n)
png(icon.replace(' rx="57.6"', ""), "web/apple-touch-icon.png", 180)   # Apple masks the corners itself
for v in ("orange", "dark"):
    for n in (288, 144):
        png(files[f"articuno-stream-deck-{v}.svg"], f"stream-deck/articuno-{v}-{n}.png", n)
w = os.path.join(OUT, "web")
subprocess.run(["magick", f"{w}/favicon-16.png", f"{w}/favicon-32.png", f"{w}/favicon-48.png", f"{w}/favicon.ico"], check=True)
print("lockup viewBox", LVB)
print("small path", d(nib(True)))
