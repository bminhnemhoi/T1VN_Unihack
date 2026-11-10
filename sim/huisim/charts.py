"""Vietnamese-labelled PNG charts for the pitch (docs/08 section 8). Backend Agg, no display."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from .metrics import DesignMetrics  # noqa: E402
from .policies import DESIGN_LABELS_VI  # noqa: E402
from .scenarios import Scenario  # noqa: E402

COLORS = {"traditional": "#8a8f98", "naive_onchain": "#d9822b", "huisafe": "#1f6feb"}
DPI = 160


def _vn(x: int) -> str:
    return f"{x:,}".replace(",", ".")


def _caption(sc: Scenario) -> str:
    return (
        f"Kết quả mô phỏng với tham số giả định, không phải dự báo. "
        f"Kịch bản {sc.id}, N={sc.n}, C={sc.c} USDC, {_vn(sc.circles)} dây, seed {sc.seed}."
    )


def plot_loss(sc: Scenario, metrics: dict[str, DesignMetrics], path: Path) -> None:
    """Loss of honest late receivers (mean with 95% CI and P95) and share of failing circles."""
    names = list(metrics)
    labels = [DESIGN_LABELS_VI[d] for d in names]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 5), constrained_layout=True)
    xs = range(len(names))
    mean = [metrics[d].values["lateReceiverExpectedLossPct"] or 0.0 for d in names]
    p95 = [metrics[d].values["lateReceiverP95LossPct"] or 0.0 for d in names]
    err = []
    for d, v in zip(names, mean, strict=True):
        ci = metrics[d].ci["lateReceiverExpectedLossPct"]
        err.append((v - ci[0], ci[1] - v) if ci else (0.0, 0.0))
    colors = [COLORS[d] for d in names]
    m_bars = ax1.bar(
        [x - 0.2 for x in xs],
        mean,
        0.4,
        color=colors,
        label="Trung bình (khoảng tin cậy 95%)",
        yerr=list(zip(*err, strict=True)),
        capsize=4,
    )
    p_bars = ax1.bar(
        [x + 0.2 for x in xs],
        p95,
        0.4,
        color=colors,
        alpha=0.45,
        hatch="//",
        label="Phân vị 95 (P95)",
    )
    ax1.bar_label(m_bars, fmt="%.1f%%", padding=2, fontsize=8)
    ax1.bar_label(p_bars, fmt="%.1f%%", padding=2, fontsize=8)
    ax1.set_xticks(list(xs), labels)
    ax1.set_ylabel("Tổn thất (% số tiền đã góp)")
    ax1.set_title("Người hốt sau, trung thực, mất bao nhiêu?")
    ax1.set_ylim(0, max([*mean, *p95, 1.0]) * 1.3)
    ax1.legend(frameon=False, loc="upper left")
    fail = [100 * (metrics[d].values["circleFailureProb"] or 0.0) for d in names]
    bars = ax2.bar(list(xs), fail, 0.55, color=colors)
    ax2.bar_label(bars, fmt="%.1f%%", padding=2)
    ax2.set_xticks(list(xs), labels)
    ax2.set_ylabel("% số dây")
    ax2.set_title("Dây có người trung thực nhận thiếu hoặc chủ hụi bỏ trốn")
    for ax in (ax1, ax2):
        ax.spines[["top", "right"]].set_visible(False)
    fig.suptitle("Ba thiết kế, cùng một hành vi bỏ đóng", fontsize=14, fontweight="bold")
    fig.text(0.5, -0.04, _caption(sc), ha="center", fontsize=8, color="#555555")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)


def plot_inv08(doc: dict[str, Any], path: Path) -> None:
    """Uncovered created per circle: same-round shock versus defaults spread over rounds."""
    plans = {
        "peak_all_at_once": "Cùng lúc ở đỉnh rủi ro",
        "peak_sequential": "Cùng nhóm người, bỏ lần lượt",
        "sequential_all": "Bất kỳ người đã hốt, bỏ lần lượt",
    }
    base = [r for r in doc["rows"] if r["design"] == "huisafe" and r["bondRatio"] == 0.8]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 5), constrained_layout=True)
    pal = ["#1f6feb", "#d9822b", "#b3261e"]
    for color, (kind, label) in zip(pal, plans.items(), strict=True):
        rows = sorted((r for r in base if r["plan"] == kind), key=lambda r: r["q"])
        qs = [100 * r["q"] for r in rows]
        ax1.plot(qs, [r["uncoveredCreatedMeanUsdc"] for r in rows], "o-", color=color, label=label)
    ax1.set_xlabel("% người đã hốt bỏ đóng")
    ax1.set_ylabel("Khoản chưa được bù trung bình mỗi dây (USDC)")
    ax1.set_title("HụiSafe, CI = 100% (α 20%, ký quỹ 0,8 · O_max)")
    ax1.legend(frameon=False)
    seq = sorted(
        (
            r
            for r in doc["rows"]
            if r["design"] == "huisafe" and r["plan"] == "sequential_all" and r["q"] == 1.0
        ),
        key=lambda r: r["bondRatio"],
    )
    ax2.plot(
        [r["bondRatio"] for r in seq],
        [r["uncoveredCreatedMeanUsdc"] for r in seq],
        "o-",
        color="#b3261e",
    )
    ax2.set_xlabel("Ký quỹ (× O_max)")
    ax2.set_ylabel("Khoản chưa được bù trung bình (USDC)")
    ax2.set_title("Mọi người đã hốt bỏ ngay kỳ sau: cần ký quỹ bao nhiêu?")
    for ax in (ax1, ax2):
        ax.spines[["top", "right"]].set_visible(False)
        ax.set_ylim(bottom=0)
    fig.suptitle("Bỏ đóng cùng lúc và bỏ đóng lần lượt", fontsize=14, fontweight="bold")
    fig.text(
        0.5,
        -0.04,
        f"Kết quả mô phỏng với tham số giả định, không phải dự báo. N={doc['N']}, "
        f"C={doc['C']} USDC, {_vn(doc['circles'])} dây, seed {doc['seed']}.",
        ha="center",
        fontsize=8,
        color="#555555",
    )
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)


def _viet(x: float, digits: int = 1) -> str:
    return f"{x:.{digits}f}".replace(".", ",")


def plot_organizer_economics(doc: dict[str, Any], path: Path) -> None:
    """Organizer return per year on the bond after default risk, by circle shape and commission."""
    labels = list(dict.fromkeys(c["schedule"] for c in doc["cells"]))
    pal = ["#8a8f98", "#d9822b", "#1f6feb"]
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), sharey=True, constrained_layout=True)
    for ax, period in zip(axes, (7, 30), strict=True):
        cells = [c for c in doc["cells"] if c["periodDays"] == period]
        members = sorted({c["members"] for c in cells})
        width = 0.8 / len(labels)
        for j, (label, color) in enumerate(zip(labels, pal, strict=False)):
            vals = [
                next(c for c in cells if c["members"] == n and c["schedule"] == label)[
                    "annualReturnPctByHazardScale"
                ]["1"]
                for n in members
            ]
            xs = [i + (j - (len(labels) - 1) / 2) * width for i in range(len(members))]
            bars = ax.bar(xs, vals, width, color=color, label=label)
            ax.bar_label(bars, labels=[_viet(v) for v in vals], padding=2, fontsize=7)
        ax.axhline(0, color="#333333", linewidth=0.8)
        ax.set_xticks(range(len(members)), [f"{n} người" for n in members])
        ax.set_title("Hụi tuần (7 ngày)" if period == 7 else "Hụi tháng (30 ngày)")
        ax.spines[["top", "right"]].set_visible(False)
    axes[0].set_ylabel("Lời của chủ hụi sau rủi ro (% mỗi năm trên ký quỹ)")
    axes[1].legend(frameon=False, loc="lower left", fontsize=8)
    axes[1].set_ylim(top=max(c["annualReturnPctByHazardScale"]["1"] for c in doc["cells"]) * 1.25)
    fig.suptitle(
        "Chủ hụi lời bao nhiêu? Hoa hồng cố định và hoa hồng trong trần lãi",
        fontsize=14,
        fontweight="bold",
    )
    fig.text(
        0.5,
        -0.04,
        "Kết quả mô phỏng với tham số giả định, không phải dự báo. "
        f"C={doc['C']} USDC, α={doc['alphaBps'] // 100}%, ký quỹ cho CI 100%, "
        "người hốt bỏ đóng theo "
        f"tỷ lệ giả định (Klonner & Rai: {_viet(100 * doc['risk']['early'], 2)}% nửa đầu, "
        f"{_viet(100 * doc['risk']['late'], 2)}% nửa sau). Số tất định, không ngẫu nhiên.",
        ha="center",
        fontsize=8,
        color="#555555",
    )
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)


def plot_organizer_sybil(doc: dict[str, Any], path: Path) -> None:
    """Organizer profit or loss with one or two fake wallets; last honest receiver payout."""
    cases = doc["cases"]
    labels = [c["label"].replace(", ", "\n") for c in cases]
    net = [c["organizerNetUsdc"] for c in cases]
    last = [c["lastReceiverPayoutUsdc"] for c in cases]
    normal = cases[0]["lastReceiverNormalUsdc"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 5), constrained_layout=True)
    colors = ["#b3261e" if v < 0 else "#2e7d32" for v in net]
    bars = ax1.bar(range(len(cases)), net, 0.55, color=colors)
    ax1.bar_label(bars, labels=[_viet(v, 2) for v in net], padding=3)
    ax1.axhline(0, color="#333333", linewidth=0.8)
    ax1.set_xticks(range(len(cases)), labels)
    ax1.set_ylabel("Lời (+) hoặc lỗ (−) của chủ hụi, USDC")
    ax1.set_title("Chủ hụi chơi bằng ví ảo: lời hay lỗ?")
    bars2 = ax2.bar(range(len(cases)), last, 0.55, color="#1f6feb")
    ax2.bar_label(bars2, labels=[_viet(v, 2) for v in last], padding=3)
    ax2.axhline(normal, color="#555555", linestyle="--", linewidth=1)
    ax2.text(
        len(cases) - 0.5, normal, f"nhận đủ {_viet(normal, 0)}", ha="right", va="bottom", fontsize=8
    )
    ax2.set_xticks(range(len(cases)), labels)
    ax2.set_ylabel("Người hốt cuối (trung thực) nhận, USDC")
    ax2.set_title("Người trung thực hốt cuối nhận bao nhiêu?")
    for ax in (ax1, ax2):
        ax.spines[["top", "right"]].set_visible(False)
    fig.suptitle("Cọc 100% chặn một ví ảo, không chặn nhiều ví ảo", fontsize=14, fontweight="bold")
    fig.text(
        0.5,
        -0.04,
        "Kết quả mô phỏng với tham số giả định, không phải dự báo. "
        f"N={doc['N']}, C={doc['C']} USDC, α={doc['alphaBps'] // 100}%. "
        "Số tất định, không ngẫu nhiên.",
        ha="center",
        fontsize=8,
        color="#555555",
    )
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
