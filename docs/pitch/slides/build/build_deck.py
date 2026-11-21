#!/usr/bin/env python3
"""Build the HuiSafe UniHack 2026 pitch deck (v2, 21/11/2026).

Every word on a slide is a real text box and every slide carries Vietnamese speaker notes; only charts, device
mockups, photographs and press clippings are images (built by build_charts.py and build_mockups.py into assets/).
Each slide has the project logo top-left and the competition lockup (UniHack 2026, Team1 Vietnam) top-right.
Figures come from docs/03, docs/05, docs/DEPLOY-FUJI.md, sim/outputs/*.json and the press articles listed in
appendix A; appendix A and B give the source of each number.

Rebuild (libraries live in a throwaway venv, never in the repo's package.json or pyproject):
    python -m venv .venv-slides && .venv-slides/bin/pip install -r docs/pitch/slides/build/requirements.txt
    python docs/pitch/slides/build/build_charts.py      # assets/charts/*.png
    python docs/pitch/slides/build/build_mockups.py     # assets/mock/*.png
    python docs/pitch/slides/build/build_deck.py        # HuiSafe-UniHack-2026.pptx
    bash docs/pitch/slides/build/render.sh              # pptx -> pdf -> preview/*.png (LibreOffice in Docker)

Fonts: Inter Tight + IBM Plex Mono (Google Fonts, OFL). Google Slides has both; install them locally to render.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import qrcode
from lxml import etree
from PIL import Image as PILImage
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

HERE = Path(__file__).resolve().parent
SLIDES_DIR = HERE.parent
ASSETS = HERE / "assets"
OUT = SLIDES_DIR / "HuiSafe-UniHack-2026.pptx"

SANS = "Inter Tight"
MONO = "IBM Plex Mono"

# Design tokens from apps/web/DESIGN.md section 1.
IVORY = RGBColor.from_string("F4F0E8")
PAPER = RGBColor.from_string("FBF9F4")
INK = RGBColor.from_string("201D1D")
DEEP = RGBColor.from_string("151313")
INK2 = RGBColor.from_string("5A5555")
LINE = RGBColor.from_string("DCD6CB")
LINE_D = RGBColor.from_string("3A3636")
MUTE = RGBColor.from_string("A39D94")
LIME = RGBColor.from_string("A1FF62")
RED_INK = RGBColor.from_string("C4271A")

W, H = 13.333, 7.5
ML = MR = 0.6
CW = W - ML - MR

APP_URL = "https://lamng.tail3abf4e.ts.net:8443"
REPO_URL = "https://github.com/bminhnemhoi/T1VN_Unihack"
SNOW = "https://testnet.snowtrace.io/address/"
FACTORY = "0x5004477143F8Db65f80992A0BD79c1DAb75C8b21"
CIRCLE_FIXED = "0xABA89dFfA4e157927710419b01C32bD307bF2461"
CIRCLE_DEFAULT = "0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc"
CIRCLE_WEB = "0xa42866012F1FbFE4507B87B2D2C9cc69D13F8f5a"

ALIGN = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}
ANCHOR = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}
RUN_KEYS = {"size", "color", "font", "bold", "italic", "spc", "link"}

TOTAL = 0  # set in build() from ORDER
TMP = Path(tempfile.mkdtemp(prefix="hui-slides-"))


# ---------------------------------------------------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------------------------------------------------


def _drop_style(shape) -> None:
    """Remove the theme style reference so no inherited shadow or font colour leaks into Google Slides."""
    st = shape._element.find(qn("p:style"))
    if st is not None:
        shape._element.remove(st)


def _norm(content):
    if isinstance(content, (str, dict)):
        content = [content]
    paras = []
    for p in content:
        if isinstance(p, str):
            paras.append({"runs": [{"text": p}]})
        elif isinstance(p, list):
            paras.append({"runs": [r if isinstance(r, dict) else {"text": r} for r in p]})
        else:
            d = dict(p)
            if "runs" not in d:
                d["runs"] = [{"text": d.pop("text")}]
            else:
                d["runs"] = [r if isinstance(r, dict) else {"text": r} for r in d["runs"]]
            paras.append(d)
    return paras


def _bullet(para, color, indent=0.28) -> None:
    """A real list bullet (a:buChar), so Google Slides and screen readers see a list, not a drawn square."""
    ppr = para._p.get_or_add_pPr()
    ppr.set("marL", str(int(Inches(indent))))
    ppr.set("indent", str(int(-Inches(indent))))
    clr = etree.SubElement(ppr, qn("a:buClr"))
    etree.SubElement(clr, qn("a:srgbClr")).set("val", str(color))
    etree.SubElement(ppr, qn("a:buSzPct")).set("val", "100000")
    etree.SubElement(ppr, qn("a:buFont")).set("typeface", "Arial")
    etree.SubElement(ppr, qn("a:buChar")).set("char", "•")


def _fill(tf, content, base: dict, pbase: dict) -> None:
    for i, p in enumerate(_norm(content)):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = ALIGN[p.get("align", pbase["align"])]
        para.line_spacing = p.get("ls", pbase["ls"])
        para.space_after = Pt(p.get("after", pbase["after"]))
        if "before" in p:
            para.space_before = Pt(p["before"])
        if p.get("bullet", pbase.get("bullet")):
            _bullet(para, p.get("bullet_color", pbase.get("bullet_color") or INK))
        prun = {**base, **{k: v for k, v in p.items() if k in RUN_KEYS}}
        for r in p["runs"]:
            o = {**prun, **r}
            run = para.add_run()
            run.text = o["text"]
            f = run.font
            f.name = o["font"]
            f.size = Pt(o["size"])
            f.bold = bool(o["bold"])
            f.italic = bool(o.get("italic", False))
            f.color.rgb = o["color"]
            rpr = run._r.get_or_add_rPr()
            rpr.set("lang", "vi-VN")
            if o.get("spc"):
                rpr.set("spc", str(int(o["spc"])))
            if o.get("link"):
                run.hyperlink.address = o["link"]


def text(slide, x, y, w, h, content, *, size=16, color=INK, font=SANS, bold=False, align="l", anchor="t", ls=1.2,
         after=0, spc=None, name=None, bullet=False, bullet_color=None):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = ANCHOR[anchor]
    _fill(tf, content, dict(size=size, color=color, font=font, bold=bold, italic=False, spc=spc, link=None),
          dict(align=align, ls=ls, after=after, bullet=bullet, bullet_color=bullet_color))
    if name:
        box.name = name
    return box


def rect(slide, x, y, w, h, *, fill=None, line=None, lw=0.75, radius=None, dash=None, name=None):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    _drop_style(s)
    if radius:
        s.adjustments[0] = min(0.5, radius / min(w, h))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(lw)
        if dash:
            s.line.dash_style = dash
    s.shadow.inherit = False
    if name:
        s.name = name
    return s


def oval(slide, x, y, d, *, fill=INK, line=None, lw=0.75):
    s = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    _drop_style(s)
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(lw)
    s.shadow.inherit = False
    return s


def connector(slide, x1, y1, x2, y2, *, color=INK, lw=1.25, head=True, tail=False, dash=None):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    _drop_style(c)
    c.line.color.rgb = color
    c.line.width = Pt(lw)
    if dash:
        c.line.dash_style = dash
    ln = c.line._get_or_add_ln()
    if tail:
        he = etree.SubElement(ln, qn("a:headEnd"))
        he.set("type", "triangle"), he.set("w", "med"), he.set("len", "med")
    if head:
        te = etree.SubElement(ln, qn("a:tailEnd"))
        te.set("type", "triangle"), te.set("w", "med"), te.set("len", "med")
    return c


def rule(slide, x1, y1, x2, y2, *, color=LINE, lw=1.0, dotted=False):
    return connector(slide, x1, y1, x2, y2, color=color, lw=lw, head=False,
                     dash=MSO_LINE_DASH_STYLE.ROUND_DOT if dotted else None)


def picture(slide, path, x, y, *, w=None, h=None, radius=None, border=None, bw=1.0, link=None, alt=None):
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w) if w else None, Inches(h) if h else None)
    if alt:
        pic._element.nvPicPr.cNvPr.set("descr", alt)
        pic.name = alt[:60]
    if radius:
        prst = pic._element.spPr.find(qn("a:prstGeom"))
        prst.set("prst", "roundRect")
        av = prst.find(qn("a:avLst"))
        if av is None:
            av = etree.SubElement(prst, qn("a:avLst"))
        for g in list(av):
            av.remove(g)
        adj = int(min(50000, Inches(radius) / min(pic.width, pic.height) * 100000))
        gd = etree.SubElement(av, qn("a:gd"))
        gd.set("name", "adj"), gd.set("fmla", f"val {adj}")
    if border is not None:
        pic.line.color.rgb = border
        pic.line.width = Pt(bw)
    if link:
        pic.click_action.hyperlink.address = link
    return pic


def qr(slide, url, x, y, size, *, pad_fill=PAPER):
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=2)
    code.add_data(url)
    code.make(fit=True)
    img = code.make_image(fill_color=(0x20, 0x1D, 0x1D), back_color=(0xFB, 0xF9, 0xF4)).convert("RGB")
    path = TMP / f"qr-{abs(hash(url))}.png"
    img.save(path)
    rect(slide, x, y, size, size, fill=pad_fill, radius=0.06)
    return picture(slide, path, x + 0.04, y + 0.04, w=size - 0.08, h=size - 0.08, link=url, alt=f"Mã QR tới {url}")


def _cell_borders(cell, sides: dict) -> None:
    tcpr = cell._tc.get_or_add_tcPr()
    for tag in ("a:lnL", "a:lnR", "a:lnT", "a:lnB"):
        for old in tcpr.findall(qn(tag)):
            tcpr.remove(old)
    for i, side in enumerate(("L", "R", "T", "B")):
        color, width = sides.get(side, (None, 0))
        ln = etree.Element(qn(f"a:ln{side}"))
        ln.set("w", str(int(Pt(width))) if color is not None else "0")
        ln.set("cap", "flat"), ln.set("cmpd", "sng"), ln.set("algn", "ctr")
        if color is None:
            etree.SubElement(ln, qn("a:noFill"))
        else:
            sf = etree.SubElement(ln, qn("a:solidFill"))
            clr = etree.SubElement(sf, qn("a:srgbClr"))
            clr.set("val", str(color))
            dash = etree.SubElement(ln, qn("a:prstDash"))
            dash.set("val", "solid")
        tcpr.insert(i, ln)


def table(slide, x, y, widths, rows, *, size=15, head_size=11, row_h=0.5, head_h=0.4, font=SANS, num_cols=(),
          dark=False, hi_col=None, bold_cols=(), align=None, pad=0.1, color=None, head_color=None, rule_color=None):
    """A borderless table with one rule under each row. Row 0 is the header (mono labels)."""
    n_rows, n_cols = len(rows), len(widths)
    gf = slide.shapes.add_table(n_rows, n_cols, Inches(x), Inches(y), Inches(sum(widths)),
                                Inches(head_h + row_h * (n_rows - 1)))
    tbl_el = gf._element.graphic.graphicData.tbl
    tblpr = tbl_el.tblPr
    tblpr.set("firstRow", "0")
    tblpr.set("bandRow", "0")
    sid = tblpr.find(qn("a:tableStyleId"))
    if sid is None:
        sid = etree.SubElement(tblpr, qn("a:tableStyleId"))
    sid.text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"  # "No Style, No Grid"
    tbl = gf.table
    for i, wv in enumerate(widths):
        tbl.columns[i].width = Inches(wv)
    for r in range(n_rows):
        tbl.rows[r].height = Inches(head_h if r == 0 else row_h)
    fg = color or (IVORY if dark else INK)
    hc = head_color or (MUTE if dark else INK2)
    rc = rule_color or (LINE_D if dark else LINE)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = tbl.cell(r, c)
            cell.margin_left = cell.margin_right = Inches(pad)
            cell.margin_top = Inches(0.06)
            cell.margin_bottom = Inches(0.06)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            hi = hi_col is not None and c == hi_col
            if hi and r == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = LIME
            elif hi:
                cell.fill.solid()
                cell.fill.fore_color.rgb = INK if dark else PAPER
            else:
                cell.fill.background()
            tf = cell.text_frame
            tf.word_wrap = True
            a = (align[c] if align else ("r" if c in num_cols else "l"))
            if r == 0:
                _fill(tf, val, dict(size=head_size, color=(INK if hi else hc), font=MONO, bold=hi, italic=False,
                                    spc=40, link=None), dict(align=a, ls=1.1, after=0))
            else:
                fnt = MONO if c in num_cols else font
                _fill(tf, val, dict(size=size, color=fg, font=fnt, bold=(c in bold_cols or hi), italic=False,
                                    spc=None, link=None), dict(align=a, ls=1.15, after=0))
            bottom = (INK if not dark else MUTE, 1.0) if r == 0 else (rc, 0.75)
            _cell_borders(cell, {"B": bottom})
    return gf


def bg(slide, color) -> None:
    f = slide.background.fill
    f.solid()
    f.fore_color.rgb = color


def notes(slide, body: str) -> None:
    slide.notes_slide.notes_text_frame.text = body

# ---------------------------------------------------------------------------------------------------------------------
# Deck chrome: project logo top-left, competition lockup top-right, kicker, title, footer
# ---------------------------------------------------------------------------------------------------------------------

BRAND = ASSETS / "brand"
MOCK = ASSETS / "mock"
CHARTS = ASSETS / "charts"
TEAM = ASSETS / "team"
NEWS_FILE = ASSETS / "news" / "news.json"

# Public link of the 2-3 minute demo video. Leave empty until the video is uploaded: the closing slide then shows
# three QR codes instead of four and no placeholder text.
VIDEO_URL = ""

NUM: dict[str, int] = {}
Y0 = 2.2  # top of the content area on a normal slide


def topbar(slide, *, dark=False) -> None:
    fg = IVORY if dark else INK
    lh = 0.36
    lw = lh * 1408 / 904
    picture(slide, BRAND / "huisafe-logo.png", ML, 0.26, w=lw, h=lh, alt="Logo HụiSafe: lá thăm có đồng xu chữ U")
    text(slide, ML + lw + 0.12, 0.26, 2.0, lh, "HụiSafe", size=17, bold=True, color=fg, anchor="m", spc=-20)
    tw = 1.62
    th = tw * 199 / 1800
    picture(slide, BRAND / ("team1vietnam-white-lg.png" if dark else "team1vietnam-ink-lg.png"), W - MR - tw,
            0.26 + (lh - th) / 2, w=tw, h=th, alt="Logo Team1 Vietnam, ban tổ chức UniHack 2026")
    rule(slide, W - MR - tw - 0.17, 0.31, W - MR - tw - 0.17, 0.57, color=(LINE_D if dark else MUTE), lw=1)
    text(slide, W - MR - tw - 0.34 - 1.7, 0.26, 1.7, lh, "UNIHACK 2026", size=11, font=MONO, bold=True, color=fg,
         align="r", anchor="m", spc=120)


def header(slide, key, kicker, title, *, chip=None, dark=False, title_size=28):
    topbar(slide, dark=dark)
    kc = MUTE if dark else INK2
    text(slide, ML, 0.84, 8.6, 0.3, f"{NUM[key]:02d} · {kicker}", size=11, font=MONO, color=kc, spc=90)
    if chip:
        cw = 0.36 + 0.0875 * len(chip)
        cx = W - MR - cw
        rect(slide, cx, 0.78, cw, 0.34, line=(LINE_D if dark else LINE), lw=1, radius=0.06)
        text(slide, cx, 0.78, cw, 0.34, chip, size=10.5, font=MONO, color=kc, align="c", anchor="m")
    text(slide, ML, 1.12, CW, 0.95, title, size=title_size, bold=True, color=(IVORY if dark else INK), ls=1.06)


def footer(slide, key, *, dark=False, source=None):
    c = MUTE if dark else INK2
    if source:
        text(slide, ML, 6.44, CW, 0.5, source, size=9.5, font=MONO, color=c, ls=1.2, anchor="b")
    text(slide, ML, 7.06, 6.0, 0.22, "HụiSafe · Team1 Vietnam UniHack 2026", size=10, font=MONO, color=c)
    text(slide, W - MR - 2.0, 7.06, 2.0, 0.22, f"{NUM[key]:02d} / {TOTAL:02d}", size=10, font=MONO, color=c, align="r")


def tune_theme(prs) -> None:
    """Theme fonts -> Inter Tight; hyperlink colours -> ink, so linked words keep the deck's colour."""
    part = prs.slide_masters[0].part.part_related_by(RT.THEME)
    root = etree.fromstring(part.blob)
    ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
    for tag in ("majorFont", "minorFont"):
        root.find(f".//a:{tag}/a:latin", ns).set("typeface", SANS)
    for tag in ("hlink", "folHlink"):
        el = root.find(f".//a:clrScheme/a:{tag}", ns)
        for ch in list(el):
            el.remove(ch)
        clr = etree.SubElement(el, qn("a:srgbClr"))
        clr.set("val", "201D1D")
    part._blob = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def new_slide(prs, color=IVORY):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg(s, color)
    return s


