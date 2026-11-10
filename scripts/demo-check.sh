#!/usr/bin/env bash
# demo-check: read-only readiness table for the HuiSafe deployment on Fuji (chain 43113).
#
#   bash scripts/demo-check.sh            # table, exit 0 when nothing FAILs
#
# Reads only: `cast call`, `cast balance`, `cast code`, `cast block`, and curl to the Routescan explorer API. It sends no
# transaction and needs no private key. Addresses come from contracts/deployments/fuji.json; the organizer, the
# members, the deployer (registry admin) are derived from the chain. Optional public variables improve the check
# (names only, values are public addresses): FUJI_RPC_URL, KEEPER_ADDRESS, ORGANIZER_ADDRESS, M1_ADDRESS..M5_ADDRESS,
# SAFE_OWNER_1..3. Statuses: PASS, FAIL, INFO (shown, not judged), CHECK (needs a human, e.g. the keeper address is unknown).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY="${DEPLOYMENTS_FILE:-$ROOT/contracts/deployments/fuji.json}"
RPC="${FUJI_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}"
FUJI_USDC="0x5425890298aed601595a70AB815c96711a31Bc65"
EXPLORER="https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api"
export PATH="$HOME/.foundry/bin:$PATH"

command -v cast >/dev/null || { echo "cast (Foundry) not found"; exit 2; }
command -v jq >/dev/null || { echo "jq not found"; exit 2; }
[ -f "$DEPLOY" ] || { echo "missing $DEPLOY"; exit 2; }
case "$RPC" in *avax.network*) case "$RPC" in *avax-test.network*) ;; *) echo "RPC looks like mainnet, refusing"; exit 2;; esac;; esac

FAILS=0
row() { # name status evidence
  printf '| %s | %s | %s\n' "$1" "$2" "$3"
  [ "$2" = "FAIL" ] && FAILS=$((FAILS + 1))
  return 0
}
j() { jq -r ".$1 // empty" "$DEPLOY"; }
call() { cast call "$@" --rpc-url "$RPC" 2>/dev/null | awk '{print $1}'; }
callraw() { cast call "$@" --rpc-url "$RPC" 2>/dev/null; }
lc() { printf '%s' "$1" | tr 'A-F' 'a-f'; }
avax() { cast balance "$1" --rpc-url "$RPC" --ether 2>/dev/null; }
usdc() { # human USDC with 6 decimals
  local raw; raw="$(call "$FUJI_USDC" "balanceOf(address)(uint256)" "$1")"
  [ -n "$raw" ] && awk -v r="$raw" 'BEGIN { printf "%.6f", r / 1000000 }'
}
ge() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a + 0 >= b + 0) }'; }

FACTORY="$(j factory)"; REGISTRY="$(j reputation)"; FORWARDER="$(j forwarder)"; LENS="$(j circleLens)"
IMPL="$(j circleImplementation)"; ADMIN="$(j admin)"; ATTESTER="$(j attester)"; RELAYER="$(j relayer)"; USDC_JSON="$(j usdc)"

echo "HuiSafe demo-check  $(date -u +%Y-%m-%dT%H:%M:%SZ)  rpc=$RPC"
echo "| Hạng mục | Kết quả | Bằng chứng"
echo "|---|---|---"

# 1. network ------------------------------------------------------------------------------------------------------
CHAIN="$(cast chain-id --rpc-url "$RPC" 2>/dev/null)"
if [ "$CHAIN" = "43113" ]; then row "Mạng: chain id" PASS "43113"; else row "Mạng: chain id" FAIL "got '${CHAIN:-no answer}', want 43113"; fi
BTS="$(cast block latest --field timestamp --rpc-url "$RPC" 2>/dev/null)"
NOW="$(date +%s)"
if [ -n "$BTS" ] && [ $((NOW - BTS)) -lt 120 ]; then row "Mạng: block mới nhất còn tươi" PASS "$((NOW - BTS)) s trước"; else row "Mạng: block mới nhất còn tươi" FAIL "timestamp '${BTS:-?}'"; fi
if [ "$(lc "$USDC_JSON")" = "$(lc "$FUJI_USDC")" ]; then row "fuji.json: USDC là USDC Circle" PASS "$USDC_JSON"; else row "fuji.json: USDC là USDC Circle" FAIL "$USDC_JSON"; fi
VER="$(cast call "$FUJI_USDC" "version()(string)" --rpc-url "$RPC" 2>/dev/null | tr -d '"')"
if [ "$VER" = "2" ]; then row "USDC version() (permit EIP-2612)" PASS "\"2\""; else row "USDC version() (permit EIP-2612)" FAIL "'${VER:-?}'"; fi

