"""
Events V1.1: the activation render's layers and its static composite (python3, with numpy and opencv-python).

From the Blender passes (activation-booth.py) and the two loops' poster frames, this
writes the files the page uses:

  activation-plate.jpg      the room, both screens dark (the live base)
  activation-spill-tv.jpg   the television's light on the room (screen-blended)
  activation-spill-wall.jpg the projection's light on the room (screen-blended)
  activation-wall-mask.png  where the projection lands: the wall's own texture,
                            soft edges, and nothing where the booth stands in
                            front of it (white, its alpha the mask)
  activation-render.jpg     the static composite: the plate with both screens
                            on their poster frames, exactly as the live layers
                            compose them in the browser (the fallback for
                            reduced motion, saving data, small screens and no
                            JavaScript)
  ev-activation.json        the screens' corners (shares of the frame), the
                            loops' brightness over time (for the spill), and
                            the layer strengths

Everything composes in display space, as CSS blending does: a layer with
`mix-blend-mode: screen` at opacity a over b gives b + a * s * (1 - b).
"""
import argparse
import json
import math
import re

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--passes', required=True, help='folder with plate.png, tv.png, wall.png, receptor.png, geom.json')
ap.add_argument('--posters', required=True, help='folder with tv-poster-full.png, wall-poster-full.png, luma-tv.txt, luma-wall.txt')
ap.add_argument('--out', required=True)
ap.add_argument('--data', required=True, help='path of ev-activation.json')
A = ap.parse_args()

# Layer strengths (shared with the page through ev-activation.json).
WALL_OPACITY = 0.34  # the projection: about a third of the television's intensity
SPILL_TV = 0.85  # the television's light on the room, at full brightness
SPILL_WALL = 0.42  # the projection's light on the room, at full brightness
FLOOR = 0.25  # the spill never quite goes out: share of its strength at black
GAIN = 1.6  # the spill passes are brightened by this much as they are written (a gentle glow at full strength)
FEATHER = 0.093  # the projection's soft edge, as a share of its width (the same width of edge on its height); V1.2 took a third off V1.1's 0.14
TV_LOOP = dict(source_in=29.2, poster=34.5)  # V1.2: the loop file is the source's 29.2 to 34.9 s (the charger card); its poster, the completed card
WALL_LOOP = dict(source_in=7.5, poster=14.2)
RATE = 12  # brightness samples a second


def read16(path, alpha=False):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im is None:
        raise SystemExit(f'cannot read {path}')
    scale = 65535.0 if im.dtype == np.uint16 else 255.0
    im = im.astype(np.float64) / scale
    if im.ndim == 2:
        im = np.dstack([im] * 3)
    if alpha:
        if im.shape[2] == 4:
            return im[..., [2, 1, 0]], im[..., 3]
        return im[..., [2, 1, 0]], np.ones(im.shape[:2])
    return im[..., [2, 1, 0]] if im.shape[2] >= 3 else im