def numbered_dot(slide, x, y, label, *, fill=LIME, color=INK, d=0.36, size=12):
    oval(slide, x, y, d, fill=fill)
    text(slide, x, y, d, d, label, size=size, font=MONO, bold=True, color=color, align="c", anchor="m")


def mock(slide, name, x, y, w, *, pad, alt, rot=0.0):
    """Place a composed mockup so that its visible frame (inside the baked shadow padding) sits at x, y, width w."""
    path = MOCK / name
    with PILImage.open(path) as im:
        iw, ih = im.size
    k = w / (iw - 2 * pad)
    pic = picture(slide, path, x - pad * k, y - pad * k, w=iw * k, h=ih * k, alt=alt)
    if rot:
        pic.rotation = rot
    return (ih - 2 * pad) * k


PAD_BROWSER, PAD_PHONE, PAD_CLIP = 70, 56, 48


def load_news() -> dict:
    if NEWS_FILE.exists():
        return json.loads(NEWS_FILE.read_text("utf-8"))
    return {}


# ---------------------------------------------------------------------------------------------------------------------
# Slides
# ---------------------------------------------------------------------------------------------------------------------


def s_cover(prs):
    s = new_slide(prs)
    topbar(s)
    text(s, ML, 1.32, 6.2, 0.3, "TRACK SOCIAL FINANCE · ĐỀ #01 HỤI ON-CHAIN (ROSCA)", size=11, font=MONO, color=INK2,
         spc=90)
    text(s, ML, 1.62, 6.4, 1.45, "HụiSafe", size=92, bold=True, anchor="m", ls=1.0, spc=-250)
    text(s, ML, 3.2, 6.0, 1.15, ["Chủ hụi không cầm tiền,", "nhưng vẫn phải bảo lãnh."], size=30, bold=True, ls=1.12)
    text(s, ML, 4.5, 5.0, 1.2, "Hụi bỏ thăm chạy bằng smart contract trên Avalanche. Tiền góp nằm trong ví từng "
         "người tới đúng lúc chi; ký quỹ của chủ hụi khóa sẵn để bù khi có người bỏ đóng.", size=15, color=INK2,
         ls=1.3)
    mock(s, "landing-hero.png", 6.75, 1.18, 6.95, pad=PAD_BROWSER,
         alt="Ảnh chụp landing page HụiSafe: Chơi hụi không sợ giựt")
    mock(s, "m-room.png", 6.12, 2.82, 1.42, pad=PAD_PHONE, alt="Ảnh chụp app trên điện thoại: phòng bỏ thăm")
    rect(s, 0, 6.0, W, H - 6.0, fill=DEEP)
    groups = [
        ("TỔ CHỨC", "team1vietnam-white-lg.png", ML, 2.05, 2.05 * 199 / 1800, "Logo Team1 Vietnam"),
        ("MẠNG", "avalanche-ko.png", 3.35, 1.95, 1.95 * 271 / 1835, "Logo Avalanche"),
        ("NHÀ TÀI TRỢ", "mexc-ventures.png", 6.0, 0.74 * 353 / 400, 0.74, "Logo MEXC Ventures"),
    ]
    for label, img, x, lw, lh, alt in groups:
        text(s, x, 6.2, 2.4, 0.24, label, size=9.5, font=MONO, color=MUTE, spc=90)
        picture(s, BRAND / img, x, 6.52 + (0.74 - lh) / 2, w=lw, h=lh, alt=alt)
    bx = 7.75
    rect(s, bx, 6.22, W - MR - bx, 1.02, line=LIME, lw=1, radius=0.08)
    text(s, bx + 0.22, 6.22, W - MR - bx - 0.44, 1.02, [
        {"text": "KHAI BÁO CHẾ ĐỘ DEMO", "font": MONO, "size": 10, "color": LIME, "bold": True, "spc": 90},
        "Chạy trên Avalanche Fuji testnet, thời gian tua nhanh, USDC thử nghiệm không có giá trị. Chi tiết ở trang 2.",
    ], size=12.5, color=IVORY, anchor="m", ls=1.22, after=3)
    notes(s, "Chào ban giám khảo. Chúng em là đội HụiSafe, dự thi track Social finance với đề số 1, hụi on-chain. "
             "Trước hết, chúng em xin khai báo: bản demo chạy trên Avalanche Fuji testnet, thời gian được tua nhanh và "
             "tiền là USDC thử nghiệm. HụiSafe là hụi bỏ thăm chạy bằng smart contract trên Avalanche: tiền góp nằm "
             "trong ví của từng thành viên cho tới đúng lúc chi, còn chủ hụi phải khóa một khoản ký quỹ để bù khi có "
             "người bỏ đóng. Một câu: chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.")


def s_demo(prs):
    s = new_slide(prs)
    header(s, "demo", "KHAI BÁO CHẾ ĐỘ DEMO", "Bản demo chạy trên Fuji testnet và tua nhanh thời gian; trần lãi vẫn "
           "tính như hụi tháng", chip="Luật BTC: dev toggle")
    rows = [
        ["", "BẢN DEMO", "DÂY THẬT"],
        ["Một kỳ hụi", "2 phút: 75 giây nộp thăm kín, 45 giây mở thăm", "30 ngày"],
        ["Ân hạn khi đóng trễ", "1 phút", "48 giờ"],
        ["Chủ hụi chưa khui kỳ thì keeper khui thay sau", "5 phút", "24 giờ"],
        ["Kỳ dùng để tính trần lãi, lãi chậm góp", "30 ngày", "30 ngày"],
    ]
    table(s, ML, Y0 - 0.05, [5.6, 4.6, 1.93], rows, size=16, row_h=0.56, head_h=0.4, bold_cols=(1,))
    rect(s, ML, 5.42, CW, 0.86, fill=LIME, radius=0.06)
    text(s, ML + 0.3, 5.42, CW - 0.6, 0.86, "Tiền trong demo là USDC thử nghiệm, không có giá trị. Phí mạng do "
         "relayer HụiSafe trả. HụiSafe không sinh lãi và không có token.", size=17, bold=True, anchor="m", ls=1.25)
    footer(s, "demo", source="Nguồn: docs/03 mục 3.3; docs/05 mục 9. Hai dây chạy ngày 11/11/2026 dùng kỳ 3 phút, ân "
                             "hạn 2 phút.")
    notes(s, "Trước khi bắt đầu, chúng em xin khai báo dev toggle. Bản demo chạy trên Avalanche Fuji testnet và tua "
             "nhanh thời gian: mỗi kỳ hụi chỉ 2 phút, gồm 75 giây nộp thăm kín và 45 giây mở thăm, thay vì 30 ngày. "
             "Ân hạn đóng trễ là 1 phút thay vì 48 giờ. Chủ hụi khui kỳ; quá 5 phút mà chủ hụi chưa khui thì keeper "
             "khui thay. Trần lãi và lãi chậm góp vẫn tính như kỳ 30 ngày. Tiền trong demo là USDC thử nghiệm, không "
             "có giá trị, và phí mạng do relayer HụiSafe trả. Sản phẩm không sinh lãi và không có token.")


def s_idea(prs):
    s = new_slide(prs)
    header(s, "idea", "Ý TƯỞNG", "HụiSafe bỏ việc giữ tiền của chủ hụi nhưng giữ lại việc bảo lãnh",
           chip="Creativity & Innovation")
    cw = (CW - 0.3) / 2
    jobs = [
        ("VIỆC 1 CỦA CHỦ HỤI", "Giữ tiền góp", "BỎ", "Tiền nằm trong ví của từng thành viên tới đúng lúc chi. "
         "Không ai cầm hũ giữa các kỳ.", False),
        ("VIỆC 2 CỦA CHỦ HỤI", "Bảo lãnh khi có người bỏ đóng", "GIỮ", "Chủ hụi khóa ký quỹ trong smart contract. "
         "Đúng trách nhiệm NĐ 19/2019 Điều 18 khoản 4 đã giao.", True),
    ]
    for i, (label, title, verdict, body, keep) in enumerate(jobs):
        x = ML + i * (cw + 0.3)
        rect(s, x, Y0, cw, 1.42, fill=(LIME if keep else PAPER), line=(None if keep else LINE), lw=1, radius=0.1)
        text(s, x + 0.25, Y0 + 0.16, cw - 1.6, 0.24, label, size=10, font=MONO, color=(INK if keep else INK2), spc=80)
        text(s, x + 0.25, Y0 + 0.42, cw - 1.5, 0.4, title, size=20, bold=True)
        text(s, x + 0.25, Y0 + 0.84, cw - 0.5, 0.52, body, size=13, color=(INK if keep else INK2), ls=1.18)
        rect(s, x + cw - 1.1, Y0 + 0.18, 0.85, 0.36, fill=(INK if keep else None), line=(None if keep else RED_INK),
             lw=1.25, radius=0.06)
        text(s, x + cw - 1.1, Y0 + 0.18, 0.85, 0.36, verdict, size=11, font=MONO, bold=True,
             color=(LIME if keep else RED_INK), align="c", anchor="m", spc=80)
    rows = [
        ["", "HỤI TRUYỀN THỐNG", "HỤI ON-CHAIN THÔNG THƯỜNG", "HỤISAFE"],
        ["Ai giữ tiền góp", "Chủ hụi", "Smart contract, theo luật cố định", "Ví của từng người, tới đúng lúc chi"],
        ["Ai bù khi người đã hốt bỏ đóng", "Chủ hụi, nếu còn tiền", "Không ai: người hốt sau chịu",
         "Ký quỹ của chủ hụi, khóa trong smart contract"],
        ["Rủi ro lớn nhất", "Chủ hụi ôm tiền, lập hụi viên ảo", "Người đã hốt bỏ đóng",
         f"Người đã hốt bỏ đóng lần lượt, vượt ký quỹ (trang {NUM['limits']})"],
    ]
    table(s, ML, 3.86, [2.75, 2.9, 3.05, 3.43], rows, size=15, row_h=0.68, head_h=0.42, hi_col=3, bold_cols=(0,))
    footer(s, "idea", source="Nguồn: docs/03 (luận điểm thiết kế ở đầu file); docs/10 mục 1.")
    notes(s, "Chủ hụi truyền thống có hai vai. Vai thứ nhất là giữ tiền, và đây là gốc của các vụ ôm tiền hay lập hụi "
             "viên ảo. Vai thứ hai là bảo lãnh: Nghị định 19 Điều 18 khoản 4 giao cho chủ hụi trách nhiệm bù khi "
             "người đã hốt không đóng. Các bản hụi on-chain thông thường bỏ cả hai vai, nên khi người hốt trước bỏ "
             "đóng thì không còn ai bù cho người hốt sau. HụiSafe giữ lại đúng vai bảo lãnh: chủ hụi không cầm tiền "
             "góp, nhưng phải khóa ký quỹ trong smart contract để bù. Rủi ro còn lại của HụiSafe chúng em nói ở phần "
             "giới hạn.")