# 2. contracts: code + verified ----------------------------------------------------------------------------------
for pair in "forwarder:$FORWARDER" "reputation:$REGISTRY" "circleLens:$LENS" "circleImplementation:$IMPL" "factory:$FACTORY" "admin(Safe):$ADMIN"; do
  name="${pair%%:*}"; addr="${pair#*:}"
  code="$(cast code "$addr" --rpc-url "$RPC" 2>/dev/null)"
  if [ -n "$code" ] && [ "$code" != "0x" ]; then c=PASS; else c=FAIL; fi
  if [ "$name" = "admin(Safe)" ]; then
    row "Có code: $name" "$c" "$addr (Safe proxy; mã nguồn do Safe xác minh)"
    continue
  fi
  src="$(curl -s -m 20 "$EXPLORER?module=contract&action=getsourcecode&address=$addr" 2>/dev/null | jq -r '.result[0].SourceCode // empty' 2>/dev/null | head -c 20)"
  if [ "$c" = "FAIL" ]; then v="-"; elif [ -n "$src" ]; then v="verified"; elif [ -z "$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$EXPLORER" 2>/dev/null | grep -E '^(2|4)')" ]; then v="explorer không trả lời"; else v="CHƯA verify"; fi
  case "$v" in
    verified) row "Có code + verify: $name" "$c" "$addr verified (Routescan)";;
    "explorer không trả lời") row "Có code + verify: $name" CHECK "$addr, $v: mở https://testnet.snowtrace.io/address/$addr";;
    "-") row "Có code + verify: $name" FAIL "$addr không có code";;
    *) row "Có code + verify: $name" FAIL "$addr $v";;
  esac
done

# 3. admin = Safe, roles --------------------------------------------------------------------------------------------
FADMIN="$(call "$FACTORY" "admin()(address)")"
DEPLOYER="$(call "$REGISTRY" "admin()(address)")"
if [ -n "$FADMIN" ] && [ "$(lc "$FADMIN")" = "$(lc "$ADMIN")" ]; then row "factory.admin() == admin trong fuji.json" PASS "$FADMIN"; else row "factory.admin() == admin trong fuji.json" FAIL "chain '$FADMIN' vs file '$ADMIN'"; fi
if [ -n "$FADMIN" ] && [ "$(lc "$FADMIN")" != "$(lc "$DEPLOYER")" ]; then row "factory.admin() là Safe, không phải deployer" PASS "deployer $DEPLOYER"; else row "factory.admin() là Safe, không phải deployer" FAIL "admin $FADMIN, deployer $DEPLOYER"; fi
TH="$(call "$FADMIN" "getThreshold()(uint256)")"
if [ "$TH" = "2" ]; then row "Safe: ngưỡng chữ ký" PASS "2"; else row "Safe: ngưỡng chữ ký" FAIL "'${TH:-?}'"; fi
OWNERS="$(callraw "$FADMIN" "getOwners()(address[])" | tr -d '[] ' | tr ',' ' ')"
NOWN="$(printf '%s\n' $OWNERS | grep -c '^0x')"
if [ "$NOWN" = "3" ]; then row "Safe: số chủ" PASS "3: $OWNERS"; else row "Safe: số chủ" FAIL "$NOWN: $OWNERS"; fi
if [ -n "${SAFE_OWNER_1:-}${SAFE_OWNER_2:-}${SAFE_OWNER_3:-}" ]; then
  ok=1
  for o in "${SAFE_OWNER_1:-}" "${SAFE_OWNER_2:-}" "${SAFE_OWNER_3:-}"; do
    printf '%s\n' $OWNERS | tr 'A-F' 'a-f' | grep -qx "$(lc "$o")" || ok=0
  done
  if [ "$ok" = 1 ]; then row "Safe: đúng ba chủ đã chốt (SAFE_OWNER_1..3)" PASS "khớp"; else row "Safe: đúng ba chủ đã chốt (SAFE_OWNER_1..3)" FAIL "lệch"; fi
