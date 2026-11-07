#!/usr/bin/env bash
# HụiSafe - PreToolUse hook cho Bash.
# Chặn (exit 2, lý do ở stderr được gửi lại cho Claude):
#   A. Lệnh on-chain (forge/cast/anvil/chisel) trỏ tới mainnet: RPC api.avax.network
#      (Fuji là api.avax-test.network), chain 43114, alias avalanche/mainnet, Ethereum mainnet.
#   B. Lệnh broadcast (forge script --broadcast/--resume, forge create, cast send/publish/mktx,
#      eth_sendRawTransaction) không chỉ rõ RPC Fuji (--rpc-url fuji, $FUJI_RPC_URL,
#      api.avax-test.network) hoặc anvil local (localhost/127.0.0.1).
#   C. Lệnh làm lộ bí mật: printenv, env/export/set trần, echo/printf/curl... với biến *_PRIVATE_KEY,
#      *SECRET*, *API_KEY*, *BOT_TOKEN*, MNEMONIC; process.env/os.environ đọc biến bí mật;
#      khóa hex 64 ký tự hoặc --mnemonic trên dòng lệnh; cast wallet private-key/decrypt-keystore/new;
#      đọc/chép/source file .env* (trừ .env.example), *.pem, *.key, keystore; git add -f.
# Đây là lớp phòng thủ theo mẫu chữ (best-effort), không phải ranh giới bảo mật tuyệt đối.
# Tương thích bash 3.2 (macOS) và bash 5.x. Cần jq (dự phòng: python3).
set -uo pipefail

INPUT="$(cat)"

# Thiếu cả jq lẫn python3 thì không kiểm tra được: chặn (fail closed). Kiểm ở cấp trên cùng,
# vì exit bên trong $(...) chỉ thoát subshell.
if ! command -v jq >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo "HuiSafe guard: cần jq (hoặc python3) để kiểm tra an toàn. Cài jq rồi thử lại." >&2
  exit 2
fi

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

deny() {
  printf 'HuiSafe guard (bash): %s\n' "$1" >&2
  exit 2
}

has() { printf '%s\n' "$NQ" | grep -Eq -- "$1"; }

CMD="$(get tool_input.command)"
[ -z "$CMD" ] && exit 0

# Gộp dòng, hạ chữ thường, bỏ dấu nháy để mẫu đơn giản và khó lách bằng cách xuống dòng/nháy.
NQ="$(printf '%s' "$CMD" | tr '\n\r\t' '   ' | tr '[:upper:]' '[:lower:]' | tr -d "\"'")"

SEP='(^|[;&|(`[:space:]])'

# ---------- A. Mainnet ----------
re_onchain="${SEP}(forge|cast|anvil|chisel)([[:space:]]|$)"
re_mainnet_url='api\.avax\.network|avalanche-mainnet|avax-mainnet|avalanche-c-chain-rpc|rpc\.ankr\.com/avalanche([^_a-z]|$)|mainnet\.infura\.io|eth-mainnet|cloudflare-eth\.com|(^|[^0-9])43114([^0-9]|$)'
re_mainnet_alias='(--rpc-url|--fork-url)[=[:space:]]+(avalanche|avax|mainnet|ethereum|c-chain)([^a-z0-9_-]|$)'
re_chain_mainnet='--chain(-id)?[=[:space:]]+(avalanche|avax|mainnet|ethereum|1|43114)([^a-z0-9_-]|$)'

if has "$re_onchain" && { has "$re_mainnet_url" || has "$re_mainnet_alias" || has "$re_chain_mainnet"; }; then
  deny "Lệnh on-chain trỏ tới mainnet (chain 43114 / api.avax.network / alias mainnet). HụiSafe chỉ chạy trên Avalanche Fuji (43113). Dùng --rpc-url fuji (alias trong contracts/foundry.toml) hoặc \$FUJI_RPC_URL."
fi

# ---------- B. Broadcast phải chỉ rõ Fuji hoặc anvil local ----------
re_broadcast='forge[[:space:]]+script([[:space:]].*)?[[:space:]]--(broadcast|resume)([[:space:]=]|$)|forge[[:space:]]+create([[:space:]]|$)|cast[[:space:]]+(send|publish|mktx)([[:space:]]|$)|cast[[:space:]]+rpc[[:space:]]+eth_send|eth_sendrawtransaction|eth_sendtransaction'
re_fuji_or_local='(--rpc-url|--fork-url|-r)[=[:space:]]+(fuji|\$\{?fuji_rpc_url\}?|https?://api\.avax-test\.network|https?://(localhost|127\.0\.0\.1))|api\.avax-test\.network|localhost:8545|127\.0\.0\.1:8545'

if has "$re_broadcast" && ! has "$re_fuji_or_local"; then
  deny "Lệnh broadcast phải chỉ rõ RPC Fuji: --rpc-url fuji (hoặc --rpc-url \"\$FUJI_RPC_URL\"), hoặc anvil local (http://127.0.0.1:8545). Không dựa vào ETH_RPC_URL hay RPC mặc định."
