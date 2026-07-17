#!/usr/bin/env python3
"""Build frontend logo assets from shared/logo sources."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'shared' / 'logo'
PUBLIC = ROOT / 'apps' / 'frontend' / 'public'
ASSETS = ROOT / 'apps' / 'frontend' / 'src' / 'assets'

PNG = SRC / 'logo-logigo.png'
ICO = SRC / 'favicon.ico'


def crop_green_icon(img: Image.Image, pad: int = 4) -> Image.Image:
    rgba = img.convert('RGBA')
    w, h = rgba.size
    pixels = rgba.load()
    minx, miny, maxx, maxy = w, h, 0, 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 10 and g > 40 and g > r * 1.2:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)

    if minx >= maxx or miny >= maxy:
        return rgba

    minx = max(0, minx - pad)
    miny = max(0, miny - pad)
    maxx = min(w - 1, maxx + pad)
    maxy = min(h - 1, maxy + pad)
    return rgba.crop((minx, miny, maxx + 1, maxy + 1))


def to_square(im: Image.Image, size: int, fill: float = 0.88) -> Image.Image:
    cw, ch = im.size
    scale = min(size / cw, size / ch) * fill
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    square = Image.new('RGBA', (size, size), (0, 0, 0, 255))
    square.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return square


def main() -> None:
    if not PNG.exists():
        raise FileNotFoundError(f'Missing logo source: {PNG}')
    if not ICO.exists():
        raise FileNotFoundError(f'Missing favicon source: {ICO}')

    PUBLIC.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    cropped = crop_green_icon(Image.open(PNG))
    cropped.save(ASSETS / 'logo-display.png')

    shutil.copy2(ICO, PUBLIC / 'favicon.ico')
    favicon = Image.open(ICO).convert('RGBA')
    to_square(favicon, 32).save(PUBLIC / 'favicon-32.png')

    for size in (180, 192, 512):
        to_square(cropped, size).save(PUBLIC / f'icon-{size}.png')

    for size in (192, 512):
        to_square(cropped, size, fill=0.68).save(PUBLIC / f'icon-maskable-{size}.png')

    print('Synced logos from shared/logo → public + src/assets')


if __name__ == '__main__':
    main()