else
  row "Safe: đúng ba chủ đã chốt (SAFE_OWNER_1..3)" CHECK "đặt SAFE_OWNER_1..3 (địa chỉ công khai, docs/DEPLOY-FUJI.md mục 2) để so"
fi
if [ "$(lc "$(call "$REGISTRY" "factory()(address)")")" = "$(lc "$FACTORY")" ]; then row "registry.factory() == factory" PASS "$FACTORY"; else row "registry.factory() == factory" FAIL "lệch"; fi

CFG="$(callraw "$FACTORY" "config()((address,address,address,address,uint16,uint16,uint16,uint16,uint16,uint8,uint8,uint96))" | tr -d '()' | sed 's/\[[^]]*\]//g' | tr -d ' ')"
IFS=',' read -r C_USDC C_FWD C_REG C_ATT C_CAP C_LATE C_MINCOV C_FEE C_RES C_MIN C_MAX C_MAXC <<<"$CFG"
if [ "${C_MINCOV:-}" = "10000" ]; then row "config.minCoverageBps (ADR-22)" PASS "10000"; else row "config.minCoverageBps (ADR-22)" FAIL "'${C_MINCOV:-?}'"; fi
if [ "$(lc "${C_ATT:-}")" = "$(lc "$ATTESTER")" ]; then row "config.attester == attester trong fuji.json" PASS "$C_ATT"; else row "config.attester == attester trong fuji.json" FAIL "chain '${C_ATT:-?}'"; fi
if [ "$(lc "${C_FWD:-}")" = "$(lc "$FORWARDER")" ] && [ "$(lc "${C_REG:-}")" = "$(lc "$REGISTRY")" ] && [ "$(lc "${C_USDC:-}")" = "$(lc "$FUJI_USDC")" ]; then row "config: forwarder, registry, USDC khớp fuji.json" PASS "khớp"; else row "config: forwarder, registry, USDC khớp fuji.json" FAIL "lệch"; fi
IMPLFWD="$(call "$IMPL" "trustedForwarder()(address)")"
if [ "$(lc "$IMPLFWD")" = "$(lc "$FORWARDER")" ]; then row "implementation.trustedForwarder() == forwarder" PASS "$IMPLFWD"; else row "implementation.trustedForwarder() == forwarder" FAIL "'$IMPLFWD'"; fi

# 4. AVAX ---------------------------------------------------------------------------------------------------------
check_avax() { # label addr warn-below fail-below
  local b; b="$(avax "$2")"
  if [ -z "$b" ]; then row "AVAX $1" FAIL "không đọc được $2"
  elif ! ge "$b" "$4"; then row "AVAX $1 (dưới $4 là hết gas)" FAIL "$b ($2)"
  elif ! ge "$b" "$3"; then row "AVAX $1 (nên >= $3)" CHECK "$b ($2): sắp thiếu, nạp thêm"
  else row "AVAX $1 >= $3" PASS "$b ($2)"; fi
}
check_avax "relayer" "$RELAYER" 0.02 0.005   # relay cảnh báo dưới 0,02 và dừng gửi dưới 0,005
[ -n "$DEPLOYER" ] && check_avax "deployer" "$DEPLOYER" 0.004 0.001
if [ -n "${KEEPER_ADDRESS:-}" ]; then check_avax "keeper" "$KEEPER_ADDRESS" 0.004 0.001; else row "AVAX keeper" CHECK "đặt KEEPER_ADDRESS (không có trên chuỗi)"; fi

# 5. demo circles, organizer, members ---------------------------------------------------------------------------
ALL="$(callraw "$FACTORY" "allCircles()(address[])" | tr -d '[] ' | tr ',' ' ')"
ORGS="${ORGANIZER_ADDRESS:-}"
MEMBERS=""
for c in $ALL; do
  o="$(call "$c" "organizer()(address)")"
  [ -n "$o" ] && ORGS="$ORGS $o"
  MEMBERS="$MEMBERS $(callraw "$c" "members()(address[])" | tr -d '[] ' | tr ',' ' ')"
