#!/usr/bin/env bash
# Convert the deck to PDF with LibreOffice (in Docker) and write one PNG per slide to ../preview/.
# Needs: docker, pdftoppm (poppler), and the fonts Inter Tight + IBM Plex Mono in FONTS_DIR (OFL, Google Fonts).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SLIDES="$(dirname "$HERE")"
DECK="HuiSafe-UniHack-2026"
FONTS_DIR="${FONTS_DIR:-$HOME/.local/share/fonts/b29-slides}"
IMAGE="${LO_IMAGE:-b29-libreoffice:local}"

[ -f "$SLIDES/$DECK.pptx" ] || { echo "missing $SLIDES/$DECK.pptx: run build_deck.py first" >&2; exit 1; }
[ -d "$FONTS_DIR" ] || { echo "missing fonts dir $FONTS_DIR (Inter Tight, IBM Plex Mono)" >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -q -t "$IMAGE" -f "$HERE/Dockerfile.libreoffice" "$HERE"

docker run --rm --network none --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$SLIDES":/work -v "$FONTS_DIR":/usr/share/fonts/truetype/b29:ro "$IMAGE" \
  sh -c "fc-cache -f >/dev/null 2>&1; soffice -env:UserInstallation=file:///tmp/lo-profile --headless \
         --convert-to pdf --outdir /work /work/$DECK.pptx >/dev/null"

mkdir -p "$SLIDES/preview"
find "$SLIDES/preview" -maxdepth 1 -name 'slide-*.png' -delete
pdftoppm -png -r 96 "$SLIDES/$DECK.pdf" "$SLIDES/preview/slide"
ls -1 "$SLIDES/preview"/slide-*.png | wc -l | xargs echo "preview pages:"