fi

# ---------- C. Lộ bí mật ----------
re_printenv="${SEP}printenv([[:space:];&|)>]|$)"
re_dump_env='(^|[;&|(`])[[:space:]]*(env|export|set|export[[:space:]]+-p|declare[[:space:]]+-[px]+)[[:space:]]*($|[;&|)>])'
re_secret_var='\$\{?[a-z0-9_]*(private_key|privatekey|secret|mnemonic|seed_phrase|api_key|apikey|bot_token)[a-z0-9_]*'
re_printer="${SEP}(echo|printf|print|cat|tee|logger|curl|wget|nc|ncat|xargs|python3?|node|perl|ruby)([[:space:]]|$)"
re_env_access='(process\.env|os\.environ|os\.getenv|getenv)[^;&|]*(private_key|secret|mnemonic|api_key|bot_token)'
re_literal_key='(--private-keys?|private_key=|privatekey=)[=[:space:]]*(0x)?[0-9a-f]{64}([^0-9a-f]|$)'
re_mnemonic_flag='--mnemonic([=[:space:]]|$)'
re_cast_wallet='cast[[:space:]]+wallet[[:space:]]+(private-key|decrypt-keystore|new|new-mnemonic|derive)([[:space:]]|$)'

if has "$re_printenv" || has "$re_dump_env"; then
  deny "Không in toàn bộ biến môi trường (printenv/env/export/set): có thể lộ DEPLOYER_PRIVATE_KEY, PRIVY_APP_SECRET, ANTHROPIC_API_KEY. Kiểm tra biến có hay chưa mà không in giá trị: for v in TEN_BIEN_1 TEN_BIEN_2; do [ -n \"\${!v:-}\" ] && echo \"\$v: có\" || echo \"\$v: THIẾU\"; done"
fi
if has "$re_secret_var" && has "$re_printer"; then
  deny "Lệnh vừa tham chiếu biến bí mật (*_PRIVATE_KEY, *SECRET*, *API_KEY*, *BOT_TOKEN*, MNEMONIC) vừa có lệnh in/gửi (echo, printf, cat, tee, curl, node, python...). Không in hay gửi bí mật. Trong Foundry đọc khóa bằng vm.envUint trong script."
fi
if has "$re_env_access"; then
  deny "Script nội tuyến đọc biến bí mật (process.env/os.environ). Không làm vậy trong lệnh Bash; logic đọc bí mật chỉ nằm trong code server đã review."
fi
if has "$re_literal_key" || has "$re_mnemonic_flag"; then
  deny "Không đưa khóa riêng hay mnemonic trực tiếp lên dòng lệnh. Dùng biến môi trường (đã export từ trước) hoặc keystore (--account)."
fi
if has "$re_cast_wallet"; then
  deny "cast wallet private-key/decrypt-keystore/new/new-mnemonic/derive in ra khóa riêng. Con người tự tạo/quản lý ví testnet ngoài phiên Claude."
fi

# File bí mật: chỉ chặn khi có thao tác đọc/chép/ghi/nạp file (tránh chặn nhầm commit message).
NQX="$(printf '%s' "$NQ" | sed -E 's/\.env\.(example|sample|template)//g')"
re_env_file='(^|[^a-z0-9_])\.env([^a-z0-9_]|$)'
re_key_file='\.(pem|key|p12|pfx|jks|keystore)([^a-z0-9_]|$)|(^|[^a-z0-9_])id_(rsa|ecdsa|ed25519|dsa)([^.a-z0-9_]|$)|\.foundry/keystores|(^|[/[:space:]])keystores?(/|[[:space:]]|$)|(^|[/[:space:]])utc--'
re_file_access="${SEP}(cat|bat|less|more|head|tail|nl|tac|grep|egrep|fgrep|rg|ag|sed|awk|cut|sort|uniq|strings|xxd|od|hexdump|base64|openssl|gpg|cp|mv|rsync|scp|tar|zip|7z|source|\.|tee|vi|vim|nano|emacs|code|open|curl|wget|dotenv|diff|cmp|python3?|node|perl|ruby|php|git[[:space:]]+(add|show|diff))([[:space:]]|$)|[<>]"

if { printf '%s\n' "$NQX" | grep -Eq -- "$re_env_file" || printf '%s\n' "$NQX" | grep -Eq -- "$re_key_file"; } && has "$re_file_access"; then
  deny "Lệnh đọc/chép/ghi/nạp file bí mật (.env*, *.pem, *.key, keystore). Claude không chạm vào các file này; con người tự 'set -a; source .env.local; set +a' trước khi mở claude. Được phép: ls/test -f để kiểm tra tồn tại, cat .env.example."
fi

re_git_add_force='git[[:space:]]+add([[:space:]][^;&|]*)?[[:space:]](-f|--force)([[:space:]]|$)'
if has "$re_git_add_force"; then
  deny "Không dùng git add -f/--force: file bị .gitignore (ví dụ .env.local, keystore) không được đưa vào repo."
fi

exit 0
