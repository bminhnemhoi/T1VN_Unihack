#!/usr/bin/env bash
# Full-page screenshots (2x pixel density) of the live pages used in S05 and S12. Read-only page views.
set -u
cd "$(dirname "$0")/.."
OUT="$PWD/public/capture"
mkdir -p "$OUT"
EXPLORER="https://subnets-test.avax.network/c-chain/address"
APP="https://lamng.tail3abf4e.ts.net:8443"
hi() { # $1 width, $2 height
  echo "async page => { const s = await page.context().newCDPSession(page); await s.send('Emulation.setDeviceMetricsOverride', { width: $1, height: $2, deviceScaleFactor: 2, mobile: false }); await page.waitForTimeout(1500); }"
}
shot() { # $1 url, $2 file, $3 width, $4 height, $5 wait seconds
  playwright-cli open "$1" --idle-timeout=150000 >/dev/null 2>&1
  playwright-cli resize "$3" "$4" >/dev/null 2>&1
  sleep "$5"
  playwright-cli run-code "$(hi "$3" "$4")" >/dev/null 2>&1
  playwright-cli run-code 'async page => { const b = page.getByRole("button", { name: "Decline" }); if (await b.count()) { await b.first().click(); await page.waitForTimeout(800); } }' >/dev/null 2>&1
  playwright-cli run-code "async page => { await page.screenshot({ path: '$OUT/$2', fullPage: true }); }" >/dev/null 2>&1
  playwright-cli close >/dev/null 2>&1
}
shot "$EXPLORER/0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc" explorer-c628.png 1280 800 7
shot "$EXPLORER/0xa42866012F1FbFE4507B87B2D2C9cc69D13F8f5a" explorer-a428.png 1280 800 7
shot "$APP/" landing-full.png 1440 900 9
playwright-cli list 2>&1 | tail -1
for f in "$OUT"/*.png; do python3 -c "from PIL import Image; import sys; im=Image.open(sys.argv[1]); print(sys.argv[1].split('/')[-1], im.size)" "$f"; done
