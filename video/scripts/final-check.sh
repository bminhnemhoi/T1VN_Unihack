#!/usr/bin/env bash
# Mux the mastered soundtrack into the rendered picture, then check the result the way B30 requires:
# specs (ffprobe), sound against the picture (earshot timeline with the cue sheet, critique, sheet PNG) and frames
# pulled from the final MP4 around every scene seam.
# Usage: scripts/final-check.sh <picture.mp4> <out.mp4> <scratch dir>
set -eu
cd "$(dirname "$0")/.."
PIC="$1"; OUT="$2"; S="$3"; mkdir -p "$S"
E=~/.local/share/earshot-venv/bin/earshot
ffmpeg -v error -y -i "$PIC" -i audio/mix/master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 \
  -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate \
  -of compact=p=0 "$OUT"
export EARSHOT_THREADS=10
$E timeline "$OUT" --cues audio/cues-earshot.json --json --out "$S/timeline.json" >/dev/null 2>&1
$E critique "$OUT" --out "$S/critique.json" > "$S/critique.txt" 2>/dev/null
$E sheet "$OUT" -o "$S/sheet.png" --cues audio/cues-earshot.json --detail low >/dev/null 2>&1 || true
# frames around each seam, read from the final file itself
python3 - "$OUT" "$S" <<'EOF'
import json, subprocess, sys, os
from PIL import Image, ImageDraw
out, s = sys.argv[1], sys.argv[2]
seams = [6.037, 15.237, 29.894, 42.428, 46.961, 63.599, 70.46, 80.595, 94.507, 112.623, 117.186, 131.177, 156.274, 160.95]
times = [round(t + d, 2) for t in seams for d in (-0.3, 0.0, 0.3)]
tw, th = 480, 270
cols = 6
rows = (len(times) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw + (cols - 1) * 4, rows * th + (rows - 1) * 4), "white")
for i, t in enumerate(times):
    f = os.path.join(s, f"f_{i:03d}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", out, "-frames:v", "1", "-vf", f"scale={tw}:{th}", f], check=True)
    im = Image.open(f).convert("RGB")
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 64, 16), fill="white")
    d.text((4, 3), f"{t:.2f}s", fill="black")
    sheet.paste(im, ((i % cols) * (tw + 4), (i // cols) * (th + 4)))
    os.remove(f)
sheet.save(os.path.join(s, "seams.jpg"), quality=85)
print("seams.jpg", len(times), "frames")
EOF
head -12 "$S/critique.txt"
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d['summary'][-700:])" "$S/timeline.json"
