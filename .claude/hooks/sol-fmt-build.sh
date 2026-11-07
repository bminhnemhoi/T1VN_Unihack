#!/usr/bin/env bash
# HụiSafe - PostToolUse hook cho Edit|Write.
# Khi Claude sửa một file .sol: chạy `forge fmt <file>` rồi `forge build` nhanh trong thư mục
# Foundry gần nhất (chứa foundry.toml). Sửa src/ thì build với `--skip test` cho nhanh;
# sửa test/ hoặc script/ thì build đầy đủ.
# KHÔNG chặn: nếu fmt/build lỗi, in JSON với hookSpecificOutput.additionalContext để Claude
# thấy lỗi và tự sửa, kèm systemMessage cảnh báo người dùng. Luôn exit 0.
set -uo pipefail

INPUT="$(cat)"

get() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg p "$1" \
      'getpath($p | split(".")) // empty | if type == "string" then . else tostring end' 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d.get(k) if isinstance(d, dict) else None
    if d is None:
        break
sys.stdout.write("" if d is None else (d if isinstance(d, str) else json.dumps(d)))
' "$1" 2>/dev/null
  fi
}

FILE="$(get tool_input.file_path)"
FILE="${FILE//\\//}"
case "$FILE" in
  *.sol) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0
command -v forge >/dev/null 2>&1 || exit 0   # chưa cài Foundry: bỏ qua, không làm phiền

# Tìm thư mục Foundry gần nhất (đi ngược lên từ file).
DIR="$(cd "$(dirname "$FILE")" 2>/dev/null && pwd)" || exit 0
ROOT=""
while [ -n "$DIR" ] && [ "$DIR" != "/" ]; do
  if [ -f "$DIR/foundry.toml" ]; then
    ROOT="$DIR"
    break
  fi
  DIR="$(dirname "$DIR")"
done
[ -z "$ROOT" ] && exit 0
cd "$ROOT" || exit 0

FMT_OUT="$(forge fmt "$FILE" 2>&1)"
FMT_RC=$?

# Khóa đơn giản để hai lần sửa song song không chạy hai forge build cùng lúc trên một cache.
LOCK="${TMPDIR:-/tmp}/huisafe-forge-build-$(printf '%s' "$ROOT" | cksum | cut -d' ' -f1).lock"
if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then
  rmdir "$LOCK" 2>/dev/null   # khóa cũ hơn 10 phút: coi như kẹt
fi
BUILD_OUT=""
BUILD_RC=0
BUILD_SKIPPED=0
if mkdir "$LOCK" 2>/dev/null; then
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
  case "$FILE" in
    *.t.sol | *.s.sol | */test/* | */script/*) BUILD_OUT="$(forge build 2>&1)" ;;
    *) BUILD_OUT="$(forge build --skip test 2>&1)" ;;
  esac
  BUILD_RC=$?
else
  BUILD_SKIPPED=1
fi

[ "$FMT_RC" -eq 0 ] && [ "$BUILD_RC" -eq 0 ] && exit 0

REL="${FILE#"$ROOT"/}"
MSG="HuiSafe hook sau khi sửa ${REL}:"
if [ "$FMT_RC" -ne 0 ]; then
  MSG="${MSG}
- forge fmt THẤT BẠI (thường do lỗi cú pháp):
$(printf '%s\n' "$FMT_OUT" | tail -n 25)"
fi
if [ "$BUILD_RC" -ne 0 ]; then
  MSG="${MSG}
- forge build THẤT BẠI (exit ${BUILD_RC}). 60 dòng cuối:
$(printf '%s\n' "$BUILD_OUT" | tail -n 60)"
fi
if [ "$BUILD_SKIPPED" -eq 1 ]; then
  MSG="${MSG}
- (bỏ qua forge build vì một lần build khác đang chạy)"
fi
MSG="${MSG}
Hãy sửa lỗi trước khi làm tiếp, rồi chạy lại: cd ${ROOT} && forge build"
SYS="HuiSafe: forge fmt/build lỗi sau khi sửa ${REL}; đã báo cho Claude."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$MSG" --arg sys "$SYS" \
    '{systemMessage: $sys, hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
elif command -v python3 >/dev/null 2>&1; then
  python3 -I -c 'import json, sys; print(json.dumps({"systemMessage": sys.argv[2], "hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": sys.argv[1]}}))' "$MSG" "$SYS"
else
  printf '%s\n' "$MSG" >&2
  exit 1   # lỗi không chặn: người dùng thấy thông báo hook error
fi
exit 0
