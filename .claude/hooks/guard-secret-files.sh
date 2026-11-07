#!/usr/bin/env bash
# HụiSafe - PreToolUse hook cho Read|Edit|Write|NotebookEdit.
# (a) Chặn đọc/ghi file bí mật: .env* (trừ .env.example/.sample/.template), *.pem, *.key,
#     *.p12, *.pfx, *.jks, *.keystore, id_rsa/id_ed25519..., keystore(s)/, ~/.foundry/keystores, UTC--*.
# (b) Chặn Write/Edit có nội dung trông như khóa bí mật (PEM private key, PRIVATE_KEY=0x<64 hex>,
#     mnemonic, API key Anthropic, token bot Telegram).
# Exit 2 = chặn tool call; stderr được gửi lại cho Claude làm lý do. Exit 0 = không phản đối.
# Tương thích bash 3.2 (macOS) và bash 5.x (Linux/WSL). Cần jq (dự phòng: python3).
set -uo pipefail

INPUT="$(cat)"

# Thiếu cả jq lẫn python3 thì không kiểm tra được: chặn (fail closed). Kiểm ở cấp trên cùng,
# vì exit bên trong $(...) chỉ thoát subshell.
if ! command -v jq >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo "HuiSafe guard: cần jq (hoặc python3) để kiểm tra an toàn. Cài jq rồi thử lại." >&2
  exit 2
fi

get() {
  # $1 = đường dẫn dạng a.b.c trong JSON đầu vào; in giá trị (chuỗi) hoặc rỗng.
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

deny() {
  printf 'HuiSafe guard (secret-files): %s\n' "$1" >&2
  exit 2
}

TOOL="$(get tool_name)"
FILE="$(get tool_input.file_path)"
[ -z "$FILE" ] && FILE="$(get tool_input.notebook_path)"
FILE="${FILE//\\//}"   # chuẩn hóa dấu \ của Windows

is_secret_path() {
  local f="$1" b
  b="$(basename -- "$f" 2>/dev/null || printf '%s' "$f")"
  case "$b" in
    .env.example | .env.sample | .env.template) return 1 ;;
    .env | .env.*) return 0 ;;
    *.pem | *.key | *.p12 | *.pfx | *.jks | *.keystore) return 0 ;;
    id_rsa | id_ecdsa | id_ed25519 | id_dsa) return 0 ;;
    UTC--*) return 0 ;;
  esac
  case "/$f/" in
    */keystore/* | */keystores/*) return 0 ;; # gồm cả ~/.foundry/keystores/
  esac
  return 1
}

if [ -n "$FILE" ] && is_secret_path "$FILE"; then
  deny "'$FILE' là file bí mật (.env*, khóa riêng, keystore). Claude không được đọc hoặc ghi file này. Dùng .env.example với giá trị giả; con người tự tạo và điền .env.local rồi export biến môi trường trước khi chạy claude."
fi

case "$TOOL" in
  Write | Edit | NotebookEdit)
    CONTENT="$(get tool_input.content)
$(get tool_input.new_string)
$(get tool_input.new_source)"
    if printf '%s\n' "$CONTENT" | grep -Eq -- '-----BEGIN ([A-Z0-9]+ )*PRIVATE KEY-----'; then
      deny "Nội dung chứa khối PEM PRIVATE KEY. Không bao giờ ghi khóa riêng vào file trong repo."
    fi
    if printf '%s\n' "$CONTENT" | grep -Eiq -- '(private[_-]?key|priv[_-]?key|secret[_-]?key|mnemonic|seed[_-]?phrase)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?(0x)?[0-9a-f]{64}([^0-9a-f]|$)'; then
      deny "Nội dung gán một khóa riêng dạng hex 64 ký tự. Đọc khóa từ biến môi trường (vm.envUint(\"DEPLOYER_PRIVATE_KEY\") trong Foundry, process.env ở server), không hard-code. Trong test dùng makeAddrAndKey hoặc khóa nhỏ như 0xA11CE."
    fi
    if printf '%s\n' "$CONTENT" | grep -Eq -- 'sk-ant-[A-Za-z0-9_-]{20,}'; then
      deny "Nội dung chứa thứ trông như API key Anthropic. Chỉ đặt ANTHROPIC_API_KEY trong .env.local (không commit)."
    fi
    if printf '%s\n' "$CONTENT" | grep -Eq -- '(^|[^0-9])[0-9]{8,10}:[A-Za-z0-9_-]{35}([^A-Za-z0-9_-]|$)'; then
      deny "Nội dung chứa thứ trông như token bot Telegram. Chỉ đặt TELEGRAM_BOT_TOKEN trong .env.local (không commit)."
    fi
    ;;
esac

exit 0
