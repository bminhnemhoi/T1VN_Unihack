#!/usr/bin/env bash
# Kiểm thử các hook HụiSafe bằng JSON mẫu theo schema đầu vào của hook (stdin).
# Chạy từ gốc repo:  bash .claude/hooks/test-hooks.sh
# Không cần Foundry: phần sol-fmt-build dùng một "forge" giả đặt đầu PATH.
# Khóa/bí mật giả được sinh lúc chạy, nên file này không chứa chuỗi trông như khóa thật.
# shellcheck disable=SC2016  # cố ý dùng nháy đơn để giữ nguyên chữ $BIEN trong lệnh mẫu
set -u

HOOKS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

command -v jq >/dev/null 2>&1 || { echo "Cần jq để chạy bộ test (brew install jq / apt-get install jq)"; exit 1; }

HEX64="$(printf 'ab%.0s' $(seq 1 32))"                  # 64 ký tự hex giả
PEM_HDR="-----BEGIN $(printf 'PRIV')ATE KEY-----"      # dựng lúc chạy
ANT_KEY="sk-$(printf 'ant')-$(printf 'x%.0s' $(seq 1 30))"

bash_json() {
  jq -n --arg c "$1" '{session_id:"test", transcript_path:"/tmp/t.jsonl", cwd:"/repo",
    permission_mode:"default", hook_event_name:"PreToolUse", tool_name:"Bash",
    tool_input:{command:$c, description:"test"}, tool_use_id:"toolu_test"}'
}
file_json() { # $1 tool, $2 file_path, $3 content (Write) hoặc new_string (Edit)
  jq -n --arg t "$1" --arg f "$2" --arg c "${3:-}" '{session_id:"test", transcript_path:"/tmp/t.jsonl",
    cwd:"/repo", permission_mode:"default", hook_event_name:"PreToolUse", tool_name:$t,
    tool_input:(if $t == "Write" then {file_path:$f, content:$c}
                elif $t == "Edit" then {file_path:$f, old_string:"x", new_string:$c}
                else {file_path:$f} end), tool_use_id:"toolu_test"}'
}
post_json() { # $1 file_path
  jq -n --arg f "$1" '{session_id:"test", transcript_path:"/tmp/t.jsonl", cwd:"/repo",
    permission_mode:"default", hook_event_name:"PostToolUse", tool_name:"Edit",
    tool_input:{file_path:$f, old_string:"a", new_string:"b", replace_all:false},
    tool_response:{filePath:$f, success:true}, tool_use_id:"toolu_test"}'
}

check() { # $1 tên, $2 exit mong đợi, $3 hook, $4 json
  local got
  printf '%s' "$4" | "$HOOKS/$3" >"$TMP/out" 2>"$TMP/err"
  got=$?
  if [ "$got" -eq "$2" ]; then
    PASS=$((PASS + 1)); printf 'PASS  %-58s exit=%s\n' "$1" "$got"
  else
    FAIL=$((FAIL + 1)); printf 'FAIL  %-58s exit=%s (mong %s)\n' "$1" "$got" "$2"
    sed 's/^/      stderr: /' "$TMP/err" | head -3
  fi
}

