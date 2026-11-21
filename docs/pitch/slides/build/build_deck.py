#!/usr/bin/env python3
"""Build the HuiSafe UniHack 2026 submission deck (task B29).

Every visible word is a real text box (no text baked into images) and every slide carries Vietnamese speaker notes.
Numbers come from docs/03, docs/05, docs/DEPLOY-FUJI.md, sim/outputs/*.json and the B29 brief; appendix A of the
deck lists the source of each figure.

Rebuild (libraries live in a throwaway venv, never in the repo's package.json or pyproject):
    python3 -m venv /tmp/hui-slides-venv
    /tmp/hui-slides-venv/bin/pip install -r docs/pitch/slides/build/requirements.txt
    /tmp/hui-slides-venv/bin/python docs/pitch/slides/build/build_deck.py
    bash docs/pitch/slides/build/render.sh        # pptx -> pdf -> preview/*.png (LibreOffice in Docker)

Fonts: Inter Tight + IBM Plex Mono (Google Fonts, OFL). Google Slides has both; install them locally to render.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import qrcode
from lxml import etree
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

TOTAL = 23
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


def header(slide, num, kicker, title, *, chip=None, dark=False, title_size=32):
    kc = MUTE if dark else INK2
    label = f"{num:02d} · {kicker}" if isinstance(num, int) else f"{num} · {kicker}"
    text(slide, ML, 0.42, 8.6, 0.3, label, size=11, font=MONO, color=kc, spc=90)
    if chip:
        cw = 0.36 + 0.0875 * len(chip)
        cx = W - MR - cw
        rect(slide, cx, 0.36, cw, 0.36, line=(LINE_D if dark else LINE), lw=1, radius=0.06)
        text(slide, cx, 0.36, cw, 0.36, chip, size=10.5, font=MONO, color=kc, align="c", anchor="m")
    text(slide, ML, 0.82, CW, 1.3, title, size=title_size, bold=True, color=(IVORY if dark else INK), ls=1.1)


def footer(slide, num, *, dark=False, source=None):
    c = MUTE if dark else INK2
    if source:
        text(slide, ML, 6.42, CW, 0.52, source, size=10, font=MONO, color=c, ls=1.2, anchor="b")
    text(slide, ML, 7.06, 6.0, 0.22, "HụiSafe · UniHack 2026", size=10, font=MONO, color=c)
    label = f"{num:02d} / {TOTAL:02d}" if isinstance(num, int) else f"{num} / {TOTAL:02d}"
    text(slide, W - MR - 2.0, 7.06, 2.0, 0.22, label, size=10, font=MONO, color=c, align="r")


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


# ---------------------------------------------------------------------------------------------------------------------
# Slides
# ---------------------------------------------------------------------------------------------------------------------


def s01_cover(prs):
    s = new_slide(prs)
    text(s, ML, 0.5, CW, 0.35, "Team1 Vietnam UniHack 2026 · Build on Avalanche", size=13, font=MONO, color=INK2,
         spc=60)
    logo_h = 1.05
    logo_w = logo_h * 1408 / 904
    picture(s, ASSETS / "brand" / "huisafe-logo.png", (W - logo_w) / 2, 1.1, w=logo_w, h=logo_h,
            alt="Logo HụiSafe: lá thăm có đồng xu chữ U")
    text(s, 0, 2.2, W, 1.55, "HụiSafe", size=104, bold=True, align="c", anchor="m", ls=1.0, spc=-250)
    text(s, 0, 3.9, W, 0.55, "Hụi bỏ thăm on-chain trên Avalanche", size=30, color=INK, align="c", anchor="m")
    text(s, 0, 4.58, W, 0.32, "Track Social finance · Đề #01: Hụi on-chain (ROSCA)", size=13, font=MONO, color=INK2,
         align="c", anchor="m", spc=40)

    rect(s, 0, 5.32, W, H - 5.32, fill=DEEP)
    fw, gap, fy, fh = (CW - 2 * 0.3) / 3, 0.3, 5.66, 1.5
    frames = [
        ("TỔ CHỨC", "team1vietnam-white.png", 2.7, 2.7 * 66 / 597, "Logo Team1 Vietnam"),
        ("MẠNG", "avalanche-ko.png", 2.5, 2.5 * 271 / 1835, "Logo Avalanche"),
        ("NHÀ TÀI TRỢ", "mexc-ventures.png", 0.86 * 353 / 400, 0.86, "Logo MEXC Ventures"),
    ]
    for i, (label, img, lw, lh, alt) in enumerate(frames):
        fx = ML + i * (fw + gap)
        rect(s, fx, fy, fw, fh, fill=INK, line=LINE_D, lw=1, radius=0.12)
        text(s, fx + 0.25, fy + 0.18, fw - 0.5, 0.25, label, size=10.5, font=MONO, color=MUTE, spc=90)
        ly = fy + 0.42 + (fh - 0.42 - 0.12 - lh) / 2
        picture(s, ASSETS / "brand" / img, fx + (fw - lw) / 2, ly, w=lw, h=lh, alt=alt)
    notes(s, "Chào ban giám khảo. Chúng em là đội HụiSafe, dự thi track Social finance với đề số 1, hụi on-chain. "
             "HụiSafe là hụi bỏ thăm chạy bằng smart contract trên Avalanche: tiền góp nằm trong ví của từng thành "
             "viên cho tới đúng lúc chi, còn chủ hụi phải khóa một khoản ký quỹ để bù khi có người bỏ đóng. "
             "Slide tiếp theo là phần khai báo chế độ demo, theo luật của ban tổ chức.")


def s02_demo(prs):
    s = new_slide(prs)
    header(s, 2, "KHAI BÁO CHẾ ĐỘ DEMO", "Bản demo chạy trên Fuji testnet và tua nhanh thời gian; trần lãi vẫn tính "
           "như hụi tháng", chip="Luật BTC: dev toggle")
    rows = [
        ["", "BẢN DEMO", "DÂY THẬT"],
        ["Một kỳ hụi", "2 phút: 75 giây nộp thăm kín, 45 giây mở thăm", "30 ngày"],
        ["Ân hạn khi đóng trễ", "1 phút", "48 giờ"],
        ["Chủ hụi chưa khui kỳ thì keeper khui thay sau", "5 phút", "24 giờ"],
        ["Kỳ dùng để tính trần lãi, lãi chậm góp", "30 ngày", "30 ngày"],
    ]
    table(s, ML, 2.2, [4.75, 5.15, 2.23], rows, size=17, row_h=0.6, head_h=0.42, bold_cols=(1,))
    rect(s, ML, 5.48, CW, 0.82, fill=LIME, radius=0.06)
    text(s, ML + 0.3, 5.48, CW - 0.6, 0.82, "Tiền trong demo là USDC thử nghiệm, không có giá trị. Phí mạng do "
         "relayer HụiSafe trả. HụiSafe không sinh lãi và không có token.", size=17, bold=True, anchor="m",
         ls=1.25)
    footer(s, 2, source="Nguồn: docs/03 mục 3.3; docs/05 mục 9. Hai dây chạy ngày 11/11/2026 (slide 12) dùng kỳ "
                        "3 phút, ân hạn 2 phút.")
    notes(s, "Trước khi bắt đầu, chúng em xin khai báo dev toggle. Bản demo chạy trên Avalanche Fuji testnet và tua "
             "nhanh thời gian: mỗi kỳ hụi chỉ 2 phút, gồm 75 giây nộp thăm kín và 45 giây mở thăm, thay vì 30 ngày. "
             "Ân hạn đóng trễ là 1 phút thay vì 48 giờ. Chủ hụi khui kỳ; quá 5 phút mà chủ hụi chưa khui thì keeper "
             "khui thay. Trần lãi và lãi chậm góp vẫn tính như kỳ 30 ngày. Tiền trong demo là USDC thử nghiệm, không "
             "có giá trị, và phí mạng do relayer HụiSafe trả. Sản phẩm không sinh lãi và không có token. Trong video, "
             "mỗi kỳ mất khoảng 2 đến 3 phút vì chủ hụi khui sau khi hết giờ mở thăm.")


def s03_problem(prs):
    s = new_slide(prs, DEEP)
    header(s, 3, "VẤN ĐỀ", "Ba vụ vỡ hụi gần đây có chung một điểm: một người cầm tiền của cả dây",
           chip="Impact & Use Case", dark=True)
    rows = [
        ("BÌNH THUẬN · 2024", "100 tỷ đồng",
         "Chủ hụi bịa ra người bán hụi để thu tiền, chiếm đoạt hơn 100 tỷ đồng của 167 người.",
         "Báo Pháp luật, 20/09/2024"),
        ("TRÀ VINH · 2025", "157 phần hụi",
         "Chủ hụi lập dây trên Zalo, đặt tên hụi viên khống để tự hốt 157 phần, hơn 4 tỷ đồng. Án 12 năm tù.",
         "VOV, 13/03/2025"),
        ("TÂY NINH · 2026", "500 triệu đồng",
         "Chủ hụi dùng nhiều tài khoản Zalo ảo để bỏ thăm và hốt, chiếm đoạt gần 500 triệu đồng.",
         "VietnamPlus, 06/10/2026"),
    ]
    y0, rh = 2.18, 1.1
    rule(s, ML, y0, W - MR, y0, color=LINE_D, dotted=True)
    for i, (place, big, desc, src) in enumerate(rows):
        y = y0 + i * rh
        text(s, ML, y + 0.22, 2.2, 0.3, place, size=11, font=MONO, color=MUTE, spc=80)
        text(s, 2.75, y + 0.12, 4.4, 0.8, big, size=40, bold=True, color=LIME, anchor="m", ls=1.0)
        text(s, 7.25, y + 0.12, 5.48, 0.62, desc, size=17, color=IVORY, ls=1.2)
        text(s, 7.25, y + 0.8, 5.48, 0.24, src, size=10, font=MONO, color=MUTE)
        rule(s, ML, y + rh, W - MR, y + rh, color=LINE_D, dotted=True)
    text(s, ML, 5.6, 11.6, 0.72, [[
        "Rủi ro còn đến từ thành viên: ở chit fund tại Chennai (Ấn Độ), ",
        {"text": "2,04%", "color": LIME, "bold": True},
        " người hốt sớm và ",
        {"text": "0,59%", "color": LIME, "bold": True},
        " người hốt muộn bỏ đóng sau khi đã hốt.",
    ]], size=17, color=IVORY, ls=1.3)
    footer(s, 3, dark=True, source="Nguồn: bài báo ghi ở từng dòng (mở lại 21/11/2026). Klonner & Rai (2008): tỷ lệ "
                                   "trên mỗi người hốt trong cả vòng đời dây, dữ liệu Chennai, không phải hụi Việt Nam "
                                   "(docs/08 mục 2.2).")
    notes(s, "Ba vụ vỡ hụi này đều có nguồn báo chí. Ở Bình Thuận, chủ hụi bịa ra người bán hụi để thu tiền, chiếm "
             "đoạt hơn 100 tỷ đồng của 167 người. Ở Trà Vinh, chủ hụi lập dây trên Zalo, đặt tên hụi viên khống để tự "
             "hốt 157 phần và bị tuyên 12 năm tù. Ở Tây Ninh, chủ hụi dùng tài khoản Zalo ảo để bỏ thăm và hốt. Điểm "
             "chung là một người cầm tiền của cả dây. Kể cả khi chủ hụi tử tế, người đã hốt vẫn có thể bỏ đóng và "
             "người hốt sau chịu thiệt. Hai con số 2,04% và 0,59% là dữ liệu chit fund ở Chennai, Ấn Độ; chúng em "
             "nói rõ đây không phải số đo của hụi Việt Nam.")


def s04_idea(prs):
    s = new_slide(prs)
    header(s, 4, "Ý TƯỞNG", "HụiSafe bỏ việc giữ tiền của chủ hụi nhưng giữ lại việc bảo lãnh",
           chip="Creativity & Innovation")
    text(s, ML, 2.14, 11.9, 0.8, "Chủ hụi truyền thống làm hai việc: giữ tiền góp, và bù cho người hốt sau khi có "
         "người đã hốt bỏ đóng (NĐ 19/2019 Điều 18 khoản 4). Hụi on-chain thông thường bỏ cả hai việc, nên người hốt "
         "sau tự gánh rủi ro.", size=17, color=INK2, ls=1.28)
    rows = [
        ["", "HỤI TRUYỀN THỐNG", "HỤI ON-CHAIN THÔNG THƯỜNG", "HỤISAFE"],
        ["Ai giữ tiền góp", "Chủ hụi", "Smart contract, theo luật cố định",
         "Ví của từng người, tới đúng lúc chi"],
        ["Ai bù khi người đã hốt bỏ đóng", "Chủ hụi, nếu còn tiền", "Không ai: người hốt sau chịu",
         "Ký quỹ của chủ hụi, khóa trong smart contract"],
        ["Rủi ro lớn nhất", "Chủ hụi ôm tiền, lập hụi viên ảo", "Người đã hốt bỏ đóng",
         "Người đã hốt bỏ đóng lần lượt, vượt ký quỹ (slide 17)"],
    ]
    table(s, ML, 3.08, [2.75, 2.9, 3.05, 3.43], rows, size=16, row_h=0.86, head_h=0.44, hi_col=3, bold_cols=(0,))
    footer(s, 4, source="Nguồn: docs/03 (luận điểm thiết kế ở đầu file); docs/10 mục 1.")
    notes(s, "Chủ hụi truyền thống có hai vai. Vai thứ nhất là giữ tiền, và đây là gốc của các vụ ôm tiền hay lập hụi "
             "viên ảo. Vai thứ hai là bảo lãnh: Nghị định 19 Điều 18 khoản 4 giao cho chủ hụi trách nhiệm bù khi "
             "người đã hốt không đóng. Các bản hụi on-chain thông thường bỏ cả hai vai, nên khi người hốt trước bỏ "
             "đóng thì không còn ai bù cho người hốt sau. HụiSafe giữ lại đúng vai bảo lãnh: chủ hụi không cầm tiền "
             "góp, nhưng phải khóa ký quỹ trong smart contract để bù. Rủi ro còn lại của HụiSafe nằm ở slide 17.")


def s05_product(prs):
    s = new_slide(prs)
    header(s, 5, "SẢN PHẨM", "HụiSafe là web app chơi hụi bỏ thăm, dùng được trên điện thoại và máy tính",
           chip="UI/UX & Demo")
    items = [
        "Đăng nhập Google hoặc email là có ví. Không cần AVAX: relayer trả phí mạng.",
        "Smart contract kéo tiền góp và chi cho người hốt trong cùng một giao dịch.",
        "Chỉ số bảo chứng hiện trước khi vào dây; mọi khoản tiền đều vào sổ hụi công khai.",
    ]
    for i, t in enumerate(items):
        y = 2.24 + i * 0.98
        numbered_dot(s, ML, y + 0.02, str(i + 1))
        text(s, ML + 0.55, y, 4.25, 1.0, t, size=16, ls=1.25)
    text(s, ML, 5.3, 4.8, 0.5, [[{"text": "Chạy thử: ", "color": INK2},
                                  {"text": "lamng.tail3abf4e.ts.net:8443", "link": APP_URL, "bold": True}]],
         size=13, font=MONO)
    dw, dx, dy = 6.85, 5.62, 2.1
    picture(s, ASSETS / "screens" / "d-room.png", dx, dy, w=dw, h=dw * 900 / 1440, radius=0.1, border=LINE, bw=1,
            alt="Ảnh chụp app trên máy tính: phòng bỏ thăm kỳ 3 của dây mẫu, dữ liệu mẫu")
    ph = 3.55
    pw = ph * 780 / 1688
    picture(s, ASSETS / "screens" / "m-result.png", W - MR - pw + 0.05, 2.75, w=pw, h=ph, radius=0.2, border=INK,
            bw=2.5, alt="Ảnh chụp app trên điện thoại: kết quả kỳ 2, thành viên 1 nhận 323,18 USDC, dữ liệu mẫu")
    footer(s, 5, source="Ảnh chụp app, dữ liệu mẫu (dây 5 người × 100 USDC theo docs/03 mục 8). Máy tính: phòng bỏ "
                        "thăm kỳ 3. Điện thoại: kết quả kỳ 2.")
    notes(s, "HụiSafe là web app. Thành viên đăng nhập bằng Google hoặc email, ví được tạo sẵn, không cần mua AVAX. Mỗi "
             "kỳ, smart contract kéo tiền góp từ ví từng người và chi cho người hốt trong cùng một giao dịch, nên giữa "
             "các kỳ không ai cầm tiền. Trước khi vào dây, thành viên thấy chỉ số bảo chứng; sau mỗi kỳ, sổ hụi ghi "
             "lại từng đồng. Ảnh trên slide chụp từ app với dữ liệu mẫu theo ví dụ trong đặc tả; bản đang chạy trên Fuji "
             "ở địa chỉ ghi trên slide.")


def s06_round(prs):
    s = new_slide(prs)
    header(s, 6, "MỘT KỲ HỤI", "Tới hạn, một giao dịch làm hết việc của kỳ: kéo tiền góp, bù khoản thiếu, chi cho "
           "người hốt", chip="Technical Implementation")
    steps = [
        ("Vào dây", "Ký một lần, cho phép trích tối đa 404 USDC. Tiền vẫn nằm trong ví mình."),
        ("Thăm kín", "Nộp hash của thăm, hết giờ mới mở. Thăm cao nhất thắng, không bốc thăm."),
        ("Khui kỳ", "Chủ hụi bấm khui. Chủ hụi vắng thì keeper hay bất kỳ ai cũng gọi được."),
        ("Kéo, bù, chi", "Smart contract kéo tiền góp, bù ngay khoản thiếu (slide 7), chi cho người hốt."),
        ("Sổ hụi", "Mỗi dòng sổ có mã giao dịch, ai cũng mở được trên Snowtrace."),
    ]
    bw, gap, by, bh = 2.15, (CW - 5 * 2.15) / 4, 2.2, 3.05
    for i, (title, body) in enumerate(steps):
        bx = ML + i * (bw + gap)
        hi = i == 3
        rect(s, bx, by, bw, bh, fill=(LIME if hi else PAPER), line=(None if hi else LINE), lw=1, radius=0.1)
        text(s, bx + 0.2, by + 0.2, bw - 0.4, 0.3, f"{i + 1:02d}", size=12, font=MONO, color=(INK if hi else INK2),
             bold=True)
        text(s, bx + 0.2, by + 0.5, bw - 0.4, 0.45, title, size=19, bold=True)
        text(s, bx + 0.2, by + 0.98, bw - 0.4, 1.95, body, size=16, ls=1.22)
        if i < 4:
            connector(s, bx + bw + 0.05, by + bh / 2, bx + bw + gap - 0.05, by + bh / 2, lw=1.5)
    text(s, ML, 5.47, CW, 0.9, [
        "404 USDC = (5 − 1) × (100 + 1): dây mẫu 5 người góp 100 USDC mỗi kỳ, cộng 1 USDC cọc mở thăm.",
        "Bằng thăm thì ai ít lần trễ hơn thắng, rồi tới ai nộp trước. Trần thăm theo NĐ 19 Điều 21 là cách hiểu đề "
        "xuất, cần luật sư xác nhận.",
    ], size=16, color=INK2, ls=1.25, after=4)
    footer(s, 6, source="Nguồn: docs/03 mục 2.6, 6.2 đến 6.5; docs/05 mục 9 (lượt khui của chủ hụi).")
    notes(s, "Một kỳ hụi đi qua năm bước. Lúc vào dây, thành viên ký một lần cho phép dây trích tối đa một số tiền cố "
             "định, với dây mẫu là 404 USDC; tiền vẫn ở ví của họ. Mỗi kỳ, ai muốn hốt thì nộp thăm kín, tức là chỉ "
             "nộp mã hash, hết giờ mới mở. Thăm cao nhất thắng; bằng nhau thì ai ít lần trễ hơn thắng, rồi tới ai nộp "
             "trước, không bốc thăm. Hết giờ, chủ hụi bấm khui; chủ hụi vắng thì keeper hay bất kỳ ai cũng gọi được. "
             "Một giao dịch duy nhất kéo tiền góp, bù khoản thiếu và chi cho người hốt. Mọi bước đều vào sổ hụi kèm "
             "mã giao dịch.")


def s07_cascade(prs):
    s = new_slide(prs)
    header(s, 7, "KHI CÓ NGƯỜI BỎ ĐÓNG", "Ví M4 không đủ tiền ở kỳ 2, nhưng người hốt kỳ đó vẫn nhận đủ 32,318 USDC",
           chip="Creativity & Innovation")
    text(s, ML, 2.14, 6.9, 0.62, "Tới hạn mà không trích được tiền của M4, smart contract bù ngay trong giao dịch khui "
         "kỳ, lần lượt từ bốn nguồn:", size=17, color=INK2, ls=1.22)
    tiers = [
        ("Tiền giữ lại của chính M4", "8 USDC", True),
        ("Ký quỹ của chủ hụi", "2 USDC", True),
        ("Quỹ dự phòng", "0", False),
        ("Người hốt nhận thiếu, ghi khoản đòi", "0", False),
    ]
    for i, (label, amt, used) in enumerate(tiers):
        x = ML + i * 0.28
        w = 6.9 - i * 0.28
        y = 2.95 + i * 0.8
        rect(s, x, y, w, 0.66, fill=(LIME if used else PAPER), line=(None if used else LINE), lw=1, radius=0.08)
        text(s, x + 0.22, y, 0.4, 0.66, str(i + 1), size=13, font=MONO, bold=True, color=(INK if used else INK2),
             anchor="m")
        text(s, x + 0.62, y, w - 2.1, 0.66, label, size=17, bold=used, color=(INK if used else INK2), anchor="m")
        text(s, x + w - 1.45, y, 1.25, 0.66, amt, size=20, font=MONO, bold=True, color=(INK if used else INK2),
             align="r", anchor="m")

    cx = 8.15
    text(s, cx, 2.16, 4.58, 0.3, "KÝ QUỸ SAU TỪNG KỲ, USDC", size=11, font=MONO, color=INK2, spc=80)
    vals = [48, 46, 36, 26, 16]
    base_y, top_y = 4.95, 2.98
    bwid, bgap = 0.62, 0.37
    for i, v in enumerate(vals):
        bh = (base_y - top_y) * v / 48
        bx = cx + i * (bwid + bgap)
        rect(s, bx, base_y - bh, bwid, bh, fill=INK)
        text(s, bx - 0.2, base_y - bh - 0.36, bwid + 0.4, 0.3, str(v), size=16, font=MONO, bold=True, align="c")
        text(s, bx - 0.2, base_y + 0.08, bwid + 0.4, 0.26, f"Kỳ {i + 1}", size=11, font=MONO, color=INK2, align="c")
    rule(s, cx - 0.05, base_y, cx + 5 * bwid + 4 * bgap + 0.05, base_y, color=INK, lw=1)
    text(s, cx, 5.45, 4.6, 0.6, "Quá ân hạn, M4 bị ghi vỡ nợ; ký quỹ bù phần của M4 ở kỳ 3, 4, 5.", size=16,
         color=INK2, ls=1.22)
    footer(s, 7, source="Dây 0xc628…5Bfc trên Fuji, 11/11/2026: script chạy bằng ví demo của đội (M4 tự thu hồi quyền "
                        "trích), không phải người dùng thật bỏ đóng. Số tiền bằng 1/10 dây mẫu docs/03 mục 8; 104 "
                        "kiểm tra đạt (docs/DEPLOY-FUJI.md mục 15b).")
    notes(s, "Đây là dây chạy thật trên Fuji ngày 11/11. Kỳ 1, M4 thắng thăm và hốt. Trước kỳ 2, M4 thu hồi quyền "
             "trích, nên tới hạn ví M4 không trả được 10 USDC. Ngay trong giao dịch khui kỳ, smart contract lấy 8 USDC "
             "từ tiền giữ lại của chính M4 và 2 USDC từ ký quỹ, nên M1, người hốt kỳ 2, vẫn nhận đủ 32,318 USDC. Quá "
             "ân hạn, M4 bị ghi vỡ nợ; ở kỳ 3, 4 và 5, ký quỹ bù phần của M4 và còn 16 USDC lúc tất toán. Chúng em nói "
             "rõ: đây là kịch bản do script chạy bằng ví của đội, số tiền bằng một phần mười dây mẫu trong đặc tả, "
             "không phải người dùng thật bỏ đóng.")


def s08_coverage(prs):
    s = new_slide(prs)
    header(s, 8, "CHỈ SỐ BẢO CHỨNG", "Dây chỉ bắt đầu được khi chỉ số bảo chứng đạt 100%",
           chip="Creativity & Innovation")
    y, h = 2.2, 1.85
    rect(s, ML, y, 2.75, h, fill=PAPER, line=LINE, lw=1, radius=0.1)
    text(s, ML, y + 0.15, 2.75, 1.0, "20%", size=60, font=MONO, bold=True, align="c", anchor="m")
    text(s, ML + 0.2, y + 1.2, 2.35, 0.55, "tiền giữ lại của người đã hốt", size=14, color=INK2, align="c", ls=1.15)
    text(s, 3.43, y, 0.6, h, "+", size=40, font=MONO, color=INK2, align="c", anchor="m")
    rect(s, 4.1, y, 4.55, h, fill=PAPER, line=LINE, lw=1, radius=0.1)
    text(s, 4.1, y + 0.15, 4.55, 1.0, "480 / 600", size=56, font=MONO, bold=True, align="c", anchor="m")
    text(s, 4.3, y + 1.2, 4.15, 0.55, "ký quỹ / rủi ro lớn nhất, USDC", size=14, color=INK2, align="c")
    text(s, 8.72, y, 0.6, h, "=", size=40, font=MONO, color=INK2, align="c", anchor="m")
    rect(s, 9.4, y, W - MR - 9.4, h, fill=LIME, radius=0.1)
    text(s, 9.4, y + 0.15, W - MR - 9.4, 1.0, "100%", size=66, font=MONO, bold=True, align="c", anchor="m")
    text(s, 9.6, y + 1.2, W - MR - 9.8, 0.55, "chỉ số bảo chứng", size=14, bold=True, align="c")
    text(s, ML, 4.25, CW, 0.7, "Rủi ro lớn nhất là số tiền những người đã hốt còn phải góp, cao nhất ở giữa dây. Dây "
         "mẫu 5 người góp 100 USDC: 2 người đã hốt × 3 kỳ còn lại × 100 = 600 USDC.", size=17, color=INK2, ls=1.28)
    rect(s, ML, 5.05, CW, 0.88, fill=PAPER, line=INK, lw=1.25, radius=0.08)
    text(s, ML + 0.3, 5.05, CW - 0.6, 0.88, "“Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi "
         "người đã hốt cùng bỏ đóng một lúc.”", size=19, bold=True, anchor="m", ls=1.18)
    text(s, ML, 6.03, CW, 0.32, "Người đã hốt bỏ đóng lần lượt qua nhiều kỳ thì tổng khoản thiếu có thể vượt ký quỹ: "
         "xem slide 17.", size=15, color=INK2)
    footer(s, 8, source="Nguồn: docs/03 mục 2.1 đến 2.3, 7.3; sàn 100% trên Fuji theo ADR-22.")
    notes(s, "Trước khi vào dây, ai cũng thấy chỉ số bảo chứng. Rủi ro lớn nhất là số tiền những người đã hốt còn phải "
             "góp, cao nhất ở giữa dây; với dây mẫu 5 người góp 100 USDC là 600 USDC. Tiền giữ lại của người đã hốt "
             "che 20%, ký quỹ 480 USDC che 80%, cộng lại là 100%. Trên Fuji, smart contract không cho bắt đầu dây nếu "
             "chỉ số dưới 100%. Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt "
             "cùng bỏ đóng một lúc. Chỉ số này không bao quát mọi trường hợp; trường hợp người đã hốt bỏ đóng lần "
             "lượt nằm ở slide 17.")


def s09_ux(prs):
    s = new_slide(prs)
    header(s, 9, "TRẢI NGHIỆM", "Người mới vào dây bằng tài khoản Google, không phải cài ví hay mua AVAX",
           chip="UI/UX & Demo")
    items = [
        "Đăng nhập Google hoặc email, ví Privy được tạo sẵn.",
        "Relayer trả phí mạng: thành viên chỉ ký, ví không cần AVAX.",
        "Ví phải đủ tiền góp một kỳ mới được vào dây.",
        "Thẻ “Kỳ này của bạn” ghi kỳ này phải góp bao nhiêu, báo trước khi quyền trích không đủ.",
        "Chủ hụi có bàn khui kỳ: thấy trước ai hốt, nhận bao nhiêu, ai chưa đủ tiền.",
        "Sổ hụi in được; dây tất toán xong có cột Ròng cho biết mỗi người được hay mất bao nhiêu.",
    ]
    text(s, ML, 2.2, 6.0, 4.1, items, size=16, ls=1.2, after=11, bullet=True)
    ph = 3.86
    pw = ph * 780 / 1688
    gap = 0.22
    x0 = W - MR - (3 * pw + 2 * gap)
    for i, (img, label) in enumerate([("m-home.png", "Việc cần làm"), ("m-room.png", "Phòng bỏ thăm"),
                                      ("m-book.png", "Sổ hụi")]):
        x = x0 + i * (pw + gap)
        picture(s, ASSETS / "screens" / img, x, 2.18, w=pw, h=ph, radius=0.18, border=INK, bw=2.25,
                alt=f"Ảnh chụp app trên điện thoại: {label.lower()}, dữ liệu mẫu")
        text(s, x, 6.1, pw, 0.24, label, size=10.5, font=MONO, color=INK2, align="c")
    footer(s, 9, source="Ảnh chụp app, dữ liệu mẫu. Bàn khui kỳ và thẻ “Kỳ này của bạn” chỉ hiện khi đăng nhập vào "
                        "dây thật, nên slide này chỉ mô tả bằng chữ.")
    notes(s, "Về trải nghiệm: người mới đăng nhập bằng Google hoặc email và có ví ngay, không phải ghi seed phrase. "
             "Relayer trả phí mạng nên thành viên chỉ ký, ví không cần AVAX. App kiểm số dư trước: ví phải đủ "
             "tiền góp một kỳ mới được vào dây. Mỗi kỳ, thẻ “Kỳ này của bạn” ghi kỳ này phải góp bao nhiêu và báo "
             "trước nếu quyền trích không đủ. Chủ hụi có bàn khui kỳ, thấy trước ai hốt, người đó nhận bao nhiêu và "
             "ai chưa đủ tiền. Sổ hụi in được; khi dây tất toán xong có cột Ròng cho biết mỗi người được hay mất bao "
             "nhiêu. Ở lần chạy ngày 20/11, mọi lần ký đều diễn ra ngay trong app, không bật hộp ký riêng của ví.")


def _node(s, x, y, w, h, title, sub, *, hi=False, dashed=False):
    rect(s, x, y, w, h, fill=(LIME if hi else PAPER), line=(None if hi else INK2 if dashed else LINE), lw=1,
         radius=0.08, dash=(MSO_LINE_DASH_STYLE.DASH if dashed else None))
    text(s, x + 0.14, y + 0.12, w - 0.28, 0.32, title, size=15, bold=True, ls=1.1)
    text(s, x + 0.14, y + 0.48, w - 0.28, h - 0.55, sub, size=13, color=(INK if hi else INK2), ls=1.15)


def s10_arch(prs):
    s = new_slide(prs)
    header(s, 10, "KIẾN TRÚC", "Mỗi dây là một smart contract riêng; web, relayer và keeper chỉ chuyển lệnh, không giữ "
           "tiền", chip="Technical Implementation")
    nw, gap, nh = 2.2, (CW - 5 * 2.2) / 4, 1.18
    col = [ML + i * (nw + gap) for i in range(5)]
    y1, y2 = 2.5, 4.62
    text(s, ML, 2.18, 6, 0.26, "NGOÀI CHUỖI", size=10.5, font=MONO, color=INK2, spc=80)
    _node(s, col[0], y1, nw, nh, "Thành viên, chủ hụi", "điện thoại hoặc máy tính")
    _node(s, col[1], y1, nw, nh, "Web Next.js + Privy", "đăng nhập Google, ký yêu cầu EIP-712")
    _node(s, col[2], y1, nw, nh, "Relayer", "kiểm từng yêu cầu, trả phí AVAX")
    _node(s, col[3], y1, nw, nh, "Keeper", "khui thay, ghi vỡ nợ, tất toán")
    _node(s, col[4], y1, nw, nh, "Trợ lý AI", "chỉ đọc, tính bằng hàm tất định, không ký", dashed=True)
    rect(s, ML - 0.12, 4.2, CW + 0.24, 1.76, line=INK2, lw=1, radius=0.12, dash=MSO_LINE_DASH_STYLE.ROUND_DOT)
    text(s, ML, 4.28, 6, 0.26, "AVALANCHE C-CHAIN (FUJI)", size=10.5, font=MONO, color=INK2, spc=80)
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
    footer(s, 10, source="Chi tiết: docs/04 mục 2 và 3. Không dùng ERC-4337 hay EIP-7702; không dùng Multicall cùng "
                         "ERC2771Context (ADR-03, ADR-06). Attester của HụiSafe ký xác nhận mỗi người một tài khoản, "
                         "đủ 18 tuổi, lúc vào dây.")
    notes(s, "Về kiến trúc: mỗi dây là một smart contract riêng, tạo từ HuiFactory bằng clone EIP-1167 nên rẻ khi tạo. "
             "Người dùng ký yêu cầu trên web; relayer gửi yêu cầu lên ERC2771Forwarder và trả phí AVAX. Relayer chỉ "
             "chuyển yêu cầu đã có chữ ký, không sửa được nội dung và không giữ tiền. Keeper là tiện ích: khui thay "
             "khi chủ hụi vắng, ghi vỡ nợ khi quá ân hạn, tất toán cuối dây; ai cũng gọi được các hàm này. Admin là "
             "ví Safe 2 trên 3, chỉ tạm dừng được dây và không có hàm nào rút tiền người dùng. Trợ lý AI chỉ đọc và "
             "tính bằng hàm tất định, không ký giao dịch.")


def s11_avalanche(prs):
    s = new_slide(prs)
    header(s, 11, "TÍCH HỢP AVALANCHE", "Tiền, luật và sổ của mỗi dây đều nằm trên Avalanche",
           chip="Avalanche Integration")
    boxes = [
        ("Uses Avalanche meaningfully",
         "Tiền góp đi từ ví thành viên tới người hốt trong một giao dịch trên C‑Chain. Trần lãi và lãi chậm góp "
         "theo NĐ 19 chạy trong smart contract."),
        ("Smart contract / on-chain implementation",
         "5 contract đã deploy và verify trên Fuji: HuiFactory, HuiCircle (clone EIP-1167), HuiCircleLens, "
         "ReputationRegistry, ERC2771Forwarder."),
        ("Appropriate use of Avalanche infrastructure",
         "USDC native của Circle có permit EIP-2612. Relayer ERC-2771 trả phí AVAX thay người dùng. Mọi giao dịch "
         "kiểm được trên Snowtrace."),
        ("Technical quality of integration",
         "634 test Foundry, 17 hàm invariant chạy fuzz. Domain permit đọc từ USDC lúc chạy. Ví bị chặn chuyển tiền "
         "thì ghi claimable, kỳ hụi vẫn chạy."),
        ("Clear value from building on Avalanche",
         "Phí thấp nên relayer trả thay được: một kỳ dây 5 người tốn khoảng 520.000 gas. C‑Chain chốt giao dịch "
         "dưới 1 giây (theo Avalanche)."),
    ]
    rh, y0 = 0.82, 2.15
    rule(s, ML, y0, W - MR, y0, color=INK, lw=1)
    for i, (crit, ev) in enumerate(boxes):
        y = y0 + i * rh
        numbered_dot(s, ML, y + (rh - 0.34) / 2, str(i + 1), d=0.34, size=11)
        text(s, ML + 0.52, y, 3.1, rh, crit, size=11, font=MONO, color=INK2, anchor="m", ls=1.15)
        text(s, 4.45, y, W - MR - 4.45, rh, ev, size=16, anchor="m", ls=1.2)
        rule(s, ML, y + rh, W - MR, y + rh, color=LINE, lw=0.75)
    footer(s, 11, source="Nguồn: contracts/deployments/fuji.json; docs/04 mục 7.1 (gas settleRound N = 5, không ai "
                         "thiếu, đo bằng test); docs/06 (trang Performance của Avalanche).")
    notes(s, "Năm ý chấm điểm Avalanche, mỗi ô một bằng chứng. Thứ nhất, tiền và luật của dây chạy trên C-Chain. Thứ "
             "hai, 5 contract đã deploy và verify trên Fuji. Thứ ba, chúng em dùng USDC native của Circle có permit, "
             "relayer ERC-2771 và Snowtrace. Thứ tư, chất lượng tích hợp: 634 test, 17 hàm invariant chạy fuzz, "
             "domain permit đọc lúc chạy, ví bị chặn chuyển tiền không làm hỏng cả kỳ. Thứ năm, phí đủ thấp để "
             "relayer trả thay: một kỳ dây 5 người tốn khoảng 520 nghìn gas, đo bằng test.")


def s12_fuji(prs):
    s = new_slide(prs, DEEP)
    header(s, 12, "ĐÃ CHẠY THẬT TRÊN FUJI", "Ba dây đã chạy trọn trên Fuji testnet, lần nào số dư của smart contract "
           "cũng về 0", chip="Avalanche Integration", dark=True)
    stats = [("3", "dây chạy trọn, có tất toán"), ("13", "kỳ đã chi (3 + 5 + 5)"), ("0", "USDC còn lại trong mỗi dây")]
    for i, (n, label) in enumerate(stats):
        x = ML + i * 4.1
        nw = 0.47 * len(n) + 0.1
        text(s, x, 2.08, nw, 0.85, n, size=54, font=MONO, bold=True, color=LIME, anchor="m", ls=1.0)
        text(s, x + nw + 0.15, 2.08, 3.7 - nw - 0.15, 0.85, label, size=15, color=IVORY, anchor="m", ls=1.15)
    cards = [
        ("11/11 · DÂY CỐ ĐỊNH, 3 NGƯỜI", "Thành viên vào dây qua relayer, ví không có AVAX. Keeper khui 3 kỳ rồi "
         "tất toán.", CIRCLE_FIXED),
        ("11/11 · DÂY VỠ NỢ, 5 NGƯỜI", "M4 bỏ đóng sau khi hốt: bù 8 + 2 USDC, ghi vỡ nợ, ký quỹ 48 còn 16. Chạy "
         "bằng script và ví demo, 104 kiểm tra đạt.", CIRCLE_DEFAULT),
        ("20/11 · DÂY TẠO TRÊN WEB", "Chủ hụi đăng nhập Google; 5 người vào dây (1 điện thoại thật, 4 ví demo); chủ "
         "hụi tự khui đủ 5 kỳ. Người hốt nhận từ 31,20 đến 39,20 USDC.", CIRCLE_WEB),
    ]
    cw, gap, cy, chh = 3.85, (CW - 3 * 3.85) / 2, 3.12, 3.05
    for i, (label, body, addr) in enumerate(cards):
        cx = ML + i * (cw + gap)
        rect(s, cx, cy, cw, chh, fill=INK, line=LINE_D, lw=1, radius=0.12)
        text(s, cx + 0.25, cy + 0.2, cw - 0.5, 0.26, label, size=10.5, font=MONO, color=LIME, spc=60)
        text(s, cx + 0.25, cy + 0.55, cw - 0.5, 1.3, body, size=15, color=IVORY, ls=1.25)
        qr(s, SNOW + addr, cx + 0.25, cy + chh - 1.17, 0.95)
        short = f"{addr[:6]}…{addr[-4:]}"
        text(s, cx + 1.38, cy + chh - 0.95, cw - 1.6, 0.6, [short, {"text": "quét để mở Snowtrace", "color": MUTE,
                                                                     "size": 10}],
             size=12, font=MONO, color=IVORY, ls=1.3)
    text(s, ML, 6.3, CW, 0.3, [[
        {"text": "HuiFactory "}, {"text": "0x5004…5b21", "color": LIME},
        {"text": " · admin là ví Safe 2/3 · 5/5 contract đã verify"},
    ]], size=11, font=MONO, color=IVORY)
    footer(s, 12, dark=True)
    text(s, ML, 6.62, CW, 0.3, "Nguồn: docs/DEPLOY-FUJI.md mục 15, 15b. Dây 20/11: đọc lại trên Fuji ngày 21/11/2026 "
         "(Completed, roundInfo 5 kỳ, số dư 0).", size=10, font=MONO, color=MUTE)
    notes(s, "Ba dây đã chạy trọn trên Fuji. Dây cố định 3 người ngày 11/11: thành viên vào dây qua relayer với ví "
             "không có AVAX, keeper khui 3 kỳ rồi tất toán. Dây vỡ nợ ngày 11/11 là ví dụ ở slide 7. Dây thứ ba ngày "
             "20/11 được tạo ngay trên web bằng tài khoản Google; 5 người vào dây, một người dùng điện thoại thật, "
             "bốn người là ví demo; chủ hụi tự khui đủ 5 kỳ, người hốt nhận từ 31,20 đến 39,20 USDC. Cả ba dây kết "
             "thúc với số dư smart contract bằng 0. Quét mã để xem từng dây trên Snowtrace.")


def s13_tests(prs):
    s = new_slide(prs)
    header(s, 13, "KIỂM THỬ VÀ MÔ PHỎNG", "Cùng giả định bỏ đóng, 0,01% dây HụiSafe có người nhận thiếu, so với "
           "23,33% ở hụi truyền thống", chip="Technical Implementation")
    stats = [
        ("634", "test Foundry đều đạt, gồm 17 hàm invariant chạy fuzz"),
        ("98,7%", "coverage của contract (đo 11/11)"),
        ("0", "lỗi Slither mức High; rà soát nội bộ 0 Critical/High; chưa có audit độc lập"),
        ("556", "kiểm thử giao diện Playwright"),
        ("107/107", "kiểm tra khi chạy trọn một dây trên anvil"),
    ]
    for i, (n, label) in enumerate(stats):
        y = 2.2 + i * 0.74
        text(s, ML, y, 1.75, 0.66, n, size=26, font=MONO, bold=True, anchor="m", ls=1.0)
        text(s, ML + 1.8, y, 3.05, 0.66, label, size=14, color=INK2, anchor="m", ls=1.15)
    text(s, ML, 5.98, 4.9, 0.3, "Unit test: web 503 · sdk 139 · keeper 25 · config 15", size=11, font=MONO,
         color=INK2)
    rows = [
        ["", "TRUYỀN THỐNG", "ON-CHAIN ĐƠN GIẢN", "HỤISAFE"],
        ["Dây có người nhận thiếu hoặc chủ hụi bỏ trốn", "23,33%", "62,46%", "0,01%"],
        ["Người hốt sau mất, trung bình", "4,99%", "6,37%", "0,0003%"],
        ["Người hốt sau mất, mức xấu (phân vị 95)", "24,04%", "23,90%", "0,00%"],
    ]
    table(s, 5.75, 2.2, [3.28, 1.25, 1.3, 1.15], rows, size=14, row_h=0.64, head_h=0.48, num_cols=(1, 2, 3),
          hi_col=3)
    rect(s, 5.75, 4.92, 6.98, 1.38, fill=PAPER, line=LINE, lw=1, radius=0.08)
    text(s, 5.95, 5.0, 6.6, 1.24, [
        {"text": "Kết quả của giả định, không phải dự báo.", "bold": True, "color": INK, "size": 15},
        "10.000 dây mỗi thiết kế, N = 10, C = 100 USDC, seed 42. Người đã hốt bỏ đóng 2,04% (hốt sớm) và 0,59% (hốt "
        "muộn) mỗi kỳ, lấy từ Klonner & Rai (2008) theo cách đọc bi quan; sốc chung 2% × 5.",
    ], size=13, color=INK2, ls=1.22, after=3)
    footer(s, 13, source="Nguồn: sim/outputs/baseline.json và .meta.json (08/11/2026, commit 9699239), làm tròn 2 chữ "
                         "số; số test đo ngày 20-21/11/2026; coverage, Slither, rà soát: docs/TIEN-DO.md (11/11).")
    notes(s, "Về kiểm thử: 634 test Foundry đều đạt, trong đó 17 hàm invariant về tiền chạy với fuzz; coverage contract "
             "98,7%; Slither không còn lỗi mức High; rà soát bảo mật nội bộ không còn lỗi Critical hay High, nhưng "
             "chúng em chưa có audit độc lập. Về mô phỏng: 10.000 dây cho mỗi thiết kế, cùng giả định bỏ đóng lấy từ "
             "Klonner và Rai theo cách đọc bi quan. Hụi truyền thống có 23,33% dây có người nhận thiếu hoặc chủ hụi "
             "bỏ trốn, on-chain đơn giản 62,46%, HụiSafe 0,01%. Đây là kết quả của giả định, không phải dự báo.")


def s14_commission(prs):
    s = new_slide(prs)
    header(s, 14, "TIỀN CÔNG CHỦ HỤI (v1.2)", "Hoa hồng của chủ hụi nằm trong trần lãi, nên người hốt không phải "
           "trả quá trần", chip="Creativity & Innovation")
    lx, lw = ML, 7.15
    text(s, lx, 2.08, lw, 0.3, "Kỳ 2, dây có hoa hồng trong trần (φ = 50%): quỹ lãi luật cho phép 14,794518 USDC",
         size=14, color=INK2)
    total = 14.794518
    segs = [(7.2, INK, IVORY, "Thăm 2,4 × 3 người = 7,2"), (7.397259, LIME, INK, "Hoa hồng 7,397259")]
    x = lx
    for val, fill, fg, label in segs:
        wv = lw * val / total
        rect(s, x, 2.48, wv, 0.66, fill=fill)
        text(s, x + 0.15, 2.48, wv - 0.2, 0.66, label, size=15, bold=True, color=fg, anchor="m")
        x += wv
    rect(s, x, 2.48, lx + lw - x, 0.66, fill=PAPER, line=INK2, lw=0.75)
    text(s, lx, 3.2, lw, 0.32, "7,2 + 7,397259 = 14,597259 < 14,794518 (còn trống 0,197259)", size=13, font=MONO,
         color=INK)
    facts = [
        "Chủ hụi nhận tối đa phần φ của quỹ lãi (φ không quá 50%) và không quá 3% mỗi lần hốt; phần còn lại dành cho "
        "thăm.",
        "Chân của chủ hụi hốt thì kỳ đó không có hoa hồng.",
        "Kỳ không ai thiếu: hoa hồng trả ngay. Kỳ có người thiếu: giữ lại; người đó vỡ nợ thì khoản này vào quỹ dự "
        "phòng.",
    ]
    text(s, lx, 3.8, lw, 2.5, facts, size=16, ls=1.2, after=10, bullet=True)

    rx, rw = 8.25, W - MR - 8.25
    text(s, rx, 2.08, rw, 0.62, "Quỹ dự phòng cuối dây chia theo số kỳ đóng đúng hạn, USDC", size=15, bold=True,
         ls=1.15)
    shares = [("M1", "4,146821", 4.146821), ("M2", "4,146820", 4.14682), ("M3", "4,146820", 4.14682),
              ("M4 trễ 1 kỳ", "3,110115", 3.110115), ("M5", "4,146820", 4.14682)]
    for i, (who, label, v) in enumerate(shares):
        y = 2.88 + i * 0.5
        text(s, rx, y, 1.25, 0.38, who, size=12, font=MONO, color=(INK if "trễ" in who else INK2),
             bold=("trễ" in who), anchor="m")
        bwv = 1.75 * v / 4.146821
        rect(s, rx + 1.3, y + 0.06, bwv, 0.26, fill=(INK2 if "trễ" in who else INK))
        text(s, rx + 1.3 + bwv + 0.1, y, 1.3, 0.38, label, size=12, font=MONO, anchor="m")
    text(s, rx, 5.42, rw, 0.9, "So với chia đều, M4 mất 0,829364 USDC vì trễ một kỳ, gấp khoảng 30 lần lãi chậm góp. "
         "Người vỡ nợ nhận 0.", size=15, color=INK2, ls=1.22)
    footer(s, 14, source="Dây mẫu 5 người × 100 USDC. Hoa hồng: docs/03 mục 2.7, 8.1 (50% quỹ lãi, trần 3% mỗi lần "
                         "hốt). Quỹ dự phòng: docs/03 mục 8.2, nhánh A. Trần lãi NĐ 19 Điều 21: cách hiểu đề xuất, "
                         "cần luật sư xác nhận.")
    notes(s, "Bản 1.2 trả công chủ hụi theo cách không ăn vào trần lãi. Mỗi kỳ có một quỹ lãi tối đa luật cho phép; "
             "chủ hụi nhận tối đa một nửa quỹ đó và không quá 3% mỗi lần hốt, phần còn lại dành cho thăm. Ví dụ kỳ 2: "
             "thăm 2,4 nhân 3 người là 7,2, hoa hồng 7,397259, tổng 14,597259, không vượt quỹ lãi 14,794518 USDC. "
             "Chân của chủ hụi hốt thì kỳ đó không thu hoa hồng. Kỳ có người thiếu thì hoa hồng bị giữ lại; người đó "
             "vỡ nợ thì hoa hồng chuyển vào quỹ dự phòng. Cuối dây, quỹ dự phòng chia theo số kỳ đóng đúng hạn: M4 "
             "trễ một kỳ nên nhận 3,110115 thay vì 4,146820 như người đóng đúng hạn.")


def s15_questions(prs):
    s = new_slide(prs)
    header(s, 15, "BA CÂU HỎI BẮT BUỘC", "On-chain để không ai phải giữ tiền, Avalanche để phí đủ rẻ, và tiền chỉ đến "
           "từ thành viên", chip="Luật BTC: 3 câu hỏi")
    cols = [
        ("Vì sao on-chain?", [
            "Chơi hụi là phải tin người giữ tiền. Làm app với database chỉ chuyển việc giữ tiền từ chủ hụi sang công "
            "ty làm app.",
            "Trên chuỗi, tiền nằm trong ví từng người tới lúc chi, ký quỹ khóa bằng code, luật dây không đổi sau khi "
            "bắt đầu, sổ hụi ai cũng kiểm được.",
        ]),
        ("Vì sao Avalanche?", [
            "USDC native trên C-Chain có permit, nên vào dây chỉ ký một lần. Phí đủ thấp để relayer trả thay, thành "
            "viên không cần AVAX.",
            {"text": "Đề #01: “Low transaction fees mean a group of 10-20 people paying weekly does not lose the pot "
                     "to fees. Native USDC on the C-Chain.”", "font": MONO, "size": 11.5, "color": INK2},
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
        rect(s, x, 2.18, cw, 4.18, fill=PAPER, line=LINE, lw=1, radius=0.1)
        numbered_dot(s, x + 0.25, 2.38, str(i + 1))
        text(s, x + 0.75, 2.36, cw - 0.95, 0.42, q, size=19, bold=True, anchor="m")
        text(s, x + 0.25, 2.92, cw - 0.5, 3.36, paras, size=15.5, ls=1.2, after=7)
    footer(s, 15, source="Nguồn: team1vn.xyz/topics.json (đề #01); docs/03 mục 2.6, 2.7; docs/10 mục 5 (Aave v3 là "
                         "lộ trình, ADR-10).")
    notes(s, "Ba câu ban tổ chức hỏi. Vì sao on-chain: bài toán của hụi là phải tin người giữ tiền; làm app với database "
             "chỉ đổi người giữ tiền từ chủ hụi sang công ty làm app. Ở đây không ai giữ tiền giữa các kỳ, ký quỹ khóa "
             "bằng code, luật dây không đổi sau khi bắt đầu. Vì sao Avalanche: USDC native có permit nên vào dây chỉ "
             "ký một lần, phí đủ thấp để relayer trả thay. Chính đề số 1 viết: phí thấp nghĩa là một nhóm 10 đến 20 "
             "người góp hằng tuần không mất hũ vào phí. Tiền từ đâu: từ chính thành viên. Không có token, không sinh "
             "lãi; nếu sau này có lãi trên phần tiền chưa chi, lãi thật đến từ cho vay trên Aave v3, không đến từ in "
             "token.")


def s16_law(prs):
    s = new_slide(prs)
    header(s, 16, "PHÁP LUẬT VIỆT NAM", "Hụi hợp pháp, còn tiền mã hóa không phải phương tiện thanh toán, nên bản thi "
           "chỉ dùng USDC testnet", chip="Luật BTC: 4 điểm pháp lý")
    rows = [
        ["BỐN ĐIỂM BAN TỔ CHỨC YÊU CẦU", "HỤISAFE"],
        ["Tiền mã hóa không phải phương tiện thanh toán hợp pháp",
         "Chỉ dùng USDC testnet, không nhận tiền thật. NQ 05/2025/NQ-CP: thanh toán tài sản mã hóa phải bằng Đồng "
         "Việt Nam. Hướng thật: chế độ VND."],
        ["Lương phải trả bằng VND", "Không áp dụng: HụiSafe không trả lương. Hụi là giao dịch dân sự giữa các thành "
         "viên."],
        ["Tư vấn pháp lý, tài chính có thu phí cần giấy phép",
         "Trợ lý miễn phí, chỉ tính và trích dẫn, luôn ghi “Đây là thông tin tham khảo, không phải tư vấn tài chính "
         "hay pháp lý”."],
        ["Cổ phiếu token hóa bị đơn vị phát hành chặn theo khu vực",
         "Không áp dụng: không có cổ phiếu token hóa, không phát hành và không bán token."],
    ]
    table(s, ML, 2.12, [3.75, 8.38], rows, size=14, row_h=0.5, head_h=0.34, bold_cols=(0,))
    text(s, ML, 5.16, 5.55, 1.2, [
        {"text": "NĐ 19/2019 chạy trong code", "bold": True, "color": INK},
        "Điều 5, 6 (đủ 18 tuổi), Điều 12, 13 (sổ hụi, biên nhận), Điều 14 (nhắc thông báo UBND cấp xã), Điều 18 "
        "khoản 4 (ký quỹ), Điều 21 (trần thăm), Điều 22 khoản 1 (lãi chậm góp 10%/năm).",
    ], size=14, color=INK2, ls=1.2, after=3)
    rx = 6.4
    rect(s, rx, 5.1, W - MR - rx, 1.26, fill=PAPER, line=RED_INK, lw=1.25, radius=0.08)
    text(s, rx + 0.22, 5.16, W - MR - rx - 0.44, 1.14, [
        {"text": "Cần luật sư xác nhận", "bold": True, "color": RED_INK},
        "Công thức trần thăm theo Điều 21 là cách hiểu đề xuất của nhóm. Điều 20 quy định bằng thăm thì bốc thăm, "
        "còn luật cuộc thi cấm yếu tố ngẫu nhiên, nên HụiSafe chia hòa theo luật cố định ghi trong thỏa thuận dây.",
    ], size=13.5, color=INK, ls=1.18, after=3)
    footer(s, 16, source="Nguồn: docs/10 mục 1, 3, 5 (BLDS 2015 Điều 471; NĐ 19/2019/NĐ-CP; NQ 05/2025/NQ-CP Điều 4 "
                         "khoản 7; BLLĐ 2019 Điều 95 khoản 2; Luật Luật sư). Chưa có luật sư nào xác nhận.")
    notes(s, "Về pháp luật Việt Nam, bốn điểm ban tổ chức yêu cầu. Tiền mã hóa không phải phương tiện thanh toán hợp "
             "pháp; Nghị quyết 05/2025 yêu cầu giao dịch, thanh toán tài sản mã hóa bằng Đồng Việt Nam, nên bản thi "
             "chỉ dùng USDC testnet và không nhận tiền thật. HụiSafe không trả lương. Trợ lý miễn phí, chỉ tính và "
             "trích dẫn, luôn ghi rõ không phải tư vấn. Không có cổ phiếu token hóa, không có token. Hụi là giao dịch "
             "hợp pháp theo Bộ luật Dân sự Điều 471 và Nghị định 19, và các điều của Nghị định 19 chạy trong code. "
             "Hai chỗ cần luật sư xác nhận: công thức trần thăm theo Điều 21, và cách chia hòa tất định thay cho bốc "
             "thăm theo Điều 20.")


def s17_limits(prs):
    s = new_slide(prs)
    header(s, 17, "GIỚI HẠN", "Hai giới hạn chúng em nói trước: chủ hụi dùng nhiều ví ảo, và người đã hốt bỏ đóng lần "
           "lượt")
    lx, lw = ML, 6.35
    text(s, lx, 2.08, lw, 0.34, "1 · Ví ảo của chủ hụi", size=18, bold=True)
    rect(s, lx, 2.5, lw, 1.28, fill=PAPER, line=LINE, lw=1, radius=0.08)
    text(s, lx + 0.2, 2.5, lw - 0.4, 1.28, "“Cọc 100% chặn được chủ hụi dùng một ví ảo: làm vậy chủ hụi tự lỗ. Dùng "
         "nhiều ví ảo thì bị chặn bằng xác thực mỗi người một tài khoản (OTP, attestation), và mọi người thấy trước "
         "rủi ro tối đa của mình.”", size=13.5, anchor="m", ls=1.2)
    rows = [
        ["DÂY MẪU, USDC", "CHỦ HỤI", "KHÔNG BÙ ĐƯỢC", "HỐT KỲ 5"],
        ["1 ví ảo, cọc 100%", "−18,038354", "0", "392"],
        ["2 ví ảo, cọc 100%", "+41,472772", "56,558906", "336,572274"],
        ["1 ví ảo, cọc 50% (luật cũ)", "+120,756588", "120,505645", "297,682223"],
    ]
    table(s, lx, 3.95, [2.35, 1.35, 1.35, 1.3], rows, size=12.5, head_size=10, row_h=0.46, head_h=0.38,
          num_cols=(1, 2, 3), pad=0.06)

    rx, rw = 7.3, W - MR - 7.3
    text(s, rx, 2.08, rw, 0.34, "2 · Người đã hốt bỏ đóng lần lượt", size=18, bold=True)
    text(s, rx, 2.5, 2.4, 0.8, "1.000", size=44, font=MONO, bold=True, anchor="m", ls=1.0)
    text(s, rx, 3.28, 2.4, 0.5, "USDC thiếu tổng cộng khi 4 người lần lượt hốt rồi bỏ", size=12, color=INK2, ls=1.15)
    text(s, rx + 2.75, 2.5, 2.3, 0.8, "600", size=44, font=MONO, bold=True, color=INK2, anchor="m", ls=1.0)
    text(s, rx + 2.75, 3.28, 2.3, 0.5, "USDC rủi ro lớn nhất, mức ký quỹ đang che", size=12, color=INK2, ls=1.15)
    text(s, rx, 4.0, rw, 1.65, [
        "Kỳ 5 còn 304 USDC không bù được; người hốt cuối nhận 94,08 thay vì 392 USDC.",
        "Muốn bù đủ trường hợp này cần ký quỹ 800 USDC: tùy chọn, nằm trong lộ trình.",
    ], size=15, ls=1.22, after=6)
    rect(s, ML, 5.93, CW, 0.46, line=INK, lw=1, radius=0.06)
    text(s, ML + 0.22, 5.93, CW - 0.44, 0.46, [[
        {"text": "Chưa có: ", "bold": True},
        "audit độc lập, mainnet, chế độ VND, lãi trên phần tiền chưa chi, buổi thử với người dùng ngoài đội.",
    ]], size=15, anchor="m")
    footer(s, 17, source="Nguồn: docs/03 mục 7.3 (dây mẫu 5 người × 100 USDC, giữ lại 20%, ký quỹ 480); "
                         "sim/outputs/organizer_sybil.json (10/11/2026). Số tính tất định trên dây mẫu, không phải dự "
                         "báo.")
    notes(s, "Chúng em nói trước hai giới hạn. Một: cọc 100% chặn được chủ hụi dùng một ví ảo, vì làm vậy chủ hụi tự lỗ, "
             "khoảng 18 USDC ở dây mẫu. Với hai ví ảo thì chủ hụi lời, nên lớp chặn tiếp theo là xác thực mỗi người "
             "một tài khoản và cho mọi người thấy trước rủi ro tối đa của mình. Hai: chỉ số 100% là cho cú sốc đồng "
             "thời. Nếu bốn người lần lượt hốt rồi bỏ đóng, tổng khoản thiếu là 1.000 USDC, hơn rủi ro lớn nhất 600; "
             "kỳ 5 còn 304 USDC không bù được và người hốt cuối chỉ nhận 94,08. Bù đủ trường hợp này cần ký quỹ 800, "
             "là tùy chọn trong lộ trình. Ngoài ra chúng em chưa có audit độc lập, chưa có mainnet, chưa có chế độ VND "
             "và chưa thử với người dùng ngoài đội.")


def s18_roadmap(prs):
    s = new_slide(prs)
    header(s, 18, "LỘ TRÌNH", "Việc tiếp theo là xin ý kiến luật sư và thử với nhóm hụi thật bằng chế độ VND")
    steps = [
        ("12/2026", "Thử trên testnet với 3 đến 5 nhóm hụi, sửa theo phản hồi."),
        ("TIẾP THEO", "Xin ý kiến luật sư về NĐ 19 Điều 14, 20 và 21."),
        ("SAU ĐÓ", "Chế độ VND: tiền đi qua ngân hàng, chuỗi giữ luật và sổ hụi."),
        ("TRƯỚC MAINNET", "Audit độc lập, rồi mainnet với Safe multisig; L1 riêng cho từng hội."),
    ]
    ly = 3.05
    rule(s, ML, ly, W - MR, ly, color=INK, lw=1.25)
    sw = CW / 4
    for i, (when, what) in enumerate(steps):
        x = ML + i * sw
        oval(s, x, ly - 0.11, 0.22, fill=(LIME if i == 0 else INK), line=INK, lw=1)
        text(s, x, 2.35, sw - 0.3, 0.3, when, size=11, font=MONO, color=INK2, spc=80)
        text(s, x, 3.3, sw - 0.35, 1.3, what, size=16, ls=1.25)
    rect(s, ML, 4.95, CW, 1.25, fill=LIME, radius=0.1)
    text(s, ML + 0.3, 4.95, CW - 0.6, 1.25, [
        {"text": "Chúng em cần", "bold": True, "size": 13, "font": MONO},
        "Một mentor pháp lý; giới thiệu 3 nhóm hụi hoặc câu lạc bộ để thử; hướng dẫn nộp Team1 Mini Grant.",
    ], size=18, anchor="m", ls=1.25, after=4)
    footer(s, 18, source="Nguồn: docs/12 mục 2 và 8. Mọi mốc ở đây là kế hoạch, chưa làm.")
    notes(s, "Việc tiếp theo, theo thứ tự: tháng 12 thử trên testnet với 3 đến 5 nhóm hụi; xin ý kiến luật sư về Điều "
             "14, 20 và 21; làm chế độ VND để tiền đi qua ngân hàng, chuỗi chỉ giữ luật và sổ hụi; rồi audit độc lập "
             "trước khi tính tới mainnet. Chúng em cần ba việc: một mentor pháp lý, giới thiệu 3 nhóm hụi hoặc câu lạc "
             "bộ để thử, và hướng dẫn nộp Team1 Mini Grant.")


def s19_team(prs):
    s = new_slide(prs, DEEP)
    header(s, 19, "ĐỘI HỤISAFE", "Cảm ơn ban giám khảo. Quét mã để thử app trên Fuji", dark=True)
    team = [
        ("Ngô Bình Minh", "Trưởng nhóm. Thiết kế sản phẩm và giao thức, tham số v1.2, pitch."),
        ("Ngô Lâm Tiến", "Frontend và tích hợp: web app, trải nghiệm, ví Privy và relayer, triển khai web."),
        ("Ngô Đặng Trọng Hiếu", "Backend và kiểm thử: keeper, SDK, rà soát và viết test."),
    ]
    for i, (name, role) in enumerate(team):
        y = 2.08 + i * 1.18
        text(s, ML, y, 6.3, 0.42, name, size=22, bold=True, color=IVORY)
        text(s, ML, y + 0.44, 6.3, 0.6, role, size=15, color=MUTE, ls=1.2)
    rect(s, ML, 5.55, 4.2, 0.62, line=LIME, lw=1.25, radius=0.06, dash=MSO_LINE_DASH_STYLE.DASH)
    text(s, ML + 0.2, 5.55, 3.8, 0.62, "[Link video demo]", size=14, font=MONO, color=LIME, anchor="m")
    codes = [("App trên Fuji", APP_URL, ["lamng.tail3abf4e", ".ts.net:8443"]),
             ("Mã nguồn", REPO_URL, ["github.com/bminhnemhoi", "/T1VN_Unihack"]),
             ("HuiFactory", SNOW + FACTORY, ["testnet.snowtrace.io", "0x5004…5b21"])]
    qs, qx0 = 1.45, 7.35
    qgap = (W - MR - qx0 - 3 * qs) / 2
    for i, (label, url, cap) in enumerate(codes):
        x = qx0 + i * (qs + qgap)
        qr(s, url, x, 2.3, qs)
        text(s, x - 0.1, 3.85, qs + 0.2, 0.3, label, size=13, bold=True, color=IVORY, align="c")
        text(s, x - 0.18, 4.15, qs + 0.36, 0.55, cap, size=9.5, font=MONO, color=MUTE, align="c", ls=1.15)
    footer(s, 19, dark=True)
    notes(s, "Đội HụiSafe có ba người. Ngô Bình Minh là trưởng nhóm, thiết kế sản phẩm và giao thức, tham số bản 1.2 "
             "và pitch. Ngô Lâm Tiến làm frontend và tích hợp: web app, trải nghiệm, ví Privy, relayer và triển khai "
             "web. Ngô Đặng Trọng Hiếu làm backend và kiểm thử: keeper, SDK, rà soát và viết test. App đang chạy trên "
             "Fuji và mã nguồn công khai; quét mã để thử. Cảm ơn ban giám khảo.")


SOURCES = [
    ("2 phút; 75 giây; 45 giây; 1 phút; 30 ngày; 48 giờ", "2", "docs/03 mục 3.3"),
    ("Keeper khui thay sau 5 phút (demo), 24 giờ (thật)", "2", "docs/05 mục 9 (organizerSettleWaitSec)"),
    ("Hơn 100 tỷ đồng; 167 người", "3", "Báo Pháp luật, 20/09/2024 (mở lại 21/11/2026)"),
    ("157 phần hụi; hơn 4 tỷ đồng; 12 năm tù", "3", "VOV, 13/03/2025 (mở lại 21/11/2026)"),
    ("Gần 500 triệu đồng", "3", "VietnamPlus, 06/10/2026 (mở lại 21/11/2026)"),
    ("2,04%; 0,59%", "3, 13", "Klonner & Rai (2008); docs/08 mục 2.2"),
    ("404 USDC = (5 − 1) × (100 + 1)", "6", "docs/03 mục 2.6"),
    ("8 + 2 USDC; 32,318; ký quỹ 48, 46, 36, 26, 16; 104 kiểm tra", "7, 12", "docs/DEPLOY-FUJI.md mục 15b; docs/03 "
                                                                           "mục 8 chia 10"),
    ("20%; 480; 600; 100%; sàn 100%", "8", "docs/03 mục 2.1 đến 2.3 và 8; ADR-22"),
    ("5 contract verify; HuiFactory; Safe 2/3", "11, 12, 19", "contracts/deployments/fuji.json"),
    ("520.000 gas", "11", "docs/04 mục 7.1 (GasBudget, N = 5, không ai thiếu)"),
    ("Chốt giao dịch dưới 1 giây", "11", "docs/06 (trang Performance của Avalanche)"),
    ("Dây cố định: 3 kỳ, tất toán, số dư 0", "12", "docs/DEPLOY-FUJI.md mục 15"),
    ("Dây web 20/11: 5 kỳ; 31,20 đến 39,20 USDC", "12", "Đọc trên Fuji ngày 21/11/2026: state Completed, roundInfo "
                                                       "kỳ 1 đến 5, ký quỹ 48, số dư 0"),
    ("3 dây; 13 kỳ; 0 USDC còn lại", "12", "Cộng từ ba dòng trên (3 + 5 + 5 kỳ)"),
    ("634 test; 17 hàm invariant", "11, 13", "forge test và grep function invariant_, đo 20-21/11/2026"),
    ("98,7% coverage; Slither High 0; 0 Critical/High", "13", "docs/TIEN-DO.md (A16, 11/11/2026)"),
    ("web 503; sdk 139; keeper 25; config 15; Playwright 556; anvil 107", "13", "pnpm test, Playwright, e2e:anvil, "
                                                                               "đo 20-21/11/2026"),
    ("23,33%; 62,46%; 0,01%; 4,99%; 6,37%; 0,0003%; 24,04%; 23,90%; 0,00%", "13", "sim/outputs/baseline.json "
                                                                                  "(08/11/2026, seed 42), làm tròn"),
    ("7,2; 7,397259; 14,597259; 14,794518; 0,197259", "14", "docs/03 mục 8.1 (hiệu 0,197259 tính từ hai số đó)"),
    ("4,146821; 4,146820; 3,110115; 0,829364", "14", "docs/03 mục 8.2 (vector V1)"),
    ("Hoa hồng tối đa 3%; φ tối đa 50%", "14, 15", "docs/03 mục 2.7 và 3.1"),
    ("Bảng ví ảo (−18,038354 ... 297,682223)", "17", "docs/03 mục 7.3; sim/outputs/organizer_sybil.json"),
    ("1.000; 600; 304; 94,08; 392; 800", "17", "docs/03 mục 7.3"),
    ("Bảng lời của chủ hụi", "22", "sim/outputs/organizer_economics.json (10/11/2026)"),
    ("Eval trợ lý 33/33 (mô hình giả lập)", "23", "docs/TIEN-DO.md (M4)"),
]


def appendix_sources(prs, part, rows, num):
    s = new_slide(prs)
    header(s, num, f"PHỤ LỤC A · NGUỒN SỐ ({part}/2)", "Mỗi con số trên slide và nơi lấy nó", title_size=28)
    data = [["SỐ TRÊN SLIDE", "SLIDE", "NGUỒN"]] + [[a, b, c] for a, b, c in rows]
    table(s, ML, 1.65, [5.6, 1.05, 5.48], data, size=11.5, head_size=10, row_h=0.36, head_h=0.34, pad=0.06)
    footer(s, num)
    notes(s, "Phụ lục A liệt kê nguồn của từng con số trên slide để ban giám khảo tự kiểm. Số mô phỏng lấy từ file "
             "JSON trong sim/outputs, số Fuji lấy từ docs/DEPLOY-FUJI.md và đọc lại trên chuỗi." if part == 1 else
             "Phần 2 của phụ lục A: số kiểm thử, kết quả mô phỏng và các số của bản 1.2, kèm file nguồn.")


def appendix_economics(prs, num):
    s = new_slide(prs)
    header(s, num, "PHỤ LỤC B · CHỦ HỤI LỜI BAO NHIÊU", "Theo mô phỏng, chủ hụi dây tháng lời khoảng 5% một năm trên "
           "ký quỹ, dây tuần ít người thì lỗ", title_size=28)
    rows = [
        ["CHU KỲ, SỐ NGƯỜI", "CỐ ĐỊNH 1% (v1.1)", "φ = 33%", "φ = 50%"],
        ["Tuần, 5 người", "14,97% (29,15%)", "−19,64% (−5,65%)", "−15,51% (−1,50%)"],
        ["Tháng, 5 người", "3,40% (6,71%)", "1,75% (5,04%)", "5,19% (8,51%)"],
        ["Tháng, 10 người", "1,50% (3,42%)", "3,88% (5,83%)", "5,24% (7,19%)"],
        ["Thăm + hoa hồng nằm trong trần lãi?", "Không, ở cả 8 dây", "Có", "Có"],
    ]
    gf = table(s, ML, 2.15, [3.6, 2.85, 2.85, 2.83], rows, size=15, row_h=0.58, head_h=0.42, num_cols=(1, 2, 3))
    # φ is not in IBM Plex Mono: draw those header cells in Inter Tight.
    for c in (2, 3):
        cell = gf.table.cell(0, c)
        for p in cell.text_frame.paragraphs:
            for r in p.runs:
                r.font.name = SANS
    rect(s, ML, 5.05, CW, 1.2, fill=PAPER, line=LINE, lw=1, radius=0.08)
    text(s, ML + 0.25, 5.13, CW - 0.5, 1.05, [
        {"text": "Kết quả của giả định, không phải dự báo.", "bold": True, "color": INK},
        "Lời sau rủi ro trên ký quỹ, quy theo năm; trong ngoặc là khi tỷ lệ bỏ đóng giảm một nửa. C = 100 USDC, giữ "
        "lại 20%, ký quỹ cho chỉ số 100%, người hốt thăm 50% trần thực thi, tỷ lệ bỏ đóng theo Klonner & Rai áp một "
        "lần.",
    ], size=14, color=INK2, ls=1.22, after=2)
    footer(s, num, source="Nguồn: sim/outputs/organizer_economics.json và .meta.json (10/11/2026), trường "
                          "annualReturnPctByHazardScale và insideInterestCap; làm tròn 2 chữ số; docs/08 mục 2.7.")
    notes(s, "Phụ lục B trả lời câu hỏi chủ hụi có lời không. Với hoa hồng nằm trong trần, chủ hụi dây tháng lời khoảng "
             "5% một năm trên ký quỹ ở giả định này, còn dây tuần ít người thì lỗ. "
             "Mức cố định 1% trông cao ở dây tuần vì nó vượt trần lãi của người hốt. Đây là kết quả của giả định, "
             "không phải dự báo.")


def appendix_ai(prs, num):
    s = new_slide(prs)
    header(s, num, "PHỤ LỤC C · TRỢ LÝ CHỦ HỤI", "Trợ lý AI chỉ đọc và tính bằng hàm tất định, không ký giao dịch",
           title_size=28)
    do = [
        "Tính rủi ro theo từng kỳ và mức rủi ro lớn nhất của dây.",
        "Gợi ý ký quỹ để đạt chỉ số bảo chứng mục tiêu.",
        "Lập bảng trần thăm theo kỳ, kèm hoa hồng khi φ > 0.",
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
    for i, (title, items, fill) in enumerate([("Làm", do, PAPER), ("Không làm", dont, PAPER)]):
        x = ML + i * (cw + 0.4)
        rect(s, x, 1.85, cw, 4.15, fill=fill, line=LINE, lw=1, radius=0.1)
        text(s, x + 0.3, 2.0, cw - 0.6, 0.42, title, size=20, bold=True, color=(INK if i == 0 else RED_INK))
        text(s, x + 0.3, 2.58, cw - 0.6, 3.3, items, size=15, ls=1.2, after=8, bullet=True,
             bullet_color=(INK if i == 0 else RED_INK))
    text(s, ML, 6.1, CW, 0.3, "Bộ eval 33/33 ca đạt khi chạy với mô hình giả lập; chưa chạy eval với mô hình thật. "
         "Tắt trợ lý thì các luồng chính vẫn chạy.", size=13, color=INK2)
    footer(s, num, source="Nguồn: docs/05 mục 8.4 và 12; docs/07; ADR-12 (LLM không ký, không quyết định chuyển "
                          "tiền).")
    notes(s, "Phụ lục C mô tả trợ lý chủ hụi. Mọi con số do hàm tính tất định của HụiSafe trả về; mô hình AI chỉ chọn "
             "công cụ và viết lời giải thích. Trợ lý không có công cụ nào ký giao dịch hay chuyển tiền, không nhận dữ "
             "liệu cá nhân, và luôn ghi rõ đây không phải tư vấn tài chính hay pháp lý.")


def build() -> Path:
    prs = Presentation()
    prs.slide_width = Emu(12192000)
    prs.slide_height = Emu(6858000)
    tune_theme(prs)
    for fn in (s01_cover, s02_demo, s03_problem, s04_idea, s05_product, s06_round, s07_cascade, s08_coverage,
               s09_ux, s10_arch, s11_avalanche, s12_fuji, s13_tests, s14_commission, s15_questions, s16_law,
               s17_limits, s18_roadmap, s19_team):
        fn(prs)
    half = (len(SOURCES) + 1) // 2
    appendix_sources(prs, 1, SOURCES[:half], 20)
    appendix_sources(prs, 2, SOURCES[half:], 21)
    appendix_economics(prs, 22)
    appendix_ai(prs, 23)
    assert len(prs.slides) == TOTAL, len(prs.slides)
    prs.core_properties.title = "HụiSafe · UniHack 2026"
    prs.core_properties.author = "Đội HụiSafe"
    prs.core_properties.language = "vi-VN"
    prs.save(OUT)
    return OUT


if __name__ == "__main__":
    print(build())
