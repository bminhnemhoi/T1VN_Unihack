#!/usr/bin/env bash
# HụiSafe - SessionStart hook (startup|resume|clear|compact).
# In ra mốc hiện tại (theo lịch chốt trong docs/11-ke-hoach-trien-khai.md) và luật cứng.
# Với SessionStart, stdout dạng văn bản được Claude Code thêm vào ngữ cảnh của Claude.
# Đặt HUISAFE_TODAY=YYYYMMDD để thử với ngày khác.
set -uo pipefail
cat >/dev/null 2>&1 || true   # bỏ qua JSON đầu vào

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TODAY="${HUISAFE_TODAY:-$(TZ=Asia/Ho_Chi_Minh date +%Y%m%d)}"

# Lịch chốt (mốc|hạn YYYYMMDD|định nghĩa xong). Đổi lịch thì sửa cả docs/11 và danh sách này.
MILESTONES='M0 Setup|20261107|Repo khung, CLAUDE.md + .claude, ví Fuji có AVAX + USDC testnet, Builder Pass cả đội
M1 Contract lõi|20261110|FIXED + BIDDING, pull/thác bù/holdback/ký quỹ/quỹ dự phòng; unit + fuzz xanh
M2 Fuji + SDK|20261111|Deploy + verify trên Fuji, ABI vào sdk; invariant xanh; workshop 20:00
M3 MVP E2E|20261114|Tạo dây, vào dây, thăm, chi, bù vỡ nợ chạy trên Fuji qua web; relayer + keeper
M4 AI + thử thật|20261116|Trợ lý chủ hụi, mô phỏng xong; 5-10 người dùng thật thử trên Fuji
M5 Đóng băng tính năng|20261117|Chỉ sửa lỗi; Slither sạch mức cao; workshop 20:00
M6 Tài liệu + pitch|20261119|README, slide, kịch bản, video v1; office hours 19/11
M7 Nộp|20261120|Video cuối, nộp trước 22:00; 21/11 dự phòng, kiểm link bằng tab ẩn danh'

CURRENT=""
while IFS='|' read -r name due def; do
  [ -z "$name" ] && continue
  if [ "$TODAY" -le "$due" ]; then
    CURRENT="$name|$due|$def"
    break
  fi
done <<EOF
$MILESTONES
EOF

fmt_date() { printf '%s/%s/%s' "${1:6:2}" "${1:4:2}" "${1:0:4}"; }

echo "HụiSafe - hôm nay $(fmt_date "$TODAY") (giờ VN)."
if [ -n "$CURRENT" ]; then
  name="${CURRENT%%|*}"
  rest="${CURRENT#*|}"
  due="${rest%%|*}"
  def="${rest#*|}"
  left=""
  if [ "${TODAY:0:6}" = "${due:0:6}" ]; then
    left=", còn $((10#${due:6:2} - 10#${TODAY:6:2})) ngày"
  fi
  echo "Mốc hiện tại: ${name} (hạn $(fmt_date "$due")${left}). Định nghĩa xong: ${def}."
  code="${name%% *}"
  PLAN="$ROOT/docs/11-ke-hoach-trien-khai.md"
  if [ -f "$PLAN" ]; then
    line="$(grep -m1 -E "(^|[^A-Za-z0-9])${code}([^0-9]|$)" "$PLAN" 2>/dev/null | cut -c1-200)"
    [ -n "$line" ] && echo "docs/11: ${line}"
    # Dòng của hôm nay trong bảng "Kế hoạch từng ngày" (dạng "| T5 12/11 | ...").
    day="$(grep -m1 -E "^\| *(T[2-7]|CN) ${TODAY:6:2}/${TODAY:4:2}([^0-9]|$)" "$PLAN" 2>/dev/null | cut -c1-240)"
    [ -n "$day" ] && echo "Việc hôm nay (docs/11 mục 3, cột P1 | P2 | P3): ${day}"
  fi
elif [ "$TODAY" -le 20261121 ]; then
  echo "Ngày dự phòng 21/11: hạn nộp UniHack 23:59 hôm nay. Chỉ sửa lỗi chặn demo, kiểm link bằng tab ẩn danh."
else
  echo "Đã qua hạn nộp UniHack (23:59 21/11/2026). Chung kết: công bố 23/11, Demo Day 30/11."
fi

BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
[ -n "$BRANCH" ] && echo "Nhánh git: ${BRANCH}."

cat <<'EOF'
LUẬT CỨNG (chi tiết trong CLAUDE.md):
1. Chỉ Avalanche Fuji (chainId 43113). Không bao giờ broadcast lên mainnet.
2. Không đọc, ghi, in hay commit bí mật (.env*, khóa riêng, keystore, API key).
3. Không có yếu tố ngẫu nhiên trong sản phẩm. Không dữ liệu cá nhân on-chain.
4. LLM không ký, không chuyển tiền. Admin không có hàm rút tiền người dùng.
5. Mọi luồng tiền phải có test (unit + fuzz + invariant) trước khi merge.
Quy trình: plan mode -> implement -> test -> subagent security-auditor -> commit.
EOF
exit 0
