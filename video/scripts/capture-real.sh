#!/usr/bin/env bash
# Records the real captures used in S12 and the landing texture used in S05.
# Headless playwright-cli, read-only page views; nothing is signed or sent.
set -u
cd "$(dirname "$0")/.."
OUT="$PWD/capture"
mkdir -p "$OUT"
EXPLORER="https://subnets-test.avax.network/c-chain/address"
APP="https://lamng.tail3abf4e.ts.net:8443"

decline='async page => { const b = page.getByRole("button", { name: "Decline" }); if (await b.count()) { await b.first().click(); } await page.waitForTimeout(1500); }'
scroll() { # $1 = pixels per step, $2 = steps, $3 = hold ms after
  echo "async page => { await page.waitForTimeout(1200); for (let i = 0; i < $2; i++) { await page.mouse.wheel(0, $1); await page.waitForTimeout(28); } await page.waitForTimeout($3); }"
}

record_explorer() { # $1 = address, $2 = file name
  playwright-cli open "$EXPLORER/$1" --idle-timeout=180000 >/dev/null 2>&1
  playwright-cli resize 1280 800 >/dev/null 2>&1
  sleep 6
  playwright-cli run-code "$decline" >/dev/null 2>&1
  playwright-cli video-start "$OUT/$2" --fps=60 >/dev/null 2>&1
  playwright-cli run-code "$(scroll 9 60 2600)" >/dev/null 2>&1
  playwright-cli video-stop >/dev/null 2>&1
  playwright-cli close >/dev/null 2>&1
}

record_explorer 0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc explorer-c628.webm
record_explorer 0xa42866012F1FbFE4507B87B2D2C9cc69D13F8f5a explorer-a428.webm

# Landing: the live Fuji ledger section (#so-cai), then a 2x texture of the hero's right column for S05.
playwright-cli open "$APP/#so-cai" --idle-timeout=180000 >/dev/null 2>&1
playwright-cli resize 1280 800 >/dev/null 2>&1
sleep 8
playwright-cli video-start "$OUT/landing-socai.webm" --fps=60 >/dev/null 2>&1
playwright-cli run-code "$(scroll 6 50 2400)" >/dev/null 2>&1
playwright-cli video-stop >/dev/null 2>&1
playwright-cli goto "$APP/" >/dev/null 2>&1
playwright-cli resize 1440 900 >/dev/null 2>&1
sleep 5
playwright-cli screenshot --hires --filename="$OUT/landing-1440-2x.png" >/dev/null 2>&1
playwright-cli close >/dev/null 2>&1
playwright-cli list 2>&1 | tail -1
ls -la "$OUT"