def s_product(prs):
    s = new_slide(prs)
    header(s, "product", "SẢN PHẨM", "Một web app chơi hụi bỏ thăm: đăng nhập bằng Google, không cần ví crypto, "
           "không cần AVAX", chip="UI/UX & Demo")
    items = [
        ("Đăng nhập là có ví", "Google hoặc email. Relayer trả phí mạng, thành viên chỉ ký."),
        ("Một giao dịch mỗi kỳ", "Smart contract kéo tiền góp và chi cho người hốt trong cùng một giao dịch."),
        ("Thấy rủi ro trước khi vào", "Chỉ số bảo chứng hiện ở lời mời; mọi khoản tiền vào sổ hụi công khai."),
    ]
    for i, (t, b) in enumerate(items):
        y = Y0 + 0.08 + i * 1.08
        numbered_dot(s, ML, y + 0.02, str(i + 1))
        text(s, ML + 0.55, y - 0.02, 3.9, 0.36, t, size=17, bold=True)
        text(s, ML + 0.55, y + 0.36, 3.9, 0.62, b, size=14, color=INK2, ls=1.22)
    text(s, ML, 5.62, 4.6, 0.3, [[{"text": "Chạy thử: ", "color": INK2},
                                   {"text": "lamng.tail3abf4e.ts.net:8443", "link": APP_URL, "bold": True}]],
         size=12.5, font=MONO)
    h = mock(s, "d-room.png", 5.45, Y0 + 0.02, 6.55, pad=PAD_BROWSER,
             alt="Ảnh chụp app trên máy tính: phòng bỏ thăm kỳ 3 của dây mẫu, dữ liệu mẫu")
    mock(s, "m-result.png", 11.25, Y0 + 0.62, 1.52, pad=PAD_PHONE,
         alt="Ảnh chụp app trên điện thoại: kết quả kỳ 2, dữ liệu mẫu")
    footer(s, "product", source="Ảnh chụp app, dữ liệu mẫu (dây 5 người × 100 USDC theo docs/03 mục 8). Máy tính: "
                                "phòng bỏ thăm kỳ 3. Điện thoại: kết quả kỳ 2.")
    notes(s, "HụiSafe là web app. Thành viên đăng nhập bằng Google hoặc email, ví được tạo sẵn, không cần mua AVAX. Mỗi "
             "kỳ, smart contract kéo tiền góp từ ví từng người và chi cho người hốt trong cùng một giao dịch, nên giữa "
             "các kỳ không ai cầm tiền. Trước khi vào dây, thành viên thấy chỉ số bảo chứng; sau mỗi kỳ, sổ hụi ghi "
             "lại từng đồng. Ảnh trên slide chụp từ app với dữ liệu mẫu theo ví dụ trong đặc tả; bản đang chạy trên Fuji "
             "ở địa chỉ ghi trên slide.")
    return h


def s_landing(prs):
    s = new_slide(prs)
    header(s, "landing", "LANDING PAGE", "Trang giới thiệu kể một kỳ hụi bằng tình huống bấm thử được và sổ cái thật "
           "trên Fuji", chip="UI/UX & Demo")
    mock(s, "landing-cases.png", ML + 0.05, Y0 + 0.12, 5.3, pad=PAD_BROWSER, rot=-1.6,
         alt="Ảnh chụp landing page: năm tình huống thường gặp, bấm thử được")
    mock(s, "landing-ledger.png", 4.45, Y0 + 0.66, 5.3, pad=PAD_BROWSER, rot=1.2,
         alt="Ảnh chụp landing page: sổ cái hai dây đã chạy thật trên Fuji")
    caps = [
        ("5 tình huống bấm thử", "Hốt sớm, có người bỏ đóng, chủ hụi dùng ví ảo: số tính bằng đúng công thức của "
         "smart contract."),
        ("Sổ cái thật", "Hai dây đã chạy trọn trên Fuji, mỗi dòng mở được giao dịch trên Snowtrace."),
        ("Ai cũng dùng được", "Tiếng Việt, ưu tiên điện thoại, có chế độ chữ lớn và giảm chuyển động."),
    ]
    for i, (t, b) in enumerate(caps):
        y = Y0 + 0.12 + i * 1.36
        numbered_dot(s, 10.15, y, str(i + 1), d=0.32, size=11)
        text(s, 10.6, y - 0.02, 2.15, 0.36, t, size=14, bold=True, anchor="m")
        text(s, 10.6, y + 0.4, 2.13, 0.9, b, size=11, color=INK2, ls=1.22)
    footer(s, "landing", source="Ảnh chụp bản đang chạy ngày 21/11/2026 (lamng.tail3abf4e.ts.net:8443). Kiểm thử giao "
                                "diện bằng Playwright, gồm kiểm khả năng truy cập bằng axe (docs/09).")
    notes(s, "Landing page không chỉ giới thiệu. Người mới bấm thử năm tình huống thường gặp, ví dụ muốn hốt sớm thì "
             "sao, có người hốt rồi bỏ đóng thì sao, và con số hiện ra được tính bằng đúng công thức của smart "
             "contract. Bên dưới là sổ cái của hai dây đã chạy trọn trên Fuji, mỗi dòng mở được giao dịch trên "
             "Snowtrace. Giao diện tiếng Việt, ưu tiên điện thoại, có chế độ chữ lớn.")


def s_ux(prs):
    s = new_slide(prs)
    header(s, "ux", "TRẢI NGHIỆM", "Người mới vào dây bằng tài khoản Google, không phải cài ví hay mua AVAX",
           chip="UI/UX & Demo")
    items = [
        "Đăng nhập Google hoặc email, ví Privy được tạo sẵn.",
        "Relayer trả phí mạng: thành viên chỉ ký, ví không cần AVAX.",
        "Ví phải đủ tiền góp một kỳ mới được vào dây.",
        "Thẻ “Kỳ này của bạn” báo trước khi quyền trích không đủ.",
        "Chủ hụi có bàn khui kỳ: thấy trước ai hốt, ai chưa đủ tiền.",
        "Sổ hụi in được; tất toán xong có cột Ròng cho từng người.",
    ]
    text(s, ML, Y0 + 0.05, 5.6, 4.0, items, size=16, ls=1.2, after=12, bullet=True)
    pw, gap = 1.72, 0.3
    x0 = W - MR - (3 * pw + 2 * gap) - 0.05
    for i, (img, label) in enumerate([("m-home.png", "Việc cần làm"), ("m-room.png", "Phòng bỏ thăm"),
                                      ("m-book.png", "Sổ hụi")]):
        x = x0 + i * (pw + gap)
        h = mock(s, img, x, Y0 + (0.22 if i == 1 else 0.0), pw, pad=PAD_PHONE,
                 alt=f"Ảnh chụp app trên điện thoại: {label.lower()}, dữ liệu mẫu")
        text(s, x - 0.1, Y0 + (0.22 if i == 1 else 0.0) + h + 0.08, pw + 0.2, 0.24, label, size=10.5, font=MONO,
             color=INK2, align="c")
    footer(s, "ux", source="Ảnh chụp app, dữ liệu mẫu. Bàn khui kỳ và thẻ “Kỳ này của bạn” chỉ hiện khi đăng nhập vào "
                           "dây thật.")
    notes(s, "Về trải nghiệm: người mới đăng nhập bằng Google hoặc email và có ví ngay, không phải ghi seed phrase. "
             "Relayer trả phí mạng nên thành viên chỉ ký, ví không cần AVAX. App kiểm số dư trước: ví phải đủ "
             "tiền góp một kỳ mới được vào dây. Mỗi kỳ, thẻ “Kỳ này của bạn” ghi kỳ này phải góp bao nhiêu và báo "
             "trước nếu quyền trích không đủ. Chủ hụi có bàn khui kỳ, thấy trước ai hốt và ai chưa đủ tiền. Sổ hụi in "
             "được; khi dây tất toán xong có cột Ròng cho biết mỗi người được hay mất bao nhiêu.")


def s_round(prs):
    s = new_slide(prs)
    header(s, "round", "MỘT KỲ HỤI", "Tới hạn, một giao dịch làm hết việc của kỳ: kéo tiền góp, bù khoản thiếu, chi "
           "cho người hốt", chip="Technical Implementation")
    steps = [
        ("Vào dây", "Ký một lần cho cả dây (permit EIP-2612). Tiền vẫn nằm trong ví mình."),
        ("Thăm kín", "Nộp mã băm của thăm, hết giờ mới mở. Thăm cao nhất thắng."),
        ("Khui kỳ", "Chủ hụi bấm khui. Chủ hụi vắng thì keeper hay bất kỳ ai cũng gọi được."),
        ("Kéo, bù, chi", f"Smart contract kéo tiền góp, bù ngay khoản thiếu (trang {NUM['cascade']}), chi cho người "
                         "hốt."),
        ("Sổ hụi", "Mỗi dòng sổ có mã giao dịch, ai cũng mở được trên Snowtrace."),
    ]
    bw, gap, by, bh = 2.15, (CW - 5 * 2.15) / 4, Y0 + 0.05, 2.95
    for i, (title, body) in enumerate(steps):
        bx = ML + i * (bw + gap)
        hi = i == 3
        rect(s, bx, by, bw, bh, fill=(LIME if hi else PAPER), line=(None if hi else LINE), lw=1, radius=0.1)
        text(s, bx + 0.2, by + 0.2, bw - 0.4, 0.3, f"{i + 1:02d}", size=12, font=MONO, color=(INK if hi else INK2),
             bold=True)
        text(s, bx + 0.2, by + 0.5, bw - 0.4, 0.45, title, size=19, bold=True)
        text(s, bx + 0.2, by + 0.98, bw - 0.4, 1.9, body, size=15.5, ls=1.22)
        if i < 4:
            connector(s, bx + bw + 0.05, by + bh / 2, bx + bw + gap - 0.05, by + bh / 2, lw=1.5)
    text(s, ML, 5.42, CW, 0.9, [
        "Không có yếu tố ngẫu nhiên: bằng thăm thì ai ít lần trễ hơn thắng, rồi tới ai nộp trước.",
        "Trần thăm theo NĐ 19/2019 Điều 21 chạy trong smart contract; công thức là cách hiểu của nhóm, cần luật sư "
        "xác nhận.",
    ], size=15, color=INK2, ls=1.25, after=4)
    footer(s, "round", source="Nguồn: docs/03 mục 2.4, 6.2 đến 6.5; docs/05 mục 9 (lượt khui của chủ hụi).")
    notes(s, "Một kỳ hụi đi qua năm bước. Lúc vào dây, thành viên ký một lần cho phép dây trích tiền góp theo từng "
             "kỳ; tiền vẫn ở ví của họ. Mỗi kỳ, ai muốn hốt thì nộp thăm kín, tức là chỉ nộp mã băm, hết giờ mới mở. "
             "Thăm cao nhất thắng; bằng nhau thì ai ít lần trễ hơn thắng, rồi tới ai nộp trước, không bốc thăm. Hết "
             "giờ, chủ hụi bấm khui; chủ hụi vắng thì keeper hay bất kỳ ai cũng gọi được. Một giao dịch duy nhất kéo "
             "tiền góp, bù khoản thiếu và chi cho người hốt. Mọi bước đều vào sổ hụi kèm mã giao dịch.")


def s_cascade(prs):
    s = new_slide(prs)
    header(s, "cascade", "KHI CÓ NGƯỜI BỎ ĐÓNG", "Thành viên 4 không đủ tiền ở kỳ 2, người hốt vẫn nhận đủ",
           chip="Creativity & Innovation")
    lw_ = 5.55
    text(s, ML, Y0 - 0.02, lw_, 0.62, "Tới hạn mà không trích được tiền, smart contract bù ngay trong giao dịch khui "
         "kỳ, lần lượt từ bốn nguồn:", size=15.5, color=INK2, ls=1.22)
    tiers = [
        ("Tiền giữ lại của chính người thiếu", "8 USDC", True),
        ("Ký quỹ của chủ hụi", "2 USDC", True),
        ("Quỹ dự phòng", "0", False),
        ("Ghi khoản đòi công khai", "0", False),
    ]
    for i, (label, amt, used) in enumerate(tiers):
        x = ML + i * 0.24
        w = lw_ - i * 0.24
        y = Y0 + 0.78 + i * 0.72
        rect(s, x, y, w, 0.6, fill=(LIME if used else PAPER), line=(None if used else LINE), lw=1, radius=0.08)
        text(s, x + 0.2, y, 0.36, 0.6, str(i + 1), size=12, font=MONO, bold=True, color=(INK if used else INK2),
             anchor="m")
        text(s, x + 0.55, y, w - 1.95, 0.6, label, size=15, bold=used, color=(INK if used else INK2), anchor="m")
        text(s, x + w - 1.4, y, 1.22, 0.6, amt, size=18, font=MONO, bold=True, color=(INK if used else INK2),
             align="r", anchor="m")
    text(s, ML, 5.95, lw_, 0.4, [[{"text": "Ký quỹ sau từng kỳ: ", "color": INK2},
                                   {"text": "48 → 46 → 36 → 26 → 16 USDC", "font": MONO, "bold": True}]], size=14)
    mock(s, "d-cover.png", 6.62, Y0 + 0.0, 6.1, pad=PAD_BROWSER,
         alt="Ảnh chụp trang Bảo chứng của dây vỡ nợ thật trên Fuji: kỳ 2 bù 8 USDC từ tiền giữ lại và 2 USDC từ ký quỹ")
    footer(s, "cascade", source="Dây 0xc628…5Bfc trên Fuji, 11/11/2026 (ảnh chụp trang Bảo chứng ngày 21/11/2026): "
                                "script chạy bằng ví demo của đội, không phải người dùng thật bỏ đóng. Số tiền bằng "
                                "1/10 dây mẫu docs/03 mục 8; 104 kiểm tra đạt (docs/DEPLOY-FUJI.md mục 15b).")
    notes(s, "Đây là dây chạy thật trên Fuji ngày 11/11. Kỳ 1, thành viên 4 thắng thăm và hốt. Trước kỳ 2, thành viên "
             "4 thu hồi quyền trích, nên tới hạn ví đó không trả được 10 USDC. Ngay trong giao dịch khui kỳ, smart "
             "contract lấy 8 USDC từ tiền giữ lại của chính thành viên 4 và 2 USDC từ ký quỹ, nên người hốt kỳ 2 vẫn "
             "nhận đủ. Quá ân hạn, thành viên 4 bị ghi vỡ nợ; ở kỳ 3, 4 và 5, ký quỹ bù phần của người này và còn 16 "
             "USDC lúc tất toán. Chúng em nói rõ: đây là kịch bản do script chạy bằng ví của đội, số tiền bằng một "
             "phần mười dây mẫu trong đặc tả, không phải người dùng thật bỏ đóng.")


