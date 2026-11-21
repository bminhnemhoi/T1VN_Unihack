#!/usr/bin/env python3
"""Compose the deck's raster visuals: device frames around real app screenshots, photo cards and press clippings.

Inputs live in assets/screens/live (screenshots of the running app, taken 21/11/2026), assets/photos (licensed
photographs, credits in assets/photos/CREDITS.md) and assets/news/raw (screenshots of the cited articles).
Outputs go to assets/mock. Nothing here draws a number: figures on the slides are text boxes in build_deck.py.

    pip install pillow
    python docs/pitch/slides/build/build_mockups.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
A = HERE / "assets"
OUT = A / "mock"
MONO = REPO / "video" / "public" / "fonts" / "IBMPlexMono-Medium.ttf"

INK, DEEP, IVORY, PAPER = (0x20, 0x1D, 0x1D), (0x15, 0x13, 0x13), (0xF4, 0xF0, 0xE8), (0xFB, 0xF9, 0xF4)
LINE_D, MUTE, LIME = (0x3A, 0x36, 0x36), (0xA3, 0x9D, 0x94), (0xA1, 0xFF, 0x62)


def _round(im: Image.Image, r: int) -> Image.Image:
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], r, fill=255)
    im.putalpha(mask)
    return im


def _shadow(im: Image.Image, *, blur=34, dy=22, alpha=64, pad=70) -> Image.Image:
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    a = im.getchannel("A").point(lambda v: v * alpha // 255)
    sh.paste(Image.new("RGBA", im.size, (21, 19, 19, 255)), (pad, pad + dy), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh)
    canvas.alpha_composite(im, (pad, pad))
    return canvas


def _cover(im: Image.Image, size: tuple[int, int], focus=(0.5, 0.5)) -> Image.Image:
    return ImageOps.fit(im.convert("RGB"), size, Image.Resampling.LANCZOS, centering=focus)


def browser(src: Path, out: str, *, width=1800, crop_h: int | None = None, label="HụiSafe · DEMO · Fuji",
            shadow=True) -> Path:
    im = Image.open(src).convert("RGB")
    if crop_h:
        im = im.crop((0, 0, im.width, min(im.height, crop_h)))
    im = im.resize((width, round(im.height * width / im.width)), Image.Resampling.LANCZOS)
    bar = round(width * 0.031)
    frame = Image.new("RGB", (width, im.height + bar), INK)
    d = ImageDraw.Draw(frame)
    r = bar * 0.16
    for i in range(3):
        cx = bar * 0.62 + i * bar * 0.48
        d.ellipse([cx - r, bar / 2 - r, cx + r, bar / 2 + r], fill=(0x5A, 0x55, 0x55))
    font = ImageFont.truetype(str(MONO), round(bar * 0.36))
    tw = d.textlength(label, font=font)
    pw, ph = tw + bar * 1.1, bar * 0.62
    px = (width - pw) / 2
    d.rounded_rectangle([px, (bar - ph) / 2, px + pw, (bar + ph) / 2], ph / 2, fill=LINE_D)
    d.text((width / 2, bar / 2), label, font=font, fill=MUTE, anchor="mm")
    frame.paste(im, (0, bar))
    res = _round(frame, round(width * 0.014))
    ImageDraw.Draw(res).rounded_rectangle([0, 0, res.width - 1, res.height - 1], round(width * 0.014), outline=INK,
                                          width=3)
    if shadow:
        res = _shadow(res)
    OUT.mkdir(parents=True, exist_ok=True)
    res.save(OUT / out, optimize=True)
    return OUT / out


def phone(src: Path, out: str, *, width=620, shadow=True) -> Path:
    im = Image.open(src).convert("RGB")
    im = im.resize((width, round(im.height * width / im.width)), Image.Resampling.LANCZOS)
    bez = round(width * 0.035)
    body = Image.new("RGBA", (width + 2 * bez, im.height + 2 * bez), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle([0, 0, body.width - 1, body.height - 1], round(width * 0.14), fill=INK)
    body.alpha_composite(_round(im, round(width * 0.105)), (bez, bez))
    if shadow:
        body = _shadow(body, blur=26, dy=18, alpha=70, pad=56)
    OUT.mkdir(parents=True, exist_ok=True)
    body.save(OUT / out, optimize=True)
    return OUT / out


def photo(src: Path, out: str, size: tuple[int, int], *, focus=(0.5, 0.5)) -> Path:
    """A cover-cropped photograph as JPEG; build_deck.py rounds its corners with the picture geometry."""
    im = _cover(Image.open(src), size, focus)
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / out, quality=88, optimize=True)
    return OUT / out


def clipping(src: Path, out: str, *, box: tuple[int, int, int, int] | None = None, width=1100, border=16) -> Path:
    """A press clipping: the cropped article screenshot on white paper with a thin edge and a soft shadow."""
    im = Image.open(src).convert("RGB")
    if box:
        im = im.crop(box)
    im = im.resize((width, round(im.height * width / im.width)), Image.Resampling.LANCZOS)
    paper = Image.new("RGB", (im.width + 2 * border, im.height + 2 * border), (255, 255, 255))
    paper.paste(im, (border, border))
    res = _round(paper, 10)
    ImageDraw.Draw(res).rounded_rectangle([0, 0, res.width - 1, res.height - 1], 10, outline=(0xDC, 0xD6, 0xCB),
                                          width=2)
    res = _shadow(res, blur=22, dy=14, alpha=110, pad=48)
    OUT.mkdir(parents=True, exist_ok=True)
    res.save(OUT / out, optimize=True)
    return OUT / out


def main() -> None:
    live = A / "screens" / "live"
    jobs = [
        (browser, live / "landing-hero.png", "landing-hero.png", {"width": 1800}),
        (browser, live / "landing-ledger.png", "landing-ledger.png", {"width": 1600}),
        (browser, live / "landing-cases.png", "landing-cases.png", {"width": 1600}),
        (browser, live / "d-circle.png", "d-circle.png", {"width": 1700}),
        (browser, live / "d-book.png", "d-book.png", {"width": 1700}),
        (browser, live / "d-cover.png", "d-cover.png", {"width": 1700}),
        (browser, A / "screens" / "d-room.png", "d-room.png", {"width": 1700}),
        (phone, A / "screens" / "m-home.png", "m-home.png", {}),
        (phone, A / "screens" / "m-room.png", "m-room.png", {}),
        (phone, A / "screens" / "m-book.png", "m-book.png", {}),
        (phone, A / "screens" / "m-result.png", "m-result.png", {}),
        (phone, A / "screens" / "m-invite.png", "m-invite.png", {}),
    ]
    for fn, src, out, kw in jobs:
        if src.exists():
            print("wrote", fn(src, out, **kw))
        else:
            print("skip (missing)", src)
    raw = A / "news" / "raw"
    for src in sorted(raw.glob("*.png")):
        print("wrote", clipping(src, f"clip-{src.stem}.png", width=1100))
    src = A / "photos" / "ben-thanh-market.jpg"
    if src.exists():
        print("wrote", photo(src, "photo-market.jpg", (1050, 1190), focus=(0.5, 0.5)))


if __name__ == "__main__":
    main()
