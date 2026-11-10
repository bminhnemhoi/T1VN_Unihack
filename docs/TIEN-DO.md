# Tiến độ HụiSafe

Cập nhật: 10/11/2026 (Towfienes). Báo cáo gửi leader: `docs/BAO-CAO-LEADER-09-11.md`. Ai xong một việc đáng kể thì sửa phần TÓM TẮT trong cùng PR (giữ dưới 15 dòng).

<!-- TOM-TAT -->
- M0 Setup: XONG. M1 Contract lõi: XONG 08/11 (536 test, 44 invariant, Slither high 0).
- M2 Fuji + SDK (hạn 11/11): ĐANG LÀM. Script dây demo, /api/relay, /api/attest, keeper, chạy thử trên anvil; e2e thoát sạch (A12). Quy trình deploy: `docs/DEPLOY-FUJI.md` (minCoverage 10000, Safe gọi setFactory). Chờ Safe, khóa, app Privy, USDC faucet.
- M3 MVP E2E (hạn 14/11): giao diện S01-S16 (B8) đã ghép với chain (B9), bấm thử trên anvil xong. B10 xong, chờ Towfienes duyệt giao diện: sàn bảo chứng đọc từ chain (Fuji 100%), khóa nút bỏ thăm khi còn nợ hoặc là người sống duy nhất, dải và khóa nút khi dây tạm dừng, Privy nạp lười (trang đầu 640 kB còn 253 kB, Lighthouse mobile 76-81 lên 89-90). Chưa thử Privy thật. B11 (máy tính thăm, đồng hồ công bằng) chờ A9. M-02 (trả trễ cần allowance): `docs/DE-XUAT-M02.md`, khuyến nghị relay nhận permit.
- M4 AI + thử thật (hạn 16/11): mô phỏng XONG; /api/copilot XONG (9router/Gemini hoặc Anthropic), chưa chạy eval live; ngăn kéo trợ lý T6 XONG (gọi /api/copilot thật, có tab máy tính).
- Phản hồi v1.2 + tối ưu dòng tiền: XONG thảo luận 09/11, báo cáo `docs/BAO-CAO-LEADER-09-11.md` (hoa hồng nằm trong trần lãi, gói contract A9, roadmap). Towfienes duyệt thay leader 10/11: làm gói A9. A13 XONG ở nhánh Towfienes/contracts (10/11, chưa push): hoa hồng trong trần φ, quỹ dự phòng theo đúng hạn, termsHash, trả hoa hồng ngay; forge 532 + 54 invariant xanh, E2E anvil 94, audit 0 Critical/High; relayer dừng dưới 0,005 AVAX. Việc tiếp: web B10 thêm ô φ/văn bản thỏa thuận, merge với main. Máy tính kiểm khớp contract: `tools/hui-economics/`.
- M5-M7: chưa tới (đóng băng 17/11, pitch 19/11, nộp 20/11).
- Đang giữ: contracts/, apps/keeper, apps/web/app/api/{relay,attest} (luồng A); apps/web giao diện, sim/, copilot (luồng B). Muốn sửa các chỗ này thì báo Towfienes trước.
- Việc mở cho member: T8 slide + kịch bản pitch, T4 rà văn bản luật (apps/web/lib/copilot/rules), T10 README, W12 kiểm tiếng Việt/accessibility. Nhận việc nào thì ghi tên vào bảng dưới.
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