def s_coverage(prs):
    s = new_slide(prs)
    header(s, "coverage", "CHỈ SỐ BẢO CHỨNG", "Dây chỉ bắt đầu được khi chỉ số bảo chứng đạt 100%",
           chip="Creativity & Innovation")
    y, h = Y0 + 0.02, 1.5
    tiles = [(ML, 1.75, "20%", "tiền giữ lại của người đã hốt", PAPER),
             (ML + 2.2, 2.35, "480/600", "ký quỹ / rủi ro lớn nhất, USDC", PAPER),
             (ML + 5.0, 1.75, "100%", "chỉ số bảo chứng", LIME)]
    for x, w, big, label, fill in tiles:
        rect(s, x, y, w, h, fill=fill, line=(None if fill == LIME else LINE), lw=1, radius=0.1)
        text(s, x, y + 0.1, w, 0.85, big, size=38, font=MONO, bold=True, align="c", anchor="m")
        text(s, x + 0.12, y + 0.95, w - 0.24, 0.5, label, size=11.5, color=(INK if fill == LIME else INK2), align="c",
             ls=1.12, bold=(fill == LIME))
    text(s, ML + 1.75, y, 0.45, h, "+", size=30, font=MONO, color=INK2, align="c", anchor="m")
    text(s, ML + 4.55, y, 0.45, h, "=", size=30, font=MONO, color=INK2, align="c", anchor="m")
    text(s, ML, 3.92, 6.75, 1.0, "Rủi ro lớn nhất là số tiền những người đã hốt còn phải góp, cao nhất ở giữa dây. Dây "
         "mẫu 5 người góp 100 USDC: 2 người đã hốt × 3 kỳ còn lại × 100 = 600 USDC.", size=15, color=INK2, ls=1.28)
    text(s, 7.72, Y0 - 0.04, 5.0, 0.26, "RỦI RO SAU TỪNG KỲ VÀ PHẦN ĐƯỢC CHE, USDC", size=10, font=MONO, color=INK2,
         spc=80)
    picture(s, CHARTS / "exposure.png", 7.6, Y0 + 0.2, w=5.13, h=5.13 * 990 / 1860,
            alt="Biểu đồ cột: rủi ro sau kỳ 1 đến kỳ 4 là 400, 600, 600, 400 USDC; tiền giữ lại 20% và ký quỹ 480 che đủ")
    rect(s, ML, 5.12, CW, 0.82, fill=PAPER, line=INK, lw=1.25, radius=0.08)
    text(s, ML + 0.3, 5.12, CW - 0.6, 0.82, "“Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi "
         "người đã hốt cùng bỏ đóng một lúc.”", size=18, bold=True, anchor="m", ls=1.18)
    text(s, ML, 6.02, CW, 0.3, "Người đã hốt bỏ đóng lần lượt qua nhiều kỳ thì tổng khoản thiếu có thể vượt ký quỹ: "
         f"xem trang {NUM['limits']}.", size=13.5, color=INK2)
    footer(s, "coverage", source="Nguồn: docs/03 mục 2.1 đến 2.3, 7.3; sàn 100% trên Fuji theo ADR-22.")
    notes(s, "Trước khi vào dây, ai cũng thấy chỉ số bảo chứng. Rủi ro lớn nhất là số tiền những người đã hốt còn phải "
             "góp, cao nhất ở giữa dây; với dây mẫu 5 người góp 100 USDC là 600 USDC. Tiền giữ lại của người đã hốt "
             "che 20%, ký quỹ 480 USDC che 80%, cộng lại là 100%. Trên Fuji, smart contract không cho bắt đầu dây nếu "
             "chỉ số dưới 100%. Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt "
             "cùng bỏ đóng một lúc. Chỉ số này không bao quát mọi trường hợp; trường hợp người đã hốt bỏ đóng lần "
             "lượt nằm ở phần giới hạn.")


# Press-reported collapses. Every figure is the article's own wording; each page was opened on 21/11/2026.
CASES = [
    dict(key="tuoitre-lamdong", place="Lâm Đồng", amount="hơn 156 tỉ đồng", detail="203 bị hại · án chung thân",
         outlet="Tuổi Trẻ", date="19/09/2025",
         url="https://tuoitre.vn/chu-hui-lua-dao-hon-100-ti-dong-lanh-an-chung-than-20250919182451911.htm"),
    dict(key="vnexpress-angiang", place="An Giang", amount="99 tỷ đồng", detail="134 dây hụi · 20 năm tù",
         outlet="VnExpress", date="25/09/2025",
         url="https://vnexpress.net/chu-hui-chiem-doat-99-ty-dong-o-mien-tay-bi-phat-20-nam-tu-4943272.html"),
    dict(key="vnexpress-travinh", place="Trà Vinh", amount="gần 72 tỷ đồng", detail="hơn 270 người · 20 năm tù",
         outlet="VnExpress", date="11/10/2023",
         url="https://vnexpress.net/chu-tiem-nail-giat-hui-72-ty-dong-cua-hang-tram-nguoi-4663654.html"),
    dict(key="thanhnien-dongnai", place="Đồng Nai", amount="hơn 49 tỉ đồng", detail="337 người · đã khởi tố",
         outlet="Thanh Niên", date="01/02/2024",
         url="https://thanhnien.vn/vu-vo-hui-gan-50-ti-dong-cong-an-tinh-dong-nai-khoi-to-vo-chong-chu-hui-"
             "185240201092519765.htm"),
    dict(key="dantri-travinh", place="Trà Vinh", amount="hơn 35 tỷ đồng", detail="160 hụi viên · 19 năm tù",
         outlet="Dân trí", date="04/06/2025",
         url="https://dantri.com.vn/phap-luat/nu-chu-hui-lua-dao-160-nan-nhan-chiem-doat-hon-35-ty-dong-"
             "20250604164857355.htm"),
]
URL_VOV = "https://vov.vn/phap-luat/12-nam-tu-cho-doi-tuong-mo-day-hui-khong-chiem-doat-tai-san-post1161016.vov"
URL_VNPLUS = ("https://www.vietnamplus.vn/tay-ninh-khoi-to-chu-hui-dung-tai-khoan-ao-chiem-doat-gan-500-trieu-dong-"
              "post1140315.vnp")
URL_BPL = "https://baophapluat.vn/khoi-to-bat-tam-giam-loat-chu-hui-chiem-doat-tai-san-post526051.html"
URL_BDT = "https://baodautu.vn/tphcm-kien-nghi-sua-quy-dinh-de-tranh-vo-hui-day-chuyen-gay-hau-qua-lon-d229125.html"
URL_FINDEX = "https://api.worldbank.org/v2/country/VNM/indicator/fin17c?source=28&format=json"


def s_context(prs):
    s = new_slide(prs)
    header(s, "context", "BỐI CẢNH", "Hụi là cách tiết kiệm và vay mượn theo tập quán, được luật công nhận, và vẫn "
           "phổ biến", chip="Impact & Use Case")
    pw = 3.3
    ph = pw * 1190 / 1050
    picture(s, MOCK / "photo-market.jpg", ML, Y0, w=pw, h=ph, radius=0.14,
            alt="Ảnh: các sạp hàng và tiểu thương trong chợ Bến Thành, TP.HCM")
    text(s, ML, Y0 + ph + 0.06, pw, 0.34, "Tiểu thương ở chợ Bến Thành, TP.HCM. Ảnh minh họa: Bahnfrend, CC BY-SA 4.0, "
         "Wikimedia Commons.", size=8, font=MONO, color=INK2, ls=1.15)

    mx, mw = 4.32, 3.95
    text(s, mx, Y0 - 0.02, mw, 0.26, "MỘT DÂY HỤI CHẠY THẾ NÀO", size=10, font=MONO, color=INK2, spc=80)
    steps = [
        ("Góp", "Một nhóm người quen, mỗi kỳ mỗi người góp một phần bằng nhau."),
        ("Bỏ thăm", "Ai cần tiền sớm thì chịu trả lãi (tiền thăm) cho những người hốt sau."),
        ("Hốt", "Mỗi kỳ một người nhận cả hũ. Đủ số kỳ thì ai cũng hốt đúng một lần."),
    ]
    for i, (t, b) in enumerate(steps):
        y = Y0 + 0.36 + i * 1.2
        rect(s, mx, y, mw, 1.05, fill=PAPER, line=LINE, lw=1, radius=0.1)
        numbered_dot(s, mx + 0.2, y + 0.2, str(i + 1))
        text(s, mx + 0.72, y + 0.14, mw - 0.9, 0.34, t, size=16, bold=True)
        text(s, mx + 0.72, y + 0.47, mw - 0.9, 0.55, b, size=12.5, color=INK2, ls=1.18)

    rx = 8.62
    rw = W - MR - rx
    text(s, rx, Y0 - 0.02, rw, 0.26, "VIỆT NAM, NGƯỜI TỪ 15 TUỔI, 2024", size=10, font=MONO, color=INK2, spc=80)
    picture(s, CHARTS / "findex.png", rx, Y0 + 0.3, w=rw, h=rw * 930 / 1680,
            alt="Biểu đồ: 71% có tài khoản; 34% vay từ gia đình, bạn bè; 10% tiết kiệm qua hội nhóm hoặc người ngoài "
                "gia đình")
    ly = Y0 + 0.3 + rw * 930 / 1680 + 0.14
    rect(s, rx, ly, rw, 6.02 - ly, fill=LIME, radius=0.1)
    text(s, rx + 0.2, ly, rw - 0.4, 6.02 - ly, [
        {"text": "Được luật công nhận", "bold": True, "size": 14},
        "Bộ luật Dân sự 2015 Điều 471 và Nghị định 19/2019/NĐ-CP về họ, hụi, biêu, phường.",
    ], size=12, anchor="m", ls=1.2, after=2)
    footer(s, "context", source="Nguồn: World Bank Global Findex Database, dữ liệu năm 2024 (chỉ số account.t.d, "
                                "fin22b, fin17c). Chưa có thống kê quốc gia riêng về hụi; “tiết kiệm qua hội nhóm "
                                "hoặc người ngoài gia đình” là chỉ báo gần nhất và rộng hơn hụi.")
    notes(s, "Hụi, còn gọi là họ, biêu, phường, là cách tiết kiệm và vay mượn theo tập quán. Một nhóm người quen góp "
             "tiền theo kỳ; mỗi kỳ một người nhận cả hũ; ai cần tiền sớm thì trả lãi cho những người hốt sau. Hụi hợp "
             "pháp theo Bộ luật Dân sự Điều 471 và Nghị định 19 năm 2019. Theo Global Findex của Ngân hàng Thế giới, "
             "năm 2024 có 71% người lớn Việt Nam có tài khoản, nhưng 34% vẫn vay từ gia đình, bạn bè và 10% tiết kiệm "
             "qua hội nhóm hoặc người ngoài gia đình. Chúng em nói rõ: chưa có thống kê quốc gia riêng về số người "
             "chơi hụi, nên chúng em không đưa ra con số đó.")


def s_news(prs):
    s = new_slide(prs, DEEP)
    header(s, "news", "VẤN ĐỀ", "Báo chí liên tục đưa tin vỡ hụi; điểm chung là một người cầm tiền của cả dây",
           chip="Impact & Use Case", dark=True)
    clips = [
        ("clip-tuoitre-lamdong.png", ML + 0.05, Y0 + 0.02, 3.45, -2.2, "Tuổi Trẻ, 19/09/2025"),
        ("clip-vnexpress-angiang.png", 3.75, Y0 + 0.32, 3.45, 1.6, "VnExpress, 25/09/2025"),
        ("clip-thanhnien-dongnai.png", ML + 0.4, 4.18, 3.45, 1.4, "Thanh Niên, 01/02/2024"),
        ("clip-dantri-travinh.png", 4.05, 4.38, 3.3, -1.7, "Dân trí, 04/06/2025"),
    ]
    for name, x, y, w, rot, alt in clips:
        if (MOCK / name).exists():
            mock(s, name, x, y, w, pad=PAD_CLIP, rot=rot, alt=f"Ảnh chụp bài báo: {alt}")
    rx = 7.85
    rw = W - MR - rx
    text(s, rx, Y0 - 0.1, rw, 0.74, "Hơn 400 tỷ đồng", size=42, bold=True, color=LIME, anchor="m", ls=1.0, spc=-60)
    text(s, rx, Y0 + 0.62, rw, 0.7, "bị chiếm đoạt trong 5 vụ báo chí đưa tin từ 2023 đến 2025, mỗi vụ liên quan "
         "từ 160 đến hơn 330 người.", size=12.5, color=IVORY, ls=1.22)
    text(s, rx, Y0 + 1.4, rw, 0.24, "SỐ TIỀN CHIẾM ĐOẠT THEO TỪNG BÀI BÁO, TỶ ĐỒNG", size=9.5, font=MONO, color=MUTE,
         spc=70)
    picture(s, CHARTS / "cases.png", rx, Y0 + 1.66, w=2.5 * 1890 / 1050, h=2.5,
            alt="Biểu đồ: Lâm Đồng 156 tỷ, An Giang 99 tỷ, Trà Vinh 72 tỷ, Đồng Nai 49 tỷ, Trà Vinh 35 tỷ")
    footer(s, "news", dark=True, source="Ảnh chụp bài báo ngày 21/11/2026; 5 vụ đều đã khởi tố hoặc xét xử, số liệu là chữ của từng bài (nguồn và "
                                        f"đường dẫn ở trang {NUM['src_press']}). 400 tỷ là tổng 5 con số trên biểu đồ. "
                                        "Chưa có thống kê toàn quốc về vỡ hụi.")
    notes(s, "Vỡ hụi không phải chuyện hiếm. Chỉ tính năm vụ đã khởi tố hoặc xét xử mà báo chí đưa tin từ 2023 tới "
             "2025, số tiền bị chiếm đoạt đã hơn 400 tỷ đồng: Lâm Đồng hơn 156 tỷ với 203 bị hại, An Giang 99 tỷ, Trà "
             "Vinh gần 72 tỷ của hơn 270 người, Đồng Nai hơn 49 tỷ của 337 người, và một vụ khác ở Trà Vinh hơn 35 "
             "tỷ. Thủ đoạn lặp lại: chủ hụi cầm tiền của cả dây, đặt tên hụi viên khống hoặc dùng tài khoản ảo để tự "
             "hốt, rồi tuyên bố vỡ hụi. Chúng em nói rõ đây là số của từng bài báo, chưa có thống kê toàn quốc.")


