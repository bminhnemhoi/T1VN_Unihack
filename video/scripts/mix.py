#!/usr/bin/env python3
"""Mix the film's soundtrack: voiceover + music bed + the earshot sound kit, then master to -14 LUFS / <= -1 dBTP.

Run with the earshot venv (numpy + soundfile):  ~/.local/share/earshot-venv/bin/python scripts/mix.py
Inputs: audio/cues.json (npx tsx scripts/cues.ts), audio/kit/kit.lock.json (earshot kit render audio/kit.json --out
audio/kit), public/vo/L*.mp3, audio/music/hope-on-repeat.mp3 (+ its earshot timeline for the beat grid).
Outputs in audio/mix/: vo.wav, music.wav, sfx.wav (stems), premix.wav, master.wav, mix-report.json.

Music edit (HoliznaCC0, "Hope On Repeat", CC0):
  M1  track 0 s from film 5.9 s under the hụi story, stopped on the jar breaking (anchors.shatter).
  M2  track 0 s again from the start of S04, placed so the track's downbeat at 11.28 s (where the beat comes in, after
      its own 0.7 s gap) lands on the ivory flood (anchors.flood).
  M3  the same track 36 beats (9 bars) later, joined on a beat under the S10 whoosh (anchors.edit), so the track's
      last section plays through the end card and its quiet tail is only the film's final second and a half.
The bed ducks under every voiceover line (gaps under 0.7 s stay ducked so it does not pump).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
OUT = ROOT / "audio/mix"

# Levels (dB). VO lines measure about -21 LUFS each; +1 dB puts the bus near -20 before the bus compressor.
VO_GAIN = 1.0
M1_OPEN, M2_INTRO_OPEN, BEAT_OPEN = -6.0, -6.0, -11.5  # the intro strings sit 5 dB under the beat sections
DUCK = 7.0  # how far the bed drops under the voice
EDIT_BEATS = 36  # the music edit skips 9 bars of 4/4
TARGET_LUFS, TARGET_TP = -14.0, -1.5


def decode(path: Path, mono: bool = False) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1" if mono else "2", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    x = np.frombuffer(raw, np.float32).copy()
    return x if mono else x.reshape(-1, 2)


def db(g: float) -> float:
    return float(10 ** (g / 20))


def fade(n: int, kind: str = "cos") -> np.ndarray:
    t = np.linspace(0, 1, n, endpoint=False)
    return np.sin(t * np.pi / 2) if kind == "cos" else t


def place(bus: np.ndarray, clip: np.ndarray, start_s: float, gain: float = 1.0) -> None:
    i = int(round(start_s * SR))
    if i < 0:
        clip, i = clip[-i:], 0
    j = min(len(bus), i + len(clip))
    if j > i:
        bus[i:j] += clip[: j - i] * gain


def smooth(x: np.ndarray, seconds: float) -> np.ndarray:
    n = max(1, int(seconds * SR))
    k = np.hanning(2 * n + 1)
    k /= k.sum()
    return np.convolve(np.pad(x, n, mode="edge"), k, mode="valid")


def loudness(path: Path) -> dict:
    """BS.1770 integrated loudness, LRA and true peak from ffmpeg's ebur128 meter."""
    err = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    tail = err[err.rfind("Summary:"):]
    out = {}
    for line in tail.splitlines():
        s = line.strip()
        if s.startswith("I:"):
            out["lufs"] = float(s.split()[1])
        elif s.startswith("LRA:"):
            out["lra"] = float(s.split()[1])
        elif s.startswith("Peak:"):
            out["true_peak_dbtp"] = float(s.split()[1])
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    plan = json.loads((ROOT / "audio/cues.json").read_text())
    total = float(plan["total"])
    n = int(round(total * SR)) + 1
    a = plan["anchors"]

    # ---------- voiceover ----------
    vo = np.zeros((n, 2), np.float32)
    mask = np.zeros(n, np.float32)
    for line in plan["vo"]:
        clip = decode(ROOT / f"public/vo/{line['id']}.mp3", mono=True)
        place(vo, np.repeat(clip[:, None], 2, axis=1), line["start"], db(VO_GAIN))
        i0, i1 = int((line["start"] - 0.18) * SR), int((line["end"] + 0.3) * SR)
        mask[max(0, i0): min(n, i1)] = 1.0
    # fill gaps shorter than 0.7 s so the bed does not pump between phrases
    gap = int(0.7 * SR)
    on = np.flatnonzero(np.diff(np.r_[0, mask, 0]) != 0).reshape(-1, 2)
    for (s0, e0), (s1, _) in zip(on, on[1:]):
        if s1 - e0 < gap:
            mask[e0:s1] = 1.0
    duck = smooth(mask, 0.22)[:n]

    # ---------- music ----------
    track = decode(ROOT / "audio/music/hope-on-repeat.mp3")
    beats = np.array(json.loads((ROOT / "audio/music/hope-on-repeat.timeline.json").read_text())["music"]["beats"])
    drop_beat = float(beats[np.argmin(np.abs(beats - 11.28))])
    off2 = a["flood"] - drop_beat
    k_edit = int(np.argmin(np.abs(beats - (a["edit"] - off2))))
    t_a, t_b = float(beats[k_edit]), float(beats[k_edit + EDIT_BEATS])
    film_edit = t_a + off2
    off3 = film_edit - t_b

    music = np.zeros((n, 2), np.float32)
    base = np.full(n, -120.0, np.float32)  # per-sample open gain of the bed in dB (-120 = silent)

    def segment(t_from: float, t_to: float, film_at: float, fade_in: float, fade_out: float) -> None:
        seg = track[int(t_from * SR): int(t_to * SR)].copy()
        if fade_in > 0:
            k = int(fade_in * SR)
            seg[:k] *= fade(k)[:, None]
        if fade_out > 0:
            k = int(fade_out * SR)
            seg[-k:] *= fade(k)[::-1, None]
        place(music, seg, film_at)

    # M1: from film 5.9 s until the jar breaks
    m1_at = 5.9
    segment(0.0, a["shatter"] - m1_at + 0.04, m1_at, 0.4, 0.04)
    base[int(m1_at * SR): int((a["shatter"] + 0.04) * SR)] = M1_OPEN
    # M2: intro strings from the top of S04 into the beat drop on the flood, then the beat to the edit
    xf = 0.03
    segment(0.0, t_a + xf, off2, 0.8, xf)
    base[int(off2 * SR): int(a["flood"] * SR)] = M2_INTRO_OPEN
    base[int(a["flood"] * SR): int((film_edit + xf) * SR)] = BEAT_OPEN
    # M3: 40 beats later, to the end of the film with a fade on the last 1.2 s
    m3_len = min(len(track) / SR - t_b, total - film_edit)
    segment(t_b, t_b + m3_len, film_edit, xf, 1.2)
    base[int(film_edit * SR):] = BEAT_OPEN
    gain_db = base - DUCK * duck
    music *= (10 ** (gain_db / 20))[:, None].astype(np.float32)

    # ---------- effects ----------
    lock = json.loads((ROOT / "audio/kit/kit.lock.json").read_text())
    takes_audio: dict = {}
    turn: dict = {}
    sfx = np.zeros((n, 2), np.float32)
    placed = []
    for c in plan["cues"]:
        role = lock["roles"][c["role"]]
        takes = role["takes"]
        i = turn.get(c["role"], 0)
        turn[c["role"]] = i + 1
        take = takes[i % len(takes)]
        if take["file"] not in takes_audio:
            x, sr = sf.read(ROOT / "audio/kit" / take["file"], dtype="float32", always_2d=True)
            assert sr == SR, (take["file"], sr)
            takes_audio[take["file"]] = x if x.shape[1] == 2 else np.repeat(x, 2, axis=1)
        align = role.get("align") or "onset"
        start = c["t"] + float(role.get("offset_ms") or 0) / 1000 - float(take[f"{align}_s"])
        g = float(role.get("level_db") or 0) + float(c.get("db") or 0)
        pan = float(c.get("pan") or 0)
        th = (pan + 1) * np.pi / 4  # constant-power pan
        clip = takes_audio[take["file"]] * np.array([np.cos(th), np.sin(th)], np.float32) * np.float32(np.sqrt(2))
        place(sfx, clip, start, db(g))
        placed.append({"t": c["t"], "role": c["role"], "file": take["file"], "start": round(start, 4), "gain_db": round(g, 2)})

    # ---------- buses, premix, master ----------
    sf.write(OUT / "vo-raw.wav", vo, SR, subtype="FLOAT")
    # voice bus: gentle compression so the master reaches -14 LUFS without squashing the music
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "vo-raw.wav"), "-af",
                    "acompressor=threshold=-27dB:ratio=2.5:attack=8:release=160:knee=4:makeup=1.5",
                    "-c:a", "pcm_f32le", str(OUT / "vo.wav")], check=True)
    vo_c, _ = sf.read(OUT / "vo.wav", dtype="float32", always_2d=True)
    vo_c = vo_c[:n]
    # a little more low end under the bed (the lo-fi track is thin below 60 Hz); the voice sits above this band
    sf.write(OUT / "music-raw.wav", music, SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "music-raw.wav"), "-af",
                    "lowshelf=f=70:g=5:w=0.7", "-c:a", "pcm_f32le", str(OUT / "music.wav")], check=True)
    music, _ = sf.read(OUT / "music.wav", dtype="float32", always_2d=True)
    sf.write(OUT / "sfx.wav", sfx, SR, subtype="FLOAT")
    premix = vo_c + music[: len(vo_c)] + sfx[: len(vo_c)]
    sf.write(OUT / "premix.wav", premix, SR, subtype="FLOAT")

    # master: one linear gain to the target, then a light peak limiter (only the odd peak is touched), checked by
    # measurement; a second small gain step if the limiter pulled the loudness off target
    pre = loudness(OUT / "premix.wav")
    gain = TARGET_LUFS - pre["lufs"]
    for _ in range(3):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "premix.wav"), "-af",
                        f"volume={gain:.2f}dB,alimiter=limit={db(TARGET_TP - 0.6):.4f}:attack=2:release=60:level=disabled",
                        "-ar", str(SR), "-c:a", "pcm_s24le", str(OUT / "master.wav")], check=True)
        got = loudness(OUT / "master.wav")
        if abs(got["lufs"] - TARGET_LUFS) <= 0.15:
            break
        gain += TARGET_LUFS - got["lufs"]
    m = {"premix": pre, "gain_db": round(gain, 2)}

    report = {
        "music": {"drop_beat": drop_beat, "m2_offset": round(off2, 4), "edit_film": round(film_edit, 4),
                  "edit_track": [t_a, t_b], "m3_offset": round(off3, 4), "tail_starts_film": round(158.72 + off3, 3)},
        "premix": loudness(OUT / "premix.wav"),
        "master": loudness(OUT / "master.wav"),
        "stems": {k: loudness(OUT / f"{k}.wav") for k in ("vo", "music", "sfx")},
        "master_gain": m,
        "cues": placed,
    }
    (OUT / "mix-report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))
    print(json.dumps({k: report[k] for k in ("music", "premix", "master", "stems")}, indent=1))


if __name__ == "__main__":
    sys.exit(main())
