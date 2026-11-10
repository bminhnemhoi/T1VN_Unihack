# Tiến độ HụiSafe

Cập nhật: 10/11/2026 (Towfienes). Báo cáo gửi leader: `docs/BAO-CAO-LEADER-09-11.md`. Ai xong một việc đáng kể thì sửa phần TÓM TẮT trong cùng PR (giữ dưới 15 dòng).

<!-- TOM-TAT -->
- M0 Setup: XONG. M1 Contract lõi: XONG 08/11. Gói v1.2 (A13) XONG và đã gộp main 10/11: hoa hồng nằm trong trần lãi (φ), quỹ dự phòng chia theo đúng hạn, chân chủ hụi không thu hoa hồng, termsHash, trả hoa hồng ngay kỳ sạch. 586 forge test (54 invariant), audit 0 Critical/High/Medium, Slither high 0, HuiCircle 23.128 B.
- M2 Fuji + SDK (hạn 11/11): ĐÃ DEPLOY FUJI 10/11 (commit 494e923). Factory `0x5004477143F8Db65f80992A0BD79c1DAb75C8b21`, admin = Safe 2/3 `0xc7BeE5Cc787833C8Fd76b9066d334Ab131E7c3F5`, minCoverage 10000, 5/5 contract đã verify (Routescan). Địa chỉ: `contracts/deployments/fuji.json`. Còn: chia tiền ví demo, tạo 3 dây demo (script A15), chạy web/relay/keeper trên Fuji.
- M3 MVP E2E (hạn 14/11): S01-S16 nối chain; B10, B11 đã gộp. A14 đã gộp 10/11: trả trễ qua permit + relay (M-02, ví Privy không cần AVAX), readCircle đủ dữ liệu, văn bản thỏa thuận chuẩn + verifyTerms; E2E anvil 106. B12 (giao diện v1.2: ô φ, thỏa thuận, bảng chi phí, tất toán) xong và đã gộp main (B12b: trường A14, verifyTerms, covered, repayPermitQuote; Playwright 335, E2E anvil 106). Giao diện B10-B12 CHỜ Towfienes duyệt. Script tạo Safe 2/3 (`contracts/script/CreateSafe.s.sol`) và deploy với registry admin = deployer đã sẵn.
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