def s_pain(prs):
    s = new_slide(prs)
    header(s, "pain", "VÌ SAO VỠ HỤI", "Ba điểm yếu của hụi truyền thống đều nằm ở chỗ một người vừa giữ tiền, vừa "
           "giữ sổ", chip="Impact & Use Case")
    cards = [
        ("Một người cầm cả hũ tiền",
         "Chủ hụi thu tiền góp rồi mới chi. Ôm tiền, hay đặt tên hụi viên khống để tự hốt, đều không ai chặn được.",
         "1.607 phần hụi bị hốt khống bằng tên giả trong một vụ ở Trà Vinh.", "VnExpress, 11/10/2023"),
        ("Người đã hốt bỏ đóng",
         "Hốt sớm rồi ngừng góp thì người hốt sau gánh. Luật giao chủ hụi bù, nhưng không có gì bảo đảm chủ hụi còn "
         "tiền.",
         "Chủ hụi phải góp thay khi thành viên không góp.", "NĐ 19/2019/NĐ-CP, Điều 18 khoản 4"),
        ("Không ai kiểm được sổ",
         "Sổ hụi nằm trong tay chủ hụi hoặc trong nhóm Zalo. Quy định thông báo UBND cấp xã gần như không ai làm.",
         "TP.HCM, sau 5 năm thi hành NĐ 19: không một chủ hụi hay thành viên nào báo cáo với chính quyền địa phương.",
         "Báo Đầu tư, 04/11/2024"),
    ]
    cw, gap = 3.85, (CW - 3 * 3.85) / 2
    for i, (title, body, ev, src) in enumerate(cards):
        x = ML + i * (cw + gap)
        rect(s, x, Y0, cw, 3.42, fill=PAPER, line=LINE, lw=1, radius=0.1)
        numbered_dot(s, x + 0.25, Y0 + 0.2, str(i + 1), fill=INK, color=LIME)
        text(s, x + 0.78, Y0 + 0.2, cw - 1.0, 0.36, title, size=16.5, bold=True, anchor="m", ls=1.05)
        text(s, x + 0.25, Y0 + 0.78, cw - 0.5, 1.25, body, size=13.5, color=INK2, ls=1.24)
        rule(s, x + 0.25, Y0 + 2.2, x + cw - 0.25, Y0 + 2.2, color=LINE, lw=0.75)
        text(s, x + 0.25, Y0 + 2.3, cw - 0.5, 0.78, ev, size=12, bold=True, ls=1.18)
        text(s, x + 0.25, Y0 + 3.1, cw - 0.5, 0.24, src, size=9, font=MONO, color=INK2)
    rect(s, ML, 5.82, CW, 0.5, fill=INK, radius=0.08)
    text(s, ML + 0.3, 5.82, CW - 0.6, 0.5, [[
        {"text": "Câu hỏi thiết kế: ", "color": LIME, "bold": True},
        {"text": "làm sao để không ai phải giữ tiền, mà người hốt sau vẫn có người bảo lãnh?", "color": IVORY},
    ]], size=15, anchor="m")
    footer(s, "pain", source=f"Nguồn: bài báo và văn bản ghi dưới từng ô (đường dẫn ở trang {NUM['src_press']}); docs/10 "
                             "mục 1 về NĐ 19/2019.")
    notes(s, "Vì sao vỡ hụi? Chúng em thấy ba điểm yếu. Một, một người cầm tiền của cả dây: chủ hụi thu tiền rồi mới "
             "chi, nên có thể ôm tiền hoặc đặt tên hụi viên khống để tự hốt; trong một vụ ở Trà Vinh có tới 1.607 phần "
             "hụi bị hốt khống. Hai, người đã hốt bỏ đóng: người hốt sau gánh, còn chủ hụi tuy có trách nhiệm bù theo "
             "Nghị định 19 nhưng không có gì bảo đảm họ còn tiền. Ba, không ai kiểm được sổ: Thành phố Hồ Chí Minh "
             "báo cáo sau 5 năm thi hành Nghị định 19 là không có chủ hụi nào thông báo với chính quyền theo quy định. "
             "Câu hỏi thiết kế của chúng em: làm sao để không ai phải giữ tiền, mà người hốt sau vẫn có người bảo lãnh?")


def _node(s, x, y, w, h, title, sub, *, hi=False, dashed=False):
    rect(s, x, y, w, h, fill=(LIME if hi else PAPER), line=(None if hi else INK2 if dashed else LINE), lw=1,
         radius=0.08, dash=(MSO_LINE_DASH_STYLE.DASH if dashed else None))
    text(s, x + 0.14, y + 0.12, w - 0.28, 0.32, title, size=15, bold=True, ls=1.1)
    text(s, x + 0.14, y + 0.48, w - 0.28, h - 0.55, sub, size=13, color=(INK if hi else INK2), ls=1.15)


def s_arch(prs):
    s = new_slide(prs)
    header(s, "arch", "KIẾN TRÚC", "Mỗi dây là một smart contract riêng; web, relayer và keeper chỉ chuyển lệnh, không "
           "giữ tiền", chip="Technical Implementation")
    nw, gap, nh = 2.2, (CW - 5 * 2.2) / 4, 1.14
    col = [ML + i * (nw + gap) for i in range(5)]
    y1, y2 = Y0 + 0.36, 4.66
    text(s, ML, Y0 + 0.04, 6, 0.26, "NGOÀI CHUỖI", size=10.5, font=MONO, color=INK2, spc=80)
    _node(s, col[0], y1, nw, nh, "Thành viên, chủ hụi", "điện thoại hoặc máy tính")
    _node(s, col[1], y1, nw, nh, "Web Next.js + Privy", "đăng nhập Google, ký yêu cầu EIP-712")
    _node(s, col[2], y1, nw, nh, "Relayer", "kiểm từng yêu cầu, trả phí AVAX")
    _node(s, col[3], y1, nw, nh, "Keeper", "khui thay, ghi vỡ nợ, tất toán")
    _node(s, col[4], y1, nw, nh, "Trợ lý AI", "chỉ đọc, tính bằng hàm tất định, không ký", dashed=True)
    rect(s, ML - 0.12, 4.24, CW + 0.24, 1.72, line=INK2, lw=1, radius=0.12, dash=MSO_LINE_DASH_STYLE.ROUND_DOT)
    text(s, ML, 4.32, 6, 0.26, "AVALANCHE C-CHAIN (FUJI)", size=10.5, font=MONO, color=INK2, spc=80)
    _node(s, col[0], y2, nw, nh, "Safe 2/3 (admin)", "chỉ tạm dừng dây; không có hàm rút tiền")
    _node(s, col[1], y2, nw, nh, "HuiFactory", "tạo dây bằng clone EIP-1167")
    _node(s, col[2], y2, nw, nh, "ERC2771Forwarder", "xác minh chữ ký của người dùng")
    _node(s, col[3], y2, nw, nh, "HuiCircle (mỗi dây)", "luật, tiền, sổ; HuiCircleLens, HuiMath", hi=True)
    _node(s, col[4], y2, nw, nh, "USDC · Reputation", "permit EIP-2612 · uy tín theo ví")
    cy1, cy2 = y1 + nh / 2, y2 + nh / 2
    connector(s, col[0] + nw + 0.04, cy1, col[1] - 0.04, cy1, lw=1.5)
    connector(s, col[1] + nw + 0.04, cy1, col[2] - 0.04, cy1, lw=1.5)
    connector(s, col[2] + nw / 2, y1 + nh + 0.04, col[2] + nw / 2, y2 - 0.04, lw=1.5)
    connector(s, col[3] + nw / 2, y1 + nh + 0.04, col[3] + nw / 2, y2 - 0.04, lw=1.5)
    connector(s, col[2] + nw + 0.04, cy2, col[3] - 0.04, cy2, lw=1.5)
    connector(s, col[3] + nw + 0.04, cy2, col[4] - 0.04, cy2, lw=1.5, tail=True)
    connector(s, col[0] + nw + 0.04, cy2, col[1] - 0.04, cy2, lw=1.25, dash=MSO_LINE_DASH_STYLE.DASH)
    footer(s, "arch", source="Chi tiết: docs/04 mục 2 và 3. Không dùng ERC-4337 hay EIP-7702; không dùng Multicall "
                             "cùng ERC2771Context (ADR-03, ADR-06). Attester của HụiSafe ký xác nhận mỗi người một tài "
                             "khoản, đủ 18 tuổi, lúc vào dây.")
    notes(s, "Về kiến trúc: mỗi dây là một smart contract riêng, tạo từ HuiFactory bằng clone EIP-1167 nên rẻ khi tạo. "
             "Người dùng ký yêu cầu trên web; relayer gửi yêu cầu lên ERC2771Forwarder và trả phí AVAX. Relayer chỉ "
             "chuyển yêu cầu đã có chữ ký, không sửa được nội dung và không giữ tiền. Keeper là tiện ích: khui thay "
             "khi chủ hụi vắng, ghi vỡ nợ khi quá ân hạn, tất toán cuối dây; ai cũng gọi được các hàm này. Admin là "
             "ví Safe 2 trên 3, chỉ tạm dừng được dây và không có hàm nào rút tiền người dùng. Trợ lý AI chỉ đọc và "
             "tính bằng hàm tất định, không ký giao dịch.")


def s_avalanche(prs):
    s = new_slide(prs)
    header(s, "avalanche", "TÍCH HỢP AVALANCHE", "Tiền, luật và sổ của mỗi dây đều nằm trên Avalanche",
           chip="Avalanche Integration · 5 × 5 điểm")
    boxes = [
        ("Uses Avalanche meaningfully",
         "Tiền góp đi từ ví thành viên tới người hốt trong một giao dịch trên C‑Chain. Trần lãi và lãi chậm góp "
         "theo NĐ 19 chạy trong smart contract."),
        ("Smart contract / on-chain implementation",
         "5 contract đã deploy và verify trên Fuji: HuiFactory, HuiCircle (clone EIP-1167), HuiCircleLens, "
         "ReputationRegistry, ERC2771Forwarder."),
        ("Appropriate use of Avalanche infrastructure",
         "USDC của Circle trên C‑Chain có permit EIP-2612. Relayer ERC-2771 trả phí AVAX thay người dùng. Mọi giao "
         "dịch kiểm được trên Snowtrace."),
        ("Technical quality of integration",
         "634 test Foundry, 17 hàm invariant chạy fuzz. Domain permit đọc từ USDC lúc chạy. Ví bị chặn chuyển tiền "
         "thì ghi claimable, kỳ hụi vẫn chạy."),
        ("Demonstrates clear value from building on Avalanche",
         "Phí thấp nên relayer trả thay được: một kỳ dây 5 người tốn khoảng 520.000 gas. C‑Chain chốt giao dịch "
         "dưới 1 giây (theo tài liệu Avalanche)."),
    ]
    rh, y0 = 0.8, Y0 + 0.02
    rule(s, ML, y0, W - MR, y0, color=INK, lw=1)
    for i, (crit, ev) in enumerate(boxes):
        y = y0 + i * rh
        numbered_dot(s, ML, y + (rh - 0.34) / 2, str(i + 1), d=0.34, size=11)
        text(s, ML + 0.52, y, 3.25, rh, crit, size=11, font=MONO, color=INK2, anchor="m", ls=1.15)
        text(s, 4.55, y, W - MR - 4.55, rh, ev, size=15.5, anchor="m", ls=1.2)
        rule(s, ML, y + rh, W - MR, y + rh, color=LINE, lw=0.75)
    footer(s, "avalanche", source="Nguồn: contracts/deployments/fuji.json; docs/04 mục 7.1 (gas settleRound N = 5, không "
                                  "ai thiếu, đo bằng test); docs.avax.network (Performance: C-Chain finality dưới 1 "
                                  "giây); team1vn.xyz/topics.json (5 tiêu chí con).")
    notes(s, "Năm ý chấm điểm Avalanche, mỗi dòng một bằng chứng. Thứ nhất, tiền và luật của dây chạy trên C-Chain. Thứ "
             "hai, 5 contract đã deploy và verify trên Fuji. Thứ ba, chúng em dùng USDC của Circle có permit, "
             "relayer ERC-2771 và Snowtrace. Thứ tư, chất lượng tích hợp: 634 test, 17 hàm invariant chạy fuzz, "
             "domain permit đọc lúc chạy, ví bị chặn chuyển tiền không làm hỏng cả kỳ. Thứ năm, phí đủ thấp để "
             "relayer trả thay: một kỳ dây 5 người tốn khoảng 520 nghìn gas, đo bằng test.")