echo "== guard-bash.sh =="
check "allow: forge build"                         0 guard-bash.sh "$(bash_json 'cd contracts && forge build')"
check "allow: forge test -vvv"                     0 guard-bash.sh "$(bash_json 'forge test -vvv')"
check "allow: deploy Fuji (alias fuji)"            0 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify')"
check "allow: deploy Fuji (\$FUJI_RPC_URL)"        0 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url "$FUJI_RPC_URL" --broadcast')"
check "allow: deploy nhiều dòng tới Fuji"          0 guard-bash.sh "$(bash_json $'forge script script/Deploy.s.sol \\\n  --rpc-url fuji \\\n  --broadcast')"
check "allow: cast call Fuji"                      0 guard-bash.sh "$(bash_json 'cast call 0x5425890298aed601595a70AB815c96711a31Bc65 "version()(string)" --rpc-url fuji')"
check "allow: cast send anvil local"               0 guard-bash.sh "$(bash_json 'cast send 0x0000000000000000000000000000000000000001 --value 1 --rpc-url http://127.0.0.1:8545')"
check "allow: lấy địa chỉ từ env (không in khóa)"  0 guard-bash.sh "$(bash_json 'cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY"')"
check "allow: ls .env.local"                       0 guard-bash.sh "$(bash_json 'ls -la .env.local')"
check "allow: cat .env.example"                    0 guard-bash.sh "$(bash_json 'cat .env.example')"
check "allow: commit nhắc tới .env.local"          0 guard-bash.sh "$(bash_json 'git commit -m "chore: ignore .env.local"')"
check "allow: grep process.env trong code"         0 guard-bash.sh "$(bash_json 'grep -rn "process.env" apps/web/lib')"
check "allow: pnpm --filter web dev"               0 guard-bash.sh "$(bash_json 'pnpm --filter web dev')"
check "allow: kiểm biến có/thiếu không in giá trị" 0 guard-bash.sh "$(bash_json 'for v in FUJI_RPC_URL DEPLOYER_PRIVATE_KEY; do [ -n "${!v:-}" ] && echo "$v: có" || echo "$v: THIẾU"; done')"
check "allow: quét file bí mật bị track"           0 guard-bash.sh "$(bash_json "git ls-files '*.env*' '*.pem' '*.key' '*keystore*'")"
check "allow: deploy local anvil"                  0 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast')"
check "block: test -n \$KHOA && echo (quá chặt, cố ý)" 2 guard-bash.sh "$(bash_json 'test -n "$DEPLOYER_PRIVATE_KEY" && echo set')"
check "block: RPC mainnet api.avax.network"        2 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url https://api.avax.network/ext/bc/C/rpc --broadcast')"
check "block: alias avalanche"                     2 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url avalanche --broadcast')"
check "block: --chain 43114"                       2 guard-bash.sh "$(bash_json 'cast send 0xabc "f()" --rpc-url fuji --chain 43114')"
check "block: mainnet nhiều dòng"                  2 guard-bash.sh "$(bash_json $'forge script script/Deploy.s.sol \\\n  --rpc-url https://api.avax.network/ext/bc/C/rpc \\\n  --broadcast')"
check "block: broadcast không chỉ RPC"             2 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --broadcast')"
check "block: cast send không chỉ RPC"             2 guard-bash.sh "$(bash_json 'cast send 0xabc "f()"')"
check "block: echo khóa riêng"                     2 guard-bash.sh "$(bash_json 'echo $DEPLOYER_PRIVATE_KEY')"
check "block: printf secret Privy"                 2 guard-bash.sh "$(bash_json 'printf "%s" "${PRIVY_APP_SECRET}"')"
check "block: printenv"                            2 guard-bash.sh "$(bash_json 'printenv')"
check "block: env | grep KEY"                      2 guard-bash.sh "$(bash_json 'env | grep KEY')"
check "block: cat .env.local"                      2 guard-bash.sh "$(bash_json 'cat .env.local')"
check "block: source .env.local"                   2 guard-bash.sh "$(bash_json 'set -a && source .env.local && set +a')"
check "block: cp .env.example .env.local"          2 guard-bash.sh "$(bash_json 'cp .env.example .env.local')"
check "block: cat keystore Foundry"                2 guard-bash.sh "$(bash_json 'cat ~/.foundry/keystores/deployer')"
check "block: khóa hex trên dòng lệnh"             2 guard-bash.sh "$(bash_json "cast send 0xabc \"f()\" --rpc-url fuji --private-key 0x$HEX64")"
check "block: cast wallet new"                     2 guard-bash.sh "$(bash_json 'cast wallet new')"
check "block: node đọc process.env khóa"           2 guard-bash.sh "$(bash_json 'node -e "console.log(process.env.DEPLOYER_PRIVATE_KEY)"')"
check "block: git add -f"                          2 guard-bash.sh "$(bash_json 'git add -f .env.local')"

echo "== guard-secret-files.sh =="
check "block: Write .env.local"                    2 guard-secret-files.sh "$(file_json Write /repo/.env.local 'X=1')"
check "block: Edit apps/web/.env.local"            2 guard-secret-files.sh "$(file_json Edit /repo/apps/web/.env.local 'X=1')"
check "block: Read contracts/.env"                 2 guard-secret-files.sh "$(file_json Read /repo/contracts/.env)"
check "block: Write deployer.pem"                  2 guard-secret-files.sh "$(file_json Write /repo/keys/deployer.pem 'abc')"
check "block: Read ~/.foundry/keystores/x"         2 guard-secret-files.sh "$(file_json Read /home/u/.foundry/keystores/deployer)"
check "block: ghi PRIVATE_KEY=0x<64hex> vào .ts"   2 guard-secret-files.sh "$(file_json Write /repo/apps/keeper/src/config.ts "const DEPLOYER_PRIVATE_KEY = \"0x$HEX64\";")"
check "block: ghi khối PEM vào .md"                2 guard-secret-files.sh "$(file_json Write /repo/notes.md "$PEM_HDR")"
check "block: ghi API key Anthropic"               2 guard-secret-files.sh "$(file_json Edit /repo/apps/web/lib/ai.ts "const k = \"$ANT_KEY\";")"
check "allow: Write .env.example (giá trị rỗng)"   0 guard-secret-files.sh "$(file_json Write /repo/.env.example 'DEPLOYER_PRIVATE_KEY=')"
check "allow: Edit HuiCircle.sol"                  0 guard-secret-files.sh "$(file_json Edit /repo/contracts/src/HuiCircle.sol 'uint256 public constant MAX_MEMBERS = 30;')"
check "allow: bytes32 hằng số 64 hex (không phải khóa)" 0 guard-secret-files.sh "$(file_json Write /repo/contracts/test/V.t.sol "bytes32 constant H = 0x$HEX64;")"
check "allow: Read apps/web/lib/env.ts"            0 guard-secret-files.sh "$(file_json Read /repo/apps/web/lib/env.ts)"

