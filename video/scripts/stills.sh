#!/usr/bin/env bash
# Render Film frames at the given seconds and tile them into one labelled contact sheet.
# Usage: scripts/stills.sh <out.jpg> <sec> [sec ...]   (cols via COLS=4, thumb width via TW=640)
set -eu
cd "$(dirname "$0")/.."
OUT="$1"; shift
DIR=$(mktemp -d "${TMPDIR:-/tmp}/b30-stills-XXXX")
FRAMES=$(python3 -c "import sys; print(','.join(str(round(float(s)*60)) for s in sys.argv[1:]))" "$@")
npx remotion render Film "$DIR" --frames="$FRAMES" --image-format=jpeg --jpeg-quality=85 --concurrency=6 --log=error >/dev/null
python3 - "$DIR" "$OUT" "${COLS:-4}" "${TW:-640}" "$@" <<'EOF'
import sys, glob, os, re
from PIL import Image, ImageDraw
d, out, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
secs = [float(s) for s in sys.argv[5:]]
files = sorted(glob.glob(os.path.join(d, '*.jpeg')), key=lambda f: int(re.findall(r'(\d+)\.jpeg$', f)[0]))
th = tw * 9 // 16
rows = (len(files) + cols - 1) // cols
im = Image.new('RGB', (cols * tw + (cols - 1) * 6, rows * th + (rows - 1) * 6), 'white')
for i, f in enumerate(files):
    t = Image.open(f).resize((tw, th))
    dr = ImageDraw.Draw(t)
    label = f'{secs[i]:.2f}s' if i < len(secs) else os.path.basename(f)
    dr.rectangle((0, 0, 8 * len(label) + 12, 22), fill='white')
    dr.text((6, 5), label, fill='black')
    im.paste(t, ((i % cols) * (tw + 6), (i // cols) * (th + 6)))
im.save(out, quality=86)
print(out, len(files), 'frames')
EOF
rm -rf "$DIR"