done
for v in "${M1_ADDRESS:-}" "${M2_ADDRESS:-}" "${M3_ADDRESS:-}" "${M4_ADDRESS:-}" "${M5_ADDRESS:-}"; do MEMBERS="$MEMBERS $v"; done
ORGS="$(printf '%s\n' $ORGS | grep '^0x' | tr 'A-F' 'a-f' | sort -u)"
MEMBERS="$(printf '%s\n' $MEMBERS | grep '^0x' | tr 'A-F' 'a-f' | sort -u)"

for o in $ORGS; do
  check_avax "organizer" "$o" 0.004 0.001
  row "USDC organizer ($o)" INFO "$(usdc "$o") USDC"
done
if [ -z "$MEMBERS" ]; then row "USDC thành viên demo" CHECK "chưa có ai vào dây; đặt M1_ADDRESS..M5_ADDRESS"; fi
for m in $MEMBERS; do
  b="$(usdc "$m")"
  if [ -z "$b" ]; then row "USDC thành viên $m" FAIL "không đọc được"; elif ge "$b" 10; then row "USDC thành viên $m >= 10" PASS "$b USDC"; else row "USDC thành viên $m >= 10" FAIL "$b USDC (không đủ góp một kỳ)"; fi
done

STATES=(Forming Active Paused Completed Cancelled Unwound)
n=0
for c in $ALL; do
  n=$((n + 1))
  st="$(call "$c" "state()(uint8)")"
  cov="$(call "$c" "coverageIndexBps()(uint256)")"
  cur="$(call "$c" "currentRound()(uint32)")"
  nm="$(callraw "$c" "members()(address[])" | tr -d '[] ' | tr ',' '\n' | grep -c '^0x')"
  bond="$(call "$c" "bondRemaining()(uint256)")"
  P="$(callraw "$c" "params()((uint8,uint8,uint96,uint32,uint32,uint32,uint32,uint32,uint16,bool,uint16,uint16,uint16,uint16,uint64,bool,bytes32,uint16,bytes32))" | tr -d '()' | sed 's/\[[^]]*\]//g' | tr -d ' ')"
  IFS=',' read -r P_MODE P_N P_REST <<<"$P"
  mode=$([ "$P_MODE" = "0" ] && echo Fixed || echo Bidding)
  name="${STATES[${st:-0}]:-?}"
  ev="$c  $mode N=$P_N  $name  vòng $cur  thành viên $nm/$P_N  ký quỹ còn $(awk -v r="${bond:-0}" 'BEGIN{printf "%.2f", r/1000000}') USDC  CI ${cov:-?}"
  if [ "${cov:-}" = "10000" ] || [ "$name" = "Completed" ] || [ "$name" = "Cancelled" ]; then row "Dây demo #$n" PASS "$ev"; else row "Dây demo #$n" FAIL "$ev (CI khác 10000)"; fi
  if [ "$name" = "Active" ]; then
    dl="$(call "$c" "deadline(uint32)(uint64)" "$cur")"
    settled="$(call "$c" "settledRounds()(uint32)")"
    late=$((NOW - ${dl:-$NOW}))
    if [ "$late" -gt 120 ]; then row "Keeper: dây #$n chi kỳ $cur đúng hạn" FAIL "quá hạn ${late}s, đã chi $settled kỳ: keeper có chạy không?"; else row "Keeper: dây #$n chi kỳ $cur đúng hạn" PASS "hạn còn $((-late))s / quá $((late))s, đã chi $settled kỳ"; fi
  elif [ "$name" = "Forming" ]; then
    jd="$(echo "$P_REST" | awk -F, '{print $13}')"
    if [ -n "$jd" ] && [ "$jd" -gt "$NOW" ] 2>/dev/null; then row "Dây #$n còn hạn vào dây" PASS "joinDeadline còn $((jd - NOW))s"; elif [ -n "$jd" ]; then row "Dây #$n còn hạn vào dây" FAIL "joinDeadline đã qua $((NOW - jd))s: chỉ còn cancel"; fi
  fi
done
[ "$n" = 0 ] && row "Dây demo" CHECK "factory chưa có dây nào"

echo
if [ "$FAILS" -eq 0 ]; then echo "KẾT QUẢ: không có FAIL."; else echo "KẾT QUẢ: $FAILS FAIL."; fi
[ "$FAILS" -eq 0 ]
