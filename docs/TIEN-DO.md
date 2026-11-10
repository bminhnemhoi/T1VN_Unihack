# Tiến độ HụiSafe

Cập nhật: 10/11/2026 (Towfienes). Báo cáo gửi leader: `docs/BAO-CAO-LEADER-09-11.md`. Ai xong một việc đáng kể thì sửa phần TÓM TẮT trong cùng PR (giữ dưới 15 dòng).

<!-- TOM-TAT -->
- M0 Setup: XONG. M1 Contract lõi: XONG 08/11. Gói v1.2 (A13) XONG và đã gộp main 10/11: hoa hồng nằm trong trần lãi (φ), quỹ dự phòng chia theo đúng hạn, chân chủ hụi không thu hoa hồng, termsHash, trả hoa hồng ngay kỳ sạch. 586 forge test (54 invariant), audit 0 Critical/High/Medium, Slither high 0, HuiCircle 23.128 B.
- M2 Fuji + SDK (hạn 11/11): code xong, quy trình `docs/DEPLOY-FUJI.md` (minCoverage 10000). Ví testnet đủ AVAX + 800 USDC (`.handover/FAUCET.md`). Chờ: app Privy, khóa, Safe (hoặc ví deployer tạm).
- M3 MVP E2E (hạn 14/11): S01-S16 nối chain (B9); B10 (sàn bảo chứng từ chain, khóa bỏ thăm sai, tạm dừng, Privy nạp lười 640 -> 253 kB) và B11 (sổ hụi in được + route JSON, axe a11y 0 lỗi, banner demo, chữ tiếng Việt) đã gộp main, giao diện CHỜ Towfienes duyệt. A14 XONG 10/11 (nhánh Towfienes/contracts, chưa gộp): `/api/relay/permit` nên trả trễ không cần `approve`/AVAX, readCircle đủ dữ liệu, thỏa thuận chuẩn + `verifyTerms`; audit 0 Critical, High còn lại là cần proxy tin cậy cho hạn mức IP. Đang làm: B12 giao diện v1.2 (ô φ, thỏa thuận, bảng chi phí, tất toán).
- M4 AI + thử thật (hạn 16/11): mô phỏng XONG (chưa phản ánh hoa hồng trong trần); /api/copilot XONG, chưa chạy eval live; ngăn kéo trợ lý XONG.
- M5-M7: chưa tới (đóng băng 17/11, pitch 19/11, nộp 20/11).
- Đang giữ: contracts/, apps/keeper, apps/web/app/api/{relay,attest}, lib/chain (luồng A); apps/web giao diện, lib/live, sim/, copilot (luồng B). Muốn sửa các chỗ này thì báo Towfienes trước.
- Việc mở cho member: T8 slide + kịch bản pitch, T4 rà văn bản luật (apps/web/lib/copilot/rules), T10 README. Nhận việc nào thì ghi tên vào bảng dưới.
<!-- /TOM-TAT -->

## Thành viên

| GitHub | Vai trò | Đang làm |
|---|---|---|
| bminhnemhoi (Minh) | Leader, duyệt đặc tả, người ký Safe | Tạo Safe 2/3, duyệt báo cáo 09/11 |
| Towfienes | Điều phối, review và merge, người ký Safe | M2 |
| khanhle1406 | Đang cân nhắc (chưa mời vào repo) | (chưa nhận) |
| yuutosolonely | Đang cân nhắc (chưa mời vào repo) | (chưa nhận) |

## Cách làm việc

1. Đọc `CLAUDE.md` (luật cứng, quy ước) trước khi sửa code.
2. Tạo nhánh từ `main`: `feat/<việc>`, `fix/<việc>`, `docs/<việc>`. Commit theo Conventional Commits, tiếng Anh.
3. Mở PR vào `main`, ghi lệnh đã chạy để kiểm chứng. Towfienes review rồi merge. Không push thẳng `main`.
4. Không commit bí mật (`.env*` trừ `.env.example`, khóa riêng, API key). Mỗi người tự điền `.env.local` của mình.
5. Lịch và định nghĩa xong của từng mốc: `docs/11-ke-hoach-trien-khai.md`.