echo "== sol-fmt-build.sh (forge giả) =="
mkdir -p "$TMP/bin" "$TMP/proj/contracts/src" "$TMP/proj/contracts/test"
printf '[profile.default]\nsrc = "src"\n' > "$TMP/proj/contracts/foundry.toml"
printf 'contract A {}\n' > "$TMP/proj/contracts/src/A.sol"
printf 'contract ATest {}\n' > "$TMP/proj/contracts/test/A.t.sol"
printf 'x\n' > "$TMP/proj/README.md"
cat > "$TMP/bin/forge" <<'STUB'
#!/usr/bin/env bash
echo "forge $*" >> "$FORGE_LOG"
case "$1" in
  fmt) grep -q SYNTAX_ERROR "$2" && { echo "Error: failed to parse $2"; exit 1; }; exit 0 ;;
  build) [ "${STUB_BUILD_RC:-0}" -eq 0 ] && exit 0; echo "Error (2314): Expected ';' but got '}'"; exit 1 ;;
esac
STUB
chmod +x "$TMP/bin/forge"
export FORGE_LOG="$TMP/forge.log"

PATH="$TMP/bin:$PATH" check "bỏ qua file không phải .sol"  0 sol-fmt-build.sh "$(post_json "$TMP/proj/README.md")"
[ -s "$TMP/out" ] && { FAIL=$((FAIL + 1)); echo "FAIL  có output với file không phải .sol"; }
: > "$FORGE_LOG"
PATH="$TMP/bin:$PATH" STUB_BUILD_RC=0 check "src/A.sol build OK: im lặng" 0 sol-fmt-build.sh "$(post_json "$TMP/proj/contracts/src/A.sol")"
if [ ! -s "$TMP/out" ] && grep -q 'forge build --skip test' "$FORGE_LOG"; then
  PASS=$((PASS + 1)); echo "PASS  src/: không output, đã gọi 'forge build --skip test'"
else
  FAIL=$((FAIL + 1)); echo "FAIL  src/: output hoặc lệnh build không như mong đợi"; cat "$FORGE_LOG"
fi
: > "$FORGE_LOG"
PATH="$TMP/bin:$PATH" STUB_BUILD_RC=1 check "test/A.t.sol build lỗi: exit 0" 0 sol-fmt-build.sh "$(post_json "$TMP/proj/contracts/test/A.t.sol")"
if jq -e '.hookSpecificOutput.hookEventName == "PostToolUse" and (.hookSpecificOutput.additionalContext | test("forge build")) and (.systemMessage | length > 0)' "$TMP/out" >/dev/null 2>&1 \
   && grep -qx 'forge build' "$FORGE_LOG"; then
  PASS=$((PASS + 1)); echo "PASS  test/: JSON additionalContext hợp lệ, build đầy đủ"
else
  FAIL=$((FAIL + 1)); echo "FAIL  test/: JSON hoặc lệnh build không như mong đợi"; cat "$TMP/out" "$FORGE_LOG"
fi
printf 'contract B { SYNTAX_ERROR }\n' > "$TMP/proj/contracts/src/B.sol"
PATH="$TMP/bin:$PATH" STUB_BUILD_RC=0 check "fmt lỗi cú pháp: exit 0 + JSON" 0 sol-fmt-build.sh "$(post_json "$TMP/proj/contracts/src/B.sol")"
if jq -e '.hookSpecificOutput.additionalContext | test("forge fmt")' "$TMP/out" >/dev/null 2>&1; then
  PASS=$((PASS + 1)); echo "PASS  fmt lỗi được báo qua additionalContext"
else
  FAIL=$((FAIL + 1)); echo "FAIL  fmt lỗi không được báo"; cat "$TMP/out"
fi

echo "== session-start.sh =="
ss() { HUISAFE_TODAY="$1" CLAUDE_PROJECT_DIR="$TMP/proj" "$HOOKS/session-start.sh" <<<'{"hook_event_name":"SessionStart","source":"startup"}' 2>&1; }
for case_ in "20261106|M0 Setup" "20261111|M2 Fuji + SDK" "20261112|M3 MVP E2E" "20261120|M7 Nộp" "20261121|Ngày dự phòng" "20261125|Đã qua hạn"; do
  d="${case_%%|*}"; want="${case_#*|}"
  if ss "$d" | grep -q "$want" && ss "$d" | grep -q 'LUẬT CỨNG'; then
    PASS=$((PASS + 1)); printf 'PASS  %-58s\n' "ngày $d -> $want"
  else
    FAIL=$((FAIL + 1)); printf 'FAIL  %-58s\n' "ngày $d -> $want"; ss "$d" | head -3
  fi
done

echo
echo "Tổng: $PASS PASS, $FAIL FAIL"
[ "$FAIL" -eq 0 ]
