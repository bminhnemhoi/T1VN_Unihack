#!/usr/bin/env python3
"""Render the deck's charts to assets/charts/*.png with the HuiSafe design tokens (apps/web/DESIGN.md).

Every series is read from a file in the repo or typed here next to its source, so a chart never carries a number
the deck's appendix cannot trace. Fonts: static weights are instantiated on the fly from the variable Inter Tight
that ships with the video project (video/public/fonts), so the script needs no system font.

    pip install matplotlib fonttools
    python docs/pitch/slides/build/build_charts.py
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from matplotlib import font_manager as fm

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
OUT = HERE / "assets" / "charts"
FONTS = REPO / "video" / "public" / "fonts"

IVORY, PAPER, INK, INK2 = "#F4F0E8", "#FBF9F4", "#201D1D", "#5A5555"
LINE, MUTE, LIME, RED, DEEP = "#DCD6CB", "#A39D94", "#A1FF62", "#C4271A", "#151313"
FOREST = "#1F5A2E"


def _fonts() -> dict[str, fm.FontProperties]:
    tmp = Path(tempfile.mkdtemp(prefix="hui-chart-fonts-"))
    props = {}
    for name, wght in (("regular", 400), ("medium", 500), ("semibold", 600), ("bold", 700), ("black", 900)):
        vf = TTFont(FONTS / "InterTight-VF.ttf")
        inst = instancer.instantiateVariableFont(vf, {"wght": wght}, inplace=False)
        path = tmp / f"InterTight-{name}.ttf"
        inst.save(path)
        props[name] = fm.FontProperties(fname=str(path))
    props["mono"] = fm.FontProperties(fname=str(FONTS / "IBMPlexMono-Medium.ttf"))
    props["mono_bold"] = fm.FontProperties(fname=str(FONTS / "IBMPlexMono-Bold.ttf"))
    return props


F = _fonts()


def _fp(key: str, size: float) -> fm.FontProperties:
    p = F[key].copy()
    p.set_size(size)
    return p


def _clean(ax) -> None:
    for side in ("top", "right", "left", "bottom"):
        ax.spines[side].set_visible(False)
    ax.tick_params(length=0)
    ax.set_facecolor("none")


def _save(fig, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT / name, dpi=300, transparent=True)
    plt.close(fig)
    print("wrote", OUT / name)


def chart_simulation() -> None:
    """Share of circles where someone was short-paid or the organiser absconded (sim/outputs/baseline.json)."""
    data = {r["design"]: r for r in json.loads((REPO / "sim/outputs/baseline.json").read_text("utf-8"))["results"]}
    rows = [
        ("Hụi truyền thống", data["traditional"]["circleFailureProb"] * 100, INK),
        ("Hụi on-chain đơn giản", data["naive_onchain"]["circleFailureProb"] * 100, MUTE),
        ("HụiSafe", data["huisafe"]["circleFailureProb"] * 100, LIME),
    ]
    fig, ax = plt.subplots(figsize=(6.4, 3.0))
    fig.subplots_adjust(left=0.01, right=0.99, top=0.98, bottom=0.02)
    _clean(ax)
    ys = [2, 1, 0]
    for y, (label, v, color) in zip(ys, rows):
        ax.barh(y, 100, height=0.34, color=LINE, zorder=1)
        ax.barh(y, max(v, 0.45), height=0.34, color=color, zorder=2, edgecolor=(INK if color == LIME else "none"),
                linewidth=(0.8 if color == LIME else 0))
        ax.text(0, y + 0.3, label, fontproperties=_fp("semibold", 13), color=INK, va="bottom", ha="left")
        val = f"{v:.1f}%".replace(".", ",") if v >= 0.1 else f"{v:.2f}%".replace(".", ",")
        ax.text(100, y + 0.3, val, fontproperties=_fp("mono_bold", 15), color=INK, va="bottom", ha="right")
    ax.set_xlim(0, 100)
    ax.set_ylim(-0.4, 2.75)
    ax.set_xticks([])
    ax.set_yticks([])
    _save(fig, "sim-failure.png")


def chart_exposure() -> None:
    """Exposure O(k) = k(N-k)C for the worked circle (N=5, C=100 USDC, docs/03 section 2.1) and what covers it."""
    n, c, alpha, bond = 5, 100, 0.20, 480
    ks = list(range(1, n))
    expo = [k * (n - k) * c for k in ks]
    hold = [alpha * e for e in expo]
    rest = [e - h for e, h in zip(expo, hold)]
    fig, ax = plt.subplots(figsize=(6.2, 3.3))
    fig.subplots_adjust(left=0.085, right=0.99, top=0.9, bottom=0.14)
    _clean(ax)
    ax.bar(ks, rest, width=0.56, color=INK, zorder=2, label="Phần ký quỹ phải che")
    ax.bar(ks, hold, width=0.56, bottom=rest, color=LIME, zorder=2, edgecolor=INK, linewidth=0.8,
           label="Tiền giữ lại 20% che sẵn")
    ax.axhline(bond, color=RED, linewidth=1.4, linestyle=(0, (5, 3)), zorder=3)
    ax.text(4.42, bond + 14, "Ký quỹ 480", fontproperties=_fp("mono_bold", 10.5), color=RED, ha="right", va="bottom")
    for k, e in zip(ks, expo):
        ax.text(k, e + 14, f"{e}", fontproperties=_fp("mono_bold", 12), color=INK, ha="center", va="bottom")
    ax.set_xticks(ks)
    ax.set_xticklabels([f"Sau kỳ {k}" for k in ks], fontproperties=_fp("medium", 11), color=INK2)
    ax.set_yticks([0, 200, 400, 600])
    ax.set_yticklabels(["0", "200", "400", "600"], fontproperties=_fp("mono", 9.5), color=INK2)
    ax.set_ylim(0, 720)
    ax.set_xlim(0.5, 4.5)
    ax.grid(axis="y", color=LINE, linewidth=0.7, zorder=0)
    ax.set_axisbelow(True)
    leg = ax.legend(loc="upper left", bbox_to_anchor=(-0.01, 1.14), ncol=2, frameon=False, prop=_fp("medium", 10.5),
                    handlelength=1.1, handleheight=0.9, columnspacing=1.6)
    for t in leg.get_texts():
        t.set_color(INK)
    _save(fig, "exposure.png")


def chart_cases(cases: list[tuple[str, float, str]]) -> None:
    """Reported losses of press-covered hụi collapses, billion VND (each bar is one sourced article)."""
    cases = sorted(cases, key=lambda r: r[1])
    fig, ax = plt.subplots(figsize=(6.3, 3.5))
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    _clean(ax)
    top = max(v for _, v, _ in cases)
    for i, (label, v, src) in enumerate(cases):
        ax.barh(i, v, height=0.36, color=LIME, zorder=2)
        ax.text(0, i + 0.27, label, fontproperties=_fp("semibold", 13.5), color=IVORY, va="bottom", ha="left")
        val = (f"{v:,.0f}".replace(",", ".") if v >= 10 else f"{v:.1f}".replace(".", ",")) + " tỷ"
        ax.text(v + top * 0.015, i, val, fontproperties=_fp("mono_bold", 13.5), color=IVORY, va="center", ha="left")
        ax.text(top * 1.22, i + 0.27, src, fontproperties=_fp("mono", 9.5), color=MUTE, va="bottom", ha="right")
    ax.set_xlim(0, top * 1.22)
    ax.set_ylim(-0.5, len(cases) - 0.2)
    ax.set_xticks([])
    ax.set_yticks([])
    _save(fig, "cases.png")


def chart_findex(rows: list[tuple[str, float]], highlight: int) -> None:
    """World Bank Global Findex shares of Vietnamese adults (values typed from the cited report)."""
    fig, ax = plt.subplots(figsize=(5.6, 3.1))
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    _clean(ax)
    n = len(rows)
    for i, (label, v) in enumerate(rows):
        y = n - 1 - i
        ax.barh(y, 100, height=0.34, color=LINE, zorder=1)
        hi = i == highlight
        ax.barh(y, v, height=0.34, color=(LIME if hi else INK), zorder=2, edgecolor=(INK if hi else "none"),
                linewidth=(0.8 if hi else 0))
        ax.text(0, y + 0.29, label, fontproperties=_fp("semibold", 14.5), color=INK, va="bottom", ha="left")
        ax.text(100, y + 0.29, f"{v:.0f}%", fontproperties=_fp("mono_bold", 17), color=INK, va="bottom", ha="right")
    ax.set_xlim(0, 100)
    ax.set_ylim(-0.45, n - 0.25)
    ax.set_xticks([])
    ax.set_yticks([])
    _save(fig, "findex.png")


if __name__ == "__main__":
    chart_simulation()
    chart_exposure()
    data_file = HERE / "assets" / "charts" / "data.json"
    if data_file.exists():
        d = json.loads(data_file.read_text("utf-8"))
        if d.get("cases"):
            chart_cases([tuple(r) for r in d["cases"]])
        if d.get("findex"):
            chart_findex([tuple(r) for r in d["findex"]["rows"]], d["findex"].get("highlight", 0))