def s_fuji(prs):
    s = new_slide(prs, DEEP)
    header(s, "fuji", "ĐÃ CHẠY THẬT TRÊN FUJI", "Ba dây đã chạy trọn trên Fuji testnet, lần nào số dư của smart "
           "contract cũng về 0", chip="Avalanche Integration", dark=True)
    stats = [("3", "dây chạy trọn, có tất toán"), ("13", "kỳ đã chi (3 + 5 + 5)"), ("0", "USDC còn lại trong mỗi dây")]
    for i, (n, label) in enumerate(stats):
        x = ML + i * 4.1
        nw = 0.44 * len(n) + 0.1
        text(s, x, Y0 + 0.08, nw, 0.8, n, size=50, font=MONO, bold=True, color=LIME, anchor="m", ls=1.0)
        text(s, x + nw + 0.15, Y0 + 0.08, 3.7 - nw - 0.15, 0.8, label, size=15, color=IVORY, anchor="m", ls=1.15)
    cards = [
        ("11/11 · DÂY CỐ ĐỊNH, 3 NGƯỜI", "Thành viên vào dây qua relayer, ví không có AVAX. Keeper khui 3 kỳ rồi "
         "tất toán.", CIRCLE_FIXED),
        ("11/11 · DÂY VỠ NỢ, 5 NGƯỜI", "Một người bỏ đóng sau khi hốt: bù 8 + 2 USDC, ghi vỡ nợ, ký quỹ 48 còn 16. "
         "Chạy bằng script và ví demo của đội.", CIRCLE_DEFAULT),
        ("20/11 · DÂY TẠO TRÊN WEB", "Chủ hụi đăng nhập Google; 5 người vào dây (1 điện thoại thật, 4 ví demo); chủ "
         "hụi tự khui đủ 5 kỳ.", CIRCLE_WEB),
    ]
    cw, gap, cy, chh = 3.85, (CW - 3 * 3.85) / 2, 3.2, 2.84
    for i, (label, body, addr) in enumerate(cards):
        cx = ML + i * (cw + gap)
        rect(s, cx, cy, cw, chh, fill=INK, line=LINE_D, lw=1, radius=0.12)
        text(s, cx + 0.25, cy + 0.2, cw - 0.5, 0.26, label, size=10.5, font=MONO, color=LIME, spc=60)
        text(s, cx + 0.25, cy + 0.52, cw - 0.5, 1.1, body, size=14, color=IVORY, ls=1.22)
        qr(s, SNOW + addr, cx + 0.25, cy + chh - 1.17, 0.95)
        short = f"{addr[:6]}…{addr[-4:]}"
        text(s, cx + 1.38, cy + chh - 0.95, cw - 1.6, 0.6, [short, {"text": "quét để mở Snowtrace", "color": MUTE,
                                                                     "size": 10}],
             size=12, font=MONO, color=IVORY, ls=1.3)
    text(s, ML, 6.14, CW, 0.28, [[
        {"text": "HuiFactory "}, {"text": "0x5004…5b21", "color": LIME},
        {"text": " · admin là ví Safe 2/3 · 5/5 contract đã verify (Routescan)"},
    ]], size=11, font=MONO, color=IVORY)
    footer(s, "fuji", dark=True, source="Nguồn: docs/DEPLOY-FUJI.md mục 15, 15b. Cả ba dây đọc lại trên Fuji ngày "
                                        "21/11/2026: state Completed, số dư USDC bằng 0.")
    notes(s, "Ba dây đã chạy trọn trên Fuji. Dây cố định 3 người ngày 11/11: thành viên vào dây qua relayer với ví "
             "không có AVAX, keeper khui 3 kỳ rồi tất toán. Dây vỡ nợ ngày 11/11 là ví dụ vừa trình bày. Dây thứ ba "
             "ngày 20/11 được tạo ngay trên web bằng tài khoản Google; 5 người vào dây, một người dùng điện thoại "
             "thật, bốn người là ví demo; chủ hụi tự khui đủ 5 kỳ. Cả ba dây kết thúc với số dư smart contract bằng "
             "0. Quét mã để xem từng dây trên Snowtrace.")