def write(path, rgb, quality=92):
    bgr = np.clip(rgb[..., ::-1] * 255.0 + 0.5, 0, 255).astype(np.uint8)
    if path.endswith('.jpg'):
        cv2.imwrite(path, bgr, [cv2.IMWRITE_JPEG_QUALITY, quality, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
    else:
        cv2.imwrite(path, bgr)


def resize(im, w, h):
    return cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA if im.shape[1] > w else cv2.INTER_CUBIC)


def warp(frame, quad, W, H, ss=2):
    """The frame (RGB) mapped onto the quad (shares, TL TR BR BL), antialiased; returns (rgb, coverage)."""
    fh, fw = frame.shape[:2]
    src = np.float32([[0, 0], [fw, 0], [fw, fh], [0, fh]])
    dst = np.float32([[x * W * ss, y * H * ss] for x, y in quad])
    M = cv2.getPerspectiveTransform(src, dst)
    big = cv2.warpPerspective(frame.astype(np.float32), M, (W * ss, H * ss), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    cov = cv2.warpPerspective(np.ones((fh, fw), np.float32), M, (W * ss, H * ss), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    rgb = cv2.resize(big, (W, H), interpolation=cv2.INTER_AREA)
    cov = cv2.resize(cov, (W, H), interpolation=cv2.INTER_AREA)
    # rgb was weighted by coverage at the edges (black outside); un-premultiply it
    safe = np.maximum(cov, 1e-6)[..., None]
    return np.clip(rgb / safe, 0, 1), np.clip(cov, 0, 1)


def screen(b, s, a):
    a = a[..., None] if np.ndim(a) == 2 else a
    return b + a * s * (1 - b)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---- inputs
plate = read16(f'{A.passes}/plate.png')
H, W = plate.shape[:2]
tv = np.clip(read16(f'{A.passes}/tv.png') * GAIN, 0, 1)
wall = np.clip(read16(f'{A.passes}/wall.png') * GAIN, 0, 1)
rec, rec_a = read16(f'{A.passes}/receptor.png', alpha=True)
geom = json.load(open(f'{A.passes}/geom.json'))
tv_poster = read16(f'{A.posters}/tv-poster-full.png')
wall_poster = read16(f'{A.posters}/wall-poster-full.png')

sw, sh = tv.shape[1], tv.shape[0]  # the spills' size (half the plate's)

# ---- the projection's mask, in the spill's size
mh, mw = rec.shape[:2]
L = rec.mean(axis=2)
vis = rec_a
# the wall's own texture: its light divided by the light's smooth falloff
blur = cv2.GaussianBlur(L * vis, (0, 0), 28) / np.maximum(cv2.GaussianBlur(vis, (0, 0), 28), 1e-4)
tex = np.where(vis > 0.01, L / np.maximum(blur, 1e-4), 1.0)
tex = cv2.GaussianBlur(tex.astype(np.float32), (0, 0), 0.8)
tex = np.clip(tex, 0.55, 1.35)
# the soft rectangle, in the wall's own coordinates (the inverse of the quad's homography)
quad = np.float32([[x * mw, y * mh] for x, y in geom['wall']])
unit = np.float32([[0, 0], [1, 0], [1, 1], [0, 1]])
Hinv = cv2.getPerspectiveTransform(quad, unit)
ys, xs = np.mgrid[0:mh, 0:mw].astype(np.float64)
pts = np.stack([xs + 0.5, ys + 0.5, np.ones_like(xs)], -1) @ Hinv.T
u = pts[..., 0] / pts[..., 2]
v = pts[..., 1] / pts[..., 2]
fu = FEATHER
fv = FEATHER * 1.5  # the same width of edge on the 3:2 frame's shorter side
# nothing at the frame's own edge, full strength a feather's width inside it
rect = smoothstep(0, fu, u) * smoothstep(0, fu, 1 - u) * smoothstep(0, fv, v) * smoothstep(0, fv, 1 - v)
mask = rect * tex * vis
inside = (rect > 0.9) & (vis > 0.99)
norm = np.percentile(mask[inside], 97) if inside.any() else 1.0
mask = np.clip(mask / norm, 0, 1)

# ---- the loops' brightness over time
def luma(path, fps, source_in):
    vals = [float(m.group(1)) for m in re.finditer(r'YAVG=([\d.]+)', open(path).read())]
    y = np.clip((np.array(vals) - 16) / 219.0, 0, 1)
    k = np.ones(5) / 5
    y = np.convolve(np.pad(y, 2, mode='wrap'), k, mode='valid')
    dur = len(y) / fps
    n = int(math.ceil(dur * RATE))
    t = (np.arange(n) + 0.5) / RATE
    idx = np.clip((t * fps).astype(int), 0, len(y) - 1)
    s = y[idx]
    s = s / max(s.max(), 1e-6)
    return s, dur


FPS = 24000 / 1001
tv_lum, tv_dur = luma(f'{A.posters}/luma-tv.txt', FPS, TV_LOOP['source_in'])
wall_lum, wall_dur = luma(f'{A.posters}/luma-wall.txt', FPS, WALL_LOOP['source_in'])


def at(series, t):
    return float(series[min(len(series) - 1, max(0, int(t * RATE)))])


tv_poster_lum = at(tv_lum, TV_LOOP['poster'] - TV_LOOP['source_in'])
wall_poster_lum = at(wall_lum, WALL_LOOP['poster'] - WALL_LOOP['source_in'])
spill = lambda base, l: base * (FLOOR + (1 - FLOOR) * l)

# ---- the static composite: plate, projection, spills, television
out = plate.copy()
wv, wcov = warp(wall_poster, geom['wall'], W, H)
mask_full = cv2.resize(mask.astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
out = screen(out, wv, np.clip(mask_full, 0, 1) * WALL_OPACITY)
out = screen(out, resize(wall, W, H), np.full((H, W), spill(SPILL_WALL, wall_poster_lum)))
out = screen(out, resize(tv, W, H), np.full((H, W), spill(SPILL_TV, tv_poster_lum)))
tvv, tvcov = warp(tv_poster, geom['tv'], W, H)
out = out * (1 - tvcov[..., None]) + tvv * tvcov[..., None]

# ---- the two surfaces' luminance in the still (Rec. 709 weights on the display
# values), so a check can hold the projection below the television (V1.2)
def surface(q):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.int32([[x * W, y * H] for x, y in q])], 1)
    y = out[..., 0] * 0.2126 + out[..., 1] * 0.7152 + out[..., 2] * 0.0722
    return float(y[m > 0].mean())


surf = {'tv': round(surface(geom['tv']), 3), 'wall': round(surface(geom['wall']), 3)}

# ---- write
write(f'{A.out}/activation-plate.jpg', plate, 93)
write(f'{A.out}/activation-render.jpg', out, 93)
write(f'{A.out}/activation-spill-tv.jpg', tv, 90)
write(f'{A.out}/activation-spill-wall.jpg', wall, 90)
m8 = np.clip(mask * 255 + 0.5, 0, 255).astype(np.uint8)
cv2.imwrite(f'{A.out}/activation-wall-mask.png', np.dstack([np.full_like(m8, 255)] * 3 + [m8]), [cv2.IMWRITE_PNG_COMPRESSION, 9])

data = {
    '_readme': 'Written by scripts/render/activation-composite.py from the render passes (scripts/render/activation-booth.py): the screens\' corners (shares of the frame: top-left, top-right, bottom-right, bottom-left), the loops\' brightness over time (RATE samples a second, 0 to 1), the layer strengths the page composes with (the same the static composite used), and each surface\'s mean luminance in the still (the projection held below the television).',
    'aspect': [W, H],
    'tv': geom['tv'],
    'wall': geom['wall'],
    'wallOpacity': WALL_OPACITY,
    'spill': {'tv': SPILL_TV, 'wall': SPILL_WALL, 'floor': FLOOR},
    'surface': surf,
    'rate': RATE,
    'lum': {'tv': [round(x, 2) for x in tv_lum.tolist()], 'wall': [round(x, 2) for x in wall_lum.tolist()]},
}
with open(A.data, 'w') as fh:
    fh.write(json.dumps(data, separators=(',', ':')) + '\n')
print('ok', W, H, 'tv lum at poster', round(tv_poster_lum, 2), 'wall', round(wall_poster_lum, 2), 'mask max', round(float(mask.max()), 3), 'surfaces', surf)