def s_tests(prs):
    s = new_slide(prs)
    header(s, "tests", "KIỂM THỬ VÀ MÔ PHỎNG", "Cùng một giả định bỏ đóng, tỷ lệ dây có người nhận thiếu giảm từ 23,3% "
           "xuống 0,01%", chip="Technical Implementation")
    tiles = [
        ("634", "test hợp đồng đều đạt"),
        ("17", "bất biến về tiền chạy fuzz"),
        ("98,7%", "độ phủ mã hợp đồng"),
        ("0", "lỗi Critical/High sau rà soát nội bộ"),
    ]
    tw, tg = 2.55, 0.2
    for i, (n, label) in enumerate(tiles):
        x = ML + (i % 2) * (tw + tg)
        y = Y0 + 0.02 + (i // 2) * 1.5
        rect(s, x, y, tw, 1.34, fill=PAPER, line=LINE, lw=1, radius=0.1)
        text(s, x + 0.2, y + 0.12, tw - 0.4, 0.68, n, size=36, font=MONO, bold=True, anchor="m", ls=1.0)
        text(s, x + 0.2, y + 0.82, tw - 0.4, 0.44, label, size=12, color=INK2, ls=1.15)
    text(s, ML, 5.3, 5.3, 0.9, "Công thức tiền (HuiMath) được đối chiếu từng đơn vị giữa Solidity, TypeScript và "
         "Python. Chưa có audit độc lập.", size=13.5, color=INK2, ls=1.25)
    rx = 6.5
    rw = W - MR - rx
    text(s, rx, Y0 - 0.02, rw, 0.26, "TỶ LỆ DÂY CÓ NGƯỜI NHẬN THIẾU HOẶC CHỦ HỤI BỎ TRỐN", size=10, font=MONO,
         color=INK2, spc=80)
    picture(s, CHARTS / "sim-failure.png", rx, Y0 + 0.28, w=rw, h=rw * 900 / 1920,
            alt="Biểu đồ: hụi truyền thống 23,3%, hụi on-chain đơn giản 62,5%, HụiSafe 0,01%")
    by = Y0 + 0.28 + rw * 900 / 1920 + 0.02
    rect(s, rx, by, rw, 6.2 - by, fill=PAPER, line=LINE, lw=1, radius=0.08)
    text(s, rx + 0.2, by + 0.02, rw - 0.4, 6.2 - by - 0.04, [
        {"text": "Kết quả của giả định, không phải dự báo.", "bold": True, "color": INK, "size": 13},
        "Mô phỏng 10.000 dây cho mỗi thiết kế, 10 người × 100 USDC. Tỷ lệ bỏ đóng lấy theo dữ liệu hụi ở Chennai, Ấn "
        "Độ (Klonner & Rai, 2008), không phải số đo ở Việt Nam.",
    ], size=11.5, color=INK2, ls=1.2, after=2, anchor="m")
    footer(s, "tests", source="Nguồn: sim/outputs/baseline.json (08/11/2026, seed 42). Số test: docs/TIEN-DO.md "
                              "(20/11/2026); độ phủ và rà soát: docs/09 mục 7.1 (11/11/2026). CI trên main đang báo đỏ "
                              "vì lint, gas snapshot và cấu hình Slither; xem README.")
    notes(s, "Về kiểm thử: 634 test hợp đồng đều đạt, trong đó 17 bất biến về tiền chạy với fuzz; độ phủ mã hợp đồng "
             "98,7%; rà soát bảo mật nội bộ không còn lỗi Critical hay High, nhưng chúng em chưa có audit độc lập. "
             "Công thức tiền được đối chiếu từng đơn vị giữa Solidity, TypeScript và Python. Về mô phỏng: 10.000 dây "
             "cho mỗi thiết kế, cùng giả định bỏ đóng. Hụi truyền thống có 23,3% dây có người nhận thiếu hoặc chủ hụi "
             "bỏ trốn, on-chain đơn giản 62,5%, HụiSafe 0,01%. Đây là kết quả của giả định lấy từ dữ liệu Ấn Độ, "
             "không phải dự báo cho Việt Nam.")


def s_questions(prs):
    s = new_slide(prs)
    header(s, "questions", "BA CÂU HỎI BẮT BUỘC", "On-chain để không ai phải giữ tiền, Avalanche để phí đủ rẻ, và tiền "
           "chỉ đến từ thành viên", chip="Luật BTC: 3 câu hỏi")
    cols = [
        ("Vì sao on-chain?", [
            "Chơi hụi là phải tin người giữ tiền. Làm app với database chỉ chuyển việc giữ tiền từ chủ hụi sang công "
            "ty làm app.",
            "Trên chuỗi, tiền nằm trong ví từng người tới lúc chi, ký quỹ khóa bằng code, luật dây không đổi sau khi "
            "bắt đầu, sổ hụi ai cũng kiểm được.",
        ]),
        ("Vì sao Avalanche?", [
            "USDC trên C-Chain có permit, nên vào dây chỉ ký một lần. Phí đủ thấp để relayer trả thay, thành viên "
            "không cần AVAX.",
            {"text": "Đề #01: “Low transaction fees mean a group of 10-20 people paying weekly does not lose the pot "
                     "to fees. Native USDC on the C-Chain.”", "font": MONO, "size": 11, "color": INK2},
        ]),
        ("Tiền từ đâu?", [
            "Tiền hốt là tiền góp của chính thành viên. Tiền thăm do người hốt sớm trả cho người hốt sau, dưới trần "
            "Điều 21. Hoa hồng chủ hụi tối đa 3% mỗi lần hốt.",
            "Không sinh lãi, không có token. Nếu có lãi trên phần tiền chưa chi, lãi thật sẽ đến từ cho vay trên Aave "
            "v3 ở mainnet, không đến từ in token.",
        ]),
    ]
    cw, gap = 3.85, (CW - 3 * 3.85) / 2
    for i, (q, paras) in enumerate(cols):
        x = ML + i * (cw + gap)
        rect(s, x, Y0, cw, 4.1, fill=PAPER, line=LINE, lw=1, radius=0.1)
        numbered_dot(s, x + 0.25, Y0 + 0.2, str(i + 1))
        text(s, x + 0.75, Y0 + 0.18, cw - 0.95, 0.42, q, size=19, bold=True, anchor="m")
        text(s, x + 0.25, Y0 + 0.76, cw - 0.5, 3.25, paras, size=15, ls=1.2, after=7)
    footer(s, "questions", source="Nguồn: team1vn.xyz/topics.json (đề #01, luật 7 và 9); docs/03 mục 2.6, 2.7; docs/10 "
                                  "mục 5 (Aave v3 là lộ trình, ADR-10).")
    notes(s, "Ba câu ban tổ chức hỏi. Vì sao on-chain: bài toán của hụi là phải tin người giữ tiền; làm app với database "
             "chỉ đổi người giữ tiền từ chủ hụi sang công ty làm app. Ở đây không ai giữ tiền giữa các kỳ, ký quỹ khóa "
             "bằng code, luật dây không đổi sau khi bắt đầu. Vì sao Avalanche: USDC có permit nên vào dây chỉ "
             "ký một lần, phí đủ thấp để relayer trả thay. Chính đề số 1 viết: phí thấp nghĩa là một nhóm 10 đến 20 "
             "người góp hằng tuần không mất hũ vào phí. Tiền từ đâu: từ chính thành viên. Không có token, không sinh "
             "lãi; nếu sau này có lãi trên phần tiền chưa chi, lãi thật đến từ cho vay trên Aave v3, không đến từ in "
             "token.")


def s_law(prs):
    s = new_slide(prs)
    header(s, "law", "PHÁP LUẬT VIỆT NAM", "Hụi hợp pháp, còn tiền mã hóa không phải phương tiện thanh toán, nên bản "
           "thi chỉ dùng USDC testnet", chip="Luật BTC: 4 điểm pháp lý")
    rows = [
        ["BỐN ĐIỂM BAN TỔ CHỨC YÊU CẦU", "HỤISAFE"],
        ["Tiền mã hóa không phải phương tiện thanh toán hợp pháp",
         "Chỉ dùng USDC testnet, không nhận tiền thật. NQ 05/2025/NQ-CP Điều 4 khoản 7: chào bán, phát hành, giao "
         "dịch, thanh toán tài sản mã hóa phải bằng Đồng Việt Nam. Hướng thật: chế độ VND."],
        ["Lương phải trả bằng VND", "Không áp dụng: HụiSafe không trả lương. Hụi là giao dịch dân sự giữa các thành "
         "viên."],
        ["Tư vấn pháp lý, tài chính có thu phí cần giấy phép",
         "Trợ lý miễn phí, chỉ tính và trích dẫn, luôn ghi “Đây là thông tin tham khảo, không phải tư vấn tài chính "
         "hay pháp lý”."],
        ["Cổ phiếu token hóa bị đơn vị phát hành chặn theo khu vực",
         "Không áp dụng: không có cổ phiếu token hóa, không phát hành và không bán token."],
    ]
    table(s, ML, Y0 - 0.04, [3.75, 8.38], rows, size=13.5, row_h=0.5, head_h=0.34, bold_cols=(0,))
    text(s, ML, 5.12, 5.55, 1.2, [
        {"text": "NĐ 19/2019 chạy trong code", "bold": True, "color": INK},
        "Điều 5, 6 (đủ 18 tuổi), Điều 12, 13 (sổ hụi, biên nhận), Điều 14 (nhắc thông báo UBND cấp xã), Điều 18 "
        "khoản 4 (ký quỹ), Điều 21 (trần thăm), Điều 22 khoản 1 (lãi chậm góp 10%/năm).",
    ], size=13.5, color=INK2, ls=1.2, after=3)
    rx = 6.4
    rect(s, rx, 5.08, W - MR - rx, 1.26, fill=PAPER, line=RED_INK, lw=1.25, radius=0.08)
    text(s, rx + 0.22, 5.12, W - MR - rx - 0.44, 1.18, [
        {"text": "Cần luật sư xác nhận", "bold": True, "color": RED_INK},
        "Công thức trần thăm theo Điều 21 là cách hiểu đề xuất của nhóm. Điều 20 quy định bằng thăm thì bốc thăm, "
        "còn luật cuộc thi cấm yếu tố ngẫu nhiên, nên HụiSafe chia hòa theo luật cố định ghi trong thỏa thuận dây.",
    ], size=13, color=INK, ls=1.18, after=3, anchor="m")
    footer(s, "law", source="Nguồn: docs/10 mục 1, 3, 5 (BLDS 2015 Điều 471; NĐ 19/2019/NĐ-CP, hiệu lực 05/04/2019; NQ "
                            "05/2025/NQ-CP ngày 09/09/2025; BLLĐ 2019 Điều 95 khoản 2; Luật Luật sư). Chưa có luật sư "
                            "nào xác nhận.")
    notes(s, "Về pháp luật Việt Nam, bốn điểm ban tổ chức yêu cầu. Tiền mã hóa không phải phương tiện thanh toán hợp "
             "pháp; Nghị quyết 05/2025 yêu cầu giao dịch, thanh toán tài sản mã hóa bằng Đồng Việt Nam, nên bản thi "
             "chỉ dùng USDC testnet và không nhận tiền thật. HụiSafe không trả lương. Trợ lý miễn phí, chỉ tính và "
             "trích dẫn, luôn ghi rõ không phải tư vấn. Không có cổ phiếu token hóa, không có token. Hụi là giao dịch "
             "hợp pháp theo Bộ luật Dân sự Điều 471 và Nghị định 19, và các điều của Nghị định 19 chạy trong code. "
             "Hai chỗ cần luật sư xác nhận: công thức trần thăm theo Điều 21, và cách chia hòa tất định thay cho bốc "
             "thăm theo Điều 20.")


def s_limits(prs):
    s = new_slide(prs)
    header(s, "limits", "GIỚI HẠN", "Hai giới hạn chúng em nói trước: chủ hụi dùng nhiều ví ảo, và người đã hốt bỏ "
           "đóng lần lượt")
    lx, lw = ML, 6.35
    text(s, lx, Y0 + 0.02, lw, 0.34, "1 · Ví ảo của chủ hụi", size=17, bold=True)
    rect(s, lx, Y0 + 0.36, lw, 1.22, fill=PAPER, line=LINE, lw=1, radius=0.08)
    text(s, lx + 0.2, Y0 + 0.36, lw - 0.4, 1.22, "“Cọc 100% chặn được chủ hụi dùng một ví ảo: làm vậy chủ hụi tự lỗ. "
         "Dùng nhiều ví ảo thì bị chặn bằng xác thực mỗi người một tài khoản (OTP, attestation), và mọi người thấy "
         "trước rủi ro tối đa của mình.”", size=13, anchor="m", ls=1.2)
    rows = [
        ["DÂY MẪU 5 NGƯỜI × 100 USDC", "CHỦ HỤI", "KHÔNG BÙ ĐƯỢC"],
        ["1 ví ảo, cọc 100%", "lỗ 18 USDC", "0"],
        ["2 ví ảo, cọc 100%", "lời 41 USDC", "57 USDC"],
        ["1 ví ảo, cọc 50% (luật cũ)", "lời 121 USDC", "121 USDC"],
    ]
    table(s, lx, Y0 + 1.72, [3.05, 1.65, 1.65], rows, size=13.5, head_size=9.5, row_h=0.46, head_h=0.38,
          num_cols=(1, 2), pad=0.06)

    rx, rw = 7.3, W - MR - 7.3
    text(s, rx, Y0 + 0.02, rw, 0.34, "2 · Người đã hốt bỏ đóng lần lượt", size=17, bold=True)
    text(s, rx, Y0 + 0.36, 2.4, 0.8, "1.000", size=44, font=MONO, bold=True, anchor="m", ls=1.0)
    text(s, rx, Y0 + 1.14, 2.4, 0.5, "USDC thiếu tổng cộng khi 4 người lần lượt hốt rồi bỏ", size=12, color=INK2,
         ls=1.15)
    text(s, rx + 2.75, Y0 + 0.36, 2.3, 0.8, "600", size=44, font=MONO, bold=True, color=INK2, anchor="m", ls=1.0)
    text(s, rx + 2.75, Y0 + 1.14, 2.3, 0.5, "USDC rủi ro lớn nhất, mức ký quỹ đang che", size=12, color=INK2, ls=1.15)
    text(s, rx, Y0 + 1.82, rw, 1.6, [
        "Kỳ 5 còn 304 USDC không bù được; người hốt cuối nhận 94 thay vì 392 USDC.",
        "Muốn bù đủ trường hợp này cần ký quỹ 800 USDC: tùy chọn, nằm trong lộ trình.",
    ], size=14.5, ls=1.22, after=6)
    rect(s, ML, 5.86, CW, 0.46, line=INK, lw=1, radius=0.06)
    text(s, ML + 0.22, 5.86, CW - 0.44, 0.46, [[
        {"text": "Chưa có: ", "bold": True},
        "audit độc lập, mainnet, chế độ VND, lãi trên phần tiền chưa chi, buổi thử với người dùng ngoài đội.",
    ]], size=14.5, anchor="m")
    footer(s, "limits", source="Nguồn: docs/03 mục 7.3 (giữ lại 20%, ký quỹ 480); sim/outputs/organizer_sybil.json "
                               "(10/11/2026). Số tính tất định trên dây mẫu, làm tròn tới USDC, không phải dự báo.")
    notes(s, "Chúng em nói trước hai giới hạn. Một: cọc 100% chặn được chủ hụi dùng một ví ảo, vì làm vậy chủ hụi tự lỗ, "
             "khoảng 18 USDC ở dây mẫu. Với hai ví ảo thì chủ hụi lời, nên lớp chặn tiếp theo là xác thực mỗi người "
             "một tài khoản và cho mọi người thấy trước rủi ro tối đa của mình. Hai: chỉ số 100% là cho cú sốc đồng "
             "thời. Nếu bốn người lần lượt hốt rồi bỏ đóng, tổng khoản thiếu là 1.000 USDC, hơn rủi ro lớn nhất 600; "
             "kỳ 5 còn 304 USDC không bù được và người hốt cuối chỉ nhận 94. Bù đủ trường hợp này cần ký quỹ 800, "
             "là tùy chọn trong lộ trình. Ngoài ra chúng em chưa có audit độc lập, chưa có mainnet, chưa có chế độ VND "
             "và chưa thử với người dùng ngoài đội.")


def s_roadmap(prs):
    s = new_slide(prs)
    header(s, "roadmap", "LỘ TRÌNH", "Việc tiếp theo là xin ý kiến luật sư và thử với nhóm hụi thật bằng chế độ VND")
    steps = [
        ("12/2026", "Thử trên testnet với 3 đến 5 nhóm hụi, sửa theo phản hồi."),
        ("TIẾP THEO", "Xin ý kiến luật sư về NĐ 19 Điều 14, 20 và 21."),
        ("SAU ĐÓ", "Chế độ VND: tiền đi qua ngân hàng, chuỗi giữ luật và sổ hụi."),
        ("TRƯỚC MAINNET", "Audit độc lập, rồi mainnet với Safe multisig; L1 riêng cho từng hội."),
    ]
    ly = 3.1
    rule(s, ML, ly, W - MR, ly, color=INK, lw=1.25)
    sw = CW / 4
    for i, (when, what) in enumerate(steps):
        x = ML + i * sw
        oval(s, x, ly - 0.11, 0.22, fill=(LIME if i == 0 else INK), line=INK, lw=1)
        text(s, x, 2.42, sw - 0.3, 0.3, when, size=11, font=MONO, color=INK2, spc=80)
        text(s, x, 3.34, sw - 0.35, 1.3, what, size=16, ls=1.25)
    rect(s, ML, 4.95, CW, 1.25, fill=LIME, radius=0.1)
    text(s, ML + 0.3, 4.95, CW - 0.6, 1.25, [
        {"text": "Chúng em cần", "bold": True, "size": 13, "font": MONO},
        "Một mentor pháp lý; giới thiệu 3 nhóm hụi hoặc câu lạc bộ để thử; hướng dẫn nộp Team1 Mini Grant.",
    ], size=18, anchor="m", ls=1.25, after=4)
    footer(s, "roadmap", source="Nguồn: docs/12 mục 2 và 8. Mọi mốc ở đây là kế hoạch, chưa làm.")
    notes(s, "Việc tiếp theo, theo thứ tự: tháng 12 thử trên testnet với 3 đến 5 nhóm hụi; xin ý kiến luật sư về Điều "
             "14, 20 và 21; làm chế độ VND để tiền đi qua ngân hàng, chuỗi chỉ giữ luật và sổ hụi; rồi audit độc lập "
             "trước khi tính tới mainnet. Chúng em cần ba việc: một mentor pháp lý, giới thiệu 3 nhóm hụi hoặc câu lạc "
             "bộ để thử, và hướng dẫn nộp Team1 Mini Grant.")


def s_team(prs):
    s = new_slide(prs)
    header(s, "team", "ĐỘI HỤISAFE", "Cảm ơn ban giám khảo. Quét mã để thử app trên Fuji")
    team = [
        ("minh.png", "Ngô Bình Minh", "TRƯỞNG NHÓM", "Thiết kế sản phẩm và giao thức, tham số v1.2, pitch.",
         "github.com/bminhnemhoi"),
        ("tien.png", "Ngô Lâm Tiến", "FRONTEND VÀ TÍCH HỢP", "Web app, trải nghiệm, ví Privy và relayer, triển "
         "khai web.", "github.com/Towfienes"),
        ("hieu.png", "Ngô Đặng Trọng Hiếu", "BACKEND VÀ KIỂM THỬ", "Keeper, SDK, rà soát và viết test.",
         "github.com/yuutosolonely"),
    ]
    pw, gap = 2.52, 0.26
    ph = pw * 5 / 4
    ty = 1.98
    for i, (img, name, role, body, gh) in enumerate(team):
        x = ML + i * (pw + gap)
        picture(s, TEAM / img, x, ty, w=pw, h=ph, radius=0.12, border=INK, bw=1.25, alt=f"Ảnh chân dung {name}")
        text(s, x, ty + ph + 0.12, pw, 0.24, role, size=9.5, font=MONO, color=INK2, spc=70)
        text(s, x, ty + ph + 0.36, pw + 0.2, 0.34, name, size=17, bold=True)
        text(s, x, ty + ph + 0.72, pw, 0.5, body, size=11.5, color=INK2, ls=1.18)
    codes = [("App trên Fuji", APP_URL, "lamng.tail3abf4e.ts.net:8443"),
             ("Mã nguồn", REPO_URL, "github.com/bminhnemhoi/T1VN_Unihack"),
             ("HuiFactory", SNOW + FACTORY, "testnet.snowtrace.io · 0x5004…5b21")]
    if VIDEO_URL:
        codes.insert(0, ("Video demo", VIDEO_URL, VIDEO_URL.replace("https://", "")[:38]))
    rx = 9.2
    qs = 0.98 if len(codes) == 4 else 1.2
    step = (ph + 0.1) / len(codes) if len(codes) == 4 else 1.5
    for i, (label, url, cap) in enumerate(codes):
        y = ty + i * step
        qr(s, url, rx, y, qs)
        text(s, rx + qs + 0.25, y + 0.1, W - MR - rx - qs - 0.25, 0.34, label, size=16, bold=True)
        text(s, rx + qs + 0.25, y + 0.46, W - MR - rx - qs - 0.25, 0.5, cap, size=10, font=MONO, color=INK2, ls=1.2)
    footer(s, "team")
    notes(s, "Đội HụiSafe có ba người. Ngô Bình Minh là trưởng nhóm, thiết kế sản phẩm và giao thức, tham số bản 1.2 "
             "và pitch. Ngô Lâm Tiến làm frontend và tích hợp: web app, trải nghiệm, ví Privy, relayer và triển khai "
             "web. Ngô Đặng Trọng Hiếu làm backend và kiểm thử: keeper, SDK, rà soát và viết test. App đang chạy trên "
             "Fuji và mã nguồn công khai; quét mã để thử. Cảm ơn ban giám khảo.")


def s_sources_press(prs):
    s = new_slide(prs)
    header(s, "src_press", "PHỤ LỤC A · NGUỒN BÁO CHÍ VÀ SỐ LIỆU THỊ TRƯỜNG", "Mỗi con số về thị trường và vỡ hụi, kèm "
           "bài báo để tự kiểm", title_size=26)
    rows = [["SỐ TRÊN SLIDE", "NGUỒN (MỞ NGÀY 21/11/2026)"]]
    for c in CASES:
        rows.append([f"{c['place']}: {c['amount']}; {c['detail']}",
                     [[{"text": f"{c['outlet']}, {c['date']}", "link": c["url"], "bold": True}]]])
    rows += [
        ["Trà Vinh: 1.607 phần hụi hốt khống", [[{"text": "VnExpress, 11/10/2023", "link": CASES[2]["url"],
                                                   "bold": True}]]],
        ["Trà Vinh: 157 phần hụi khống, trên 4 tỷ đồng, 12 năm tù", [[{"text": "VOV, 13/03/2025", "link": URL_VOV,
                                                                       "bold": True}]]],
        ["Tây Ninh: tài khoản Zalo ảo, gần 500 triệu đồng", [[{"text": "VietnamPlus, 06/10/2026", "link": URL_VNPLUS,
                                                               "bold": True}]]],
        ["Bình Thuận: hơn 100 tỷ đồng của 167 người (giai đoạn khởi tố của vụ Lâm Đồng)",
         [[{"text": "Báo Pháp luật Việt Nam, 20/09/2024", "link": URL_BPL, "bold": True}]]],
        ["TP.HCM: không chủ hụi nào thông báo theo NĐ 19", [[{"text": "Báo Đầu tư, 04/11/2024", "link": URL_BDT,
                                                              "bold": True}]]],
        ["71% có tài khoản; 34% vay gia đình, bạn bè; 10% tiết kiệm qua hội nhóm (2024)",
         [[{"text": "World Bank Global Findex Database (API)", "link": URL_FINDEX, "bold": True}]]],
        ["Tỷ lệ bỏ đóng dùng trong mô phỏng: 2,04% và 0,59% mỗi kỳ", "Klonner & Rai (2008), dữ liệu Chennai, Ấn Độ; "
         "docs/08 mục 2.2"],
    ]
    table(s, ML, 1.74, [7.25, 4.88], rows, size=11.5, head_size=9.5, row_h=0.33, head_h=0.3, pad=0.06)
    footer(s, "src_press", source="Bấm vào tên báo để mở bài gốc. Các vụ ở giai đoạn khởi tố là thông tin điều tra ban "
                                  "đầu, chưa phải bản án.")
    notes(s, "Phụ lục A liệt kê nguồn của từng con số về thị trường và vỡ hụi. Mỗi dòng dẫn tới bài báo gốc; chúng em mở "
             "lại từng bài ngày 21/11/2026. Các vụ mới khởi tố là thông tin điều tra ban đầu, chưa phải bản án.")


def s_sources_repo(prs):
    s = new_slide(prs)
    header(s, "src_repo", "PHỤ LỤC B · NGUỒN SỐ LIỆU KỸ THUẬT", "Mỗi con số kỹ thuật trên slide và file trong repo sinh "
           "ra nó", title_size=26)
    rows = [
        ["SỐ TRÊN SLIDE", "NGUỒN"],
        ["Kỳ demo 2 phút, ân hạn 1 phút; keeper khui thay sau 5 phút", "docs/03 mục 3.3; docs/05 mục 9"],
        ["Bù 8 + 2 USDC; ký quỹ 48, 46, 36, 26, 16; 104 kiểm tra", "docs/DEPLOY-FUJI.md mục 15b; đọc lại trên Fuji"],
        ["20%; 480; 600; 100%; rủi ro 400, 600, 600, 400", "docs/03 mục 2.1 đến 2.3 và 8; ADR-22"],
        ["5 contract đã verify; HuiFactory; Safe 2/3", "contracts/deployments/fuji.json; API Routescan"],
        ["3 dây, 13 kỳ, số dư 0", "docs/DEPLOY-FUJI.md mục 15, 15b; đọc lại trên Fuji 21/11/2026"],
        ["Khoảng 520.000 gas cho một kỳ dây 5 người", "docs/04 mục 7.1 (GasBudget, không ai thiếu)"],
        ["Chốt giao dịch dưới 1 giây", "docs.avax.network/solutions/performance"],
        ["634 test; 17 hàm invariant", "docs/TIEN-DO.md (20/11/2026); grep function invariant_"],
        ["Độ phủ 98,7%; 0 Critical/High (rà soát nội bộ)", "docs/09 mục 7.1; docs/TIEN-DO.md (11/11/2026)"],
        ["23,3%; 62,5%; 0,01% (10.000 dây, seed 42)", "sim/outputs/baseline.json (08/11/2026)"],
        ["Ví ảo: lỗ 18, lời 41, lời 121; 1.000, 600, 304, 94, 392, 800", "docs/03 mục 7.3; "
         "sim/outputs/organizer_sybil.json"],
        ["Hoa hồng tối đa 3% mỗi lần hốt; φ tối đa 50%", "docs/03 mục 2.7 và 3.1"],
        ["Eval trợ lý 33/33 (mô hình giả lập)", "docs/TIEN-DO.md (M4)"],
    ]
    table(s, ML, 1.74, [6.9, 5.23], rows, size=11.5, head_size=9.5, row_h=0.33, head_h=0.3, pad=0.06)
    footer(s, "src_repo")
    notes(s, "Phụ lục B liệt kê nguồn của từng con số kỹ thuật để ban giám khảo tự kiểm trong repo. Số mô phỏng lấy từ "
             "file JSON trong sim/outputs, số Fuji lấy từ docs/DEPLOY-FUJI.md và đọc lại trên chuỗi.")


def s_commission(prs):
    s = new_slide(prs)
    header(s, "commission", "PHỤ LỤC C · TIỀN CÔNG CHỦ HỤI", "Hoa hồng của chủ hụi nằm trong trần lãi, nên người hốt "
           "không phải trả quá trần", chip="Creativity & Innovation", title_size=26)
    lx, lw = ML, 7.15
    text(s, lx, Y0 - 0.06, lw, 0.3, "Kỳ 2 của dây mẫu, hoa hồng lấy tối đa 50% quỹ lãi: quỹ lãi luật cho phép là "
         "14,79 USDC", size=13.5, color=INK2)
    total = 14.794518
    segs = [(7.2, INK, IVORY, "Thăm 2,40 × 3 người = 7,20"), (7.397259, LIME, INK, "Hoa hồng 7,40")]
    x = lx
    for val, fill, fg, label in segs:
        wv = lw * val / total
        rect(s, x, Y0 + 0.36, wv, 0.66, fill=fill)
        text(s, x + 0.15, Y0 + 0.36, wv - 0.2, 0.66, label, size=14.5, bold=True, color=fg, anchor="m")
        x += wv
    rect(s, x, Y0 + 0.36, lx + lw - x, 0.66, fill=PAPER, line=INK2, lw=0.75)
    text(s, lx, Y0 + 1.1, lw, 0.32, "7,20 + 7,40 = 14,60, không vượt 14,79 USDC", size=13, font=MONO, color=INK)
    facts = [
        "Chủ hụi nhận tối đa một nửa quỹ lãi và không quá 3% mỗi lần hốt; phần còn lại dành cho thăm.",
        "Chân của chủ hụi hốt thì kỳ đó không có hoa hồng.",
        "Kỳ không ai thiếu: hoa hồng trả ngay. Kỳ có người thiếu: giữ lại; người đó vỡ nợ thì khoản này vào quỹ dự "
        "phòng.",
    ]
    text(s, lx, Y0 + 1.68, lw, 2.5, facts, size=15, ls=1.2, after=10, bullet=True)
    rx, rw = 8.25, W - MR - 8.25
    text(s, rx, Y0 - 0.06, rw, 0.62, "Quỹ dự phòng cuối dây chia theo số kỳ đóng đúng hạn, USDC", size=14.5, bold=True,
         ls=1.15)
    shares = [("M1", "4,15", 4.146821), ("M2", "4,15", 4.14682), ("M3", "4,15", 4.14682),
              ("M4 trễ 1 kỳ", "3,11", 3.110115), ("M5", "4,15", 4.14682)]
    for i, (who, label, v) in enumerate(shares):
        y = Y0 + 0.74 + i * 0.5
        late = "trễ" in who
        text(s, rx, y, 1.25, 0.38, who, size=12, font=MONO, color=(INK if late else INK2), bold=late, anchor="m")
        bwv = 1.9 * v / 4.146821
        rect(s, rx + 1.3, y + 0.06, bwv, 0.26, fill=(INK2 if late else INK))
        text(s, rx + 1.3 + bwv + 0.1, y, 1.0, 0.38, label, size=12, font=MONO, anchor="m")
    text(s, rx, Y0 + 3.3, rw, 0.9, "Trễ một kỳ, M4 nhận ít hơn 1,04 USDC so với người đóng đúng hạn. Người vỡ nợ nhận "
         "0.", size=14, color=INK2, ls=1.22)
    footer(s, "commission", source="Dây mẫu 5 người × 100 USDC. Hoa hồng: docs/03 mục 2.7, 8.1. Quỹ dự phòng: docs/03 "
                                   "mục 8.2, nhánh A. Số làm tròn 2 chữ số. Trần lãi NĐ 19 Điều 21: cách hiểu đề xuất, "
                                   "cần luật sư xác nhận.")
    notes(s, "Phụ lục C: bản 1.2 trả công chủ hụi theo cách không ăn vào trần lãi. Mỗi kỳ có một quỹ lãi tối đa luật "
             "cho phép; chủ hụi nhận tối đa một nửa quỹ đó và không quá 3% mỗi lần hốt, phần còn lại dành cho thăm. Ví "
             "dụ kỳ 2: thăm 2,40 nhân 3 người là 7,20, hoa hồng 7,40, tổng 14,60, không vượt quỹ lãi 14,79 USDC. Chân "
             "của chủ hụi hốt thì kỳ đó không thu hoa hồng. Cuối dây, quỹ dự phòng chia theo số kỳ đóng đúng hạn: "
             "người trễ một kỳ nhận 3,11 thay vì 4,15 USDC.")


def s_economics(prs):
    s = new_slide(prs)
    header(s, "economics", "PHỤ LỤC D · CHỦ HỤI LỜI BAO NHIÊU", "Theo mô phỏng, chủ hụi dây tháng lời khoảng 5% một năm "
           "trên ký quỹ, dây tuần ít người thì lỗ", title_size=26)
    rows = [
        ["CHU KỲ, SỐ NGƯỜI", "TIỀN CÔNG CỐ ĐỊNH 1%", "HOA HỒNG 33% QUỸ LÃI", "HOA HỒNG 50% QUỸ LÃI"],
        ["Tuần, 5 người", "15,0%", "−19,6%", "−15,5%"],
        ["Tháng, 5 người", "3,4%", "1,8%", "5,2%"],
        ["Tháng, 10 người", "1,5%", "3,9%", "5,2%"],
        ["Thăm + hoa hồng nằm trong trần lãi?", "Không", "Có", "Có"],
    ]
    table(s, ML, Y0, [3.6, 2.85, 2.85, 2.83], rows, size=15, row_h=0.56, head_h=0.42, num_cols=(1, 2, 3), hi_col=3)
    rect(s, ML, 5.0, CW, 1.2, fill=PAPER, line=LINE, lw=1, radius=0.08)
    text(s, ML + 0.25, 5.0, CW - 0.5, 1.2, [
        {"text": "Kết quả của giả định, không phải dự báo.", "bold": True, "color": INK},
        "Lời sau rủi ro trên ký quỹ, quy theo năm. Mức góp 100 USDC, giữ lại 20%, ký quỹ cho chỉ số 100%, người hốt "
        "bỏ thăm 50% trần, tỷ lệ bỏ đóng theo Klonner & Rai (2008).",
    ], size=13.5, color=INK2, ls=1.22, after=2, anchor="m")
    footer(s, "economics", source="Nguồn: sim/outputs/organizer_economics.json và .meta.json (10/11/2026), trường "
                                  "annualReturnPctByHazardScale và insideInterestCap; làm tròn 1 chữ số; docs/08 mục "
                                  "2.7.")
    notes(s, "Phụ lục D trả lời câu hỏi chủ hụi có lời không. Với hoa hồng nằm trong trần, chủ hụi dây tháng lời khoảng "
             "5% một năm trên ký quỹ ở giả định này, còn dây tuần ít người thì lỗ. Mức cố định 1% trông cao ở dây tuần "
             "vì nó vượt trần lãi của người hốt. Đây là kết quả của giả định, không phải dự báo.")


def s_ai(prs):
    s = new_slide(prs)
    header(s, "ai", "PHỤ LỤC E · TRỢ LÝ CHỦ HỤI", "Trợ lý AI chỉ đọc và tính bằng hàm tất định, không ký giao dịch",
           title_size=26)
    do = [
        "Tính rủi ro theo từng kỳ và mức rủi ro lớn nhất của dây.",
        "Gợi ý ký quỹ để đạt chỉ số bảo chứng mục tiêu.",
        "Lập bảng trần thăm theo kỳ, kèm hoa hồng.",
        "Tra kết quả mô phỏng đã chạy sẵn.",
        "Trích văn bản NĐ 19 đã duyệt, có số điều.",
        "Soạn nháp thông báo UBND cấp xã; người dùng tự điền nhân thân trên máy.",
    ]
    dont = [
        "Không ký giao dịch, không chuyển tiền, không chọn người hốt.",
        "Không nhận dữ liệu cá nhân; địa chỉ ví duy nhất nó thấy là dây đang xem.",
        "Không thu phí, không tư vấn; câu trả lời nào cũng ghi “Đây là thông tin tham khảo, không phải tư vấn tài chính "
        "hay pháp lý”.",
    ]
    cw = (CW - 0.4) / 2
    for i, (title, items) in enumerate([("Làm", do), ("Không làm", dont)]):
        x = ML + i * (cw + 0.4)
        rect(s, x, Y0 - 0.1, cw, 3.95, fill=PAPER, line=LINE, lw=1, radius=0.1)
        text(s, x + 0.3, Y0 + 0.05, cw - 0.6, 0.42, title, size=20, bold=True, color=(INK if i == 0 else RED_INK))
        text(s, x + 0.3, Y0 + 0.6, cw - 0.6, 3.2, items, size=14.5, ls=1.2, after=8, bullet=True,
             bullet_color=(INK if i == 0 else RED_INK))
    text(s, ML, 6.14, CW, 0.3, "Bộ eval 33/33 ca đạt khi chạy với mô hình giả lập; chưa chạy eval với mô hình thật. "
         "Tắt trợ lý thì các luồng chính vẫn chạy.", size=12.5, color=INK2)
    footer(s, "ai", source="Nguồn: docs/05 mục 8.4 và 12; docs/07; ADR-12 (LLM không ký, không quyết định chuyển tiền; "
                           "đúng luật 4 của BTC).")
    notes(s, "Phụ lục E mô tả trợ lý chủ hụi. Mọi con số do hàm tính tất định của HụiSafe trả về; mô hình AI chỉ chọn "
             "công cụ và viết lời giải thích. Trợ lý không có công cụ nào ký giao dịch hay chuyển tiền, không nhận dữ "
             "liệu cá nhân, và luôn ghi rõ đây không phải tư vấn tài chính hay pháp lý.")


ORDER = [
    ("cover", s_cover), ("demo", s_demo), ("context", s_context), ("news", s_news), ("pain", s_pain),
    ("idea", s_idea), ("product", s_product), ("landing", s_landing), ("ux", s_ux), ("round", s_round),
    ("cascade", s_cascade), ("coverage", s_coverage), ("arch", s_arch), ("avalanche", s_avalanche), ("fuji", s_fuji),
    ("tests", s_tests), ("questions", s_questions), ("law", s_law), ("limits", s_limits), ("roadmap", s_roadmap),
    ("team", s_team), ("src_press", s_sources_press), ("src_repo", s_sources_repo), ("commission", s_commission),
    ("economics", s_economics), ("ai", s_ai),
]


def build() -> Path:
    global TOTAL
    TOTAL = len(ORDER)
    NUM.update({key: i + 1 for i, (key, _) in enumerate(ORDER)})
    prs = Presentation()
    prs.slide_width = Emu(12192000)
    prs.slide_height = Emu(6858000)
    tune_theme(prs)
    for _, fn in ORDER:
        fn(prs)
    assert len(prs.slides) == TOTAL, len(prs.slides)
    prs.core_properties.title = "HụiSafe · UniHack 2026"
    prs.core_properties.author = "Đội HụiSafe"
    prs.core_properties.language = "vi-VN"
    prs.save(OUT)
    return OUT


if __name__ == "__main__":
    print(build())
