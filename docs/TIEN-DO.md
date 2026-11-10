# Tiến độ HụiSafe

Cập nhật: 11/11/2026 (Towfienes). Báo cáo gửi leader: `docs/BAO-CAO-LEADER-09-11.md`. Ai xong một việc đáng kể thì sửa phần TÓM TẮT trong cùng PR (giữ dưới 15 dòng).

<!-- TOM-TAT -->
- M0 Setup: XONG. M1 Contract lõi: XONG 08/11. Gói v1.2 (A13) XONG và đã gộp main 10/11: hoa hồng nằm trong trần lãi (φ), quỹ dự phòng chia theo đúng hạn, chân chủ hụi không thu hoa hồng, termsHash, trả hoa hồng ngay kỳ sạch. 617 forge test (54 invariant), audit 0 Critical/High/Medium, Slither high 0, HuiCircle 23.128 B.
- M2 Fuji + SDK: XONG 10/11. Safe 2/3 `0xc7BeE5Cc787833C8Fd76b9066d334Ab131E7c3F5` là admin factory `0x5004477143F8Db65f80992A0BD79c1DAb75C8b21`, minCoverage 10000, 5/5 contract verify Routescan (`contracts/deployments/fuji.json`). Ví demo đã chia tiền (A15), 3 dây demo: Bidding φ=0 `0x58f6...F9E2`, Bidding φ=5000 `0xd231...7F29` (để Forming cho người thử bằng Privy), Fixed N=3 `0xABA8...2461`.
- M3 MVP E2E (hạn 14/11): chạy thật trên Fuji 11/11: dây Fixed vào dây qua relay (không AVAX), keeper chốt 3 kỳ (`0xecfcfaeb...4669`, `0xc7e8f352...c4bb`, `0xba1208d7...79d6`) và `finalize` (`0x7159ec48...b290`), Completed, sổ cái về 0. Giao diện S01-S16 + v1.2 (B10-B12) xong, CHỜ Towfienes duyệt. Còn: đăng nhập Privy thật trên web chạy với Fuji, chọn nơi chạy web.
- Kiểm thử và audit (A16, A17, 11/11): forge 617 (54 invariant), coverage 98,7%, Slither High 0, audit 0 Critical/High; relay/keeper bỏ qua dây không ký quỹ (M-01, L-01 đóng off-chain); `bash scripts/demo-check.sh` 30 PASS. pnpm: sdk 126, web 361, keeper 18; Playwright 467; E2E anvil 106; pytest 71. Roadmap: trần α/ký quỹ tối thiểu trong contract (L-02).
- Web đọc Fuji thật và chỗ chạy (A18, 11/11): web `next start` đọc dây thật đúng chuỗi (dây Fixed: 3 kỳ 15,60 / 17,60 / 19,60 USDC, 4 tx trong sổ hụi; dây φ=5000 hiện "Khớp thỏa thuận"); đọc sự kiện qua API Routescan vì RPC công khai Fuji giới hạn `getLogs` 100 block và chặn theo IP. Có `docs/HOSTING.md` (VPS + Caddy + systemd, hoặc Railway/Render, đúng 1 web + 1 keeper) và `Dockerfile` build chạy được. Chưa chọn nơi chạy web (người quyết). sdk 126, web 350, Playwright 335.
- M4 AI + thử thật (hạn 16/11): mô phỏng XONG, đã phản ánh v1.2 (B13: hoa hồng trong trần φ, quỹ chia theo đúng hạn, hai kịch bản `organizer_economics` và `organizer_sybil` khớp bảng 5.5 và docs/03 mục 7.3); /api/copilot XONG và hiểu φ, `max_bid_table` và `simulate_circle` có số v1.2, eval mock 33/33, chưa chạy eval live; ngăn kéo trợ lý XONG.
- M5-M7: chưa tới (đóng băng 17/11, pitch 19/11, nộp 20/11). B14 (nháp tài liệu nộp bài) xong, CHỜ Towfienes duyệt: README dự án, `docs/pitch/` (kịch bản video, 12 slide, 15 câu hỏi đáp, form nộp bài song ngữ, checklist nộp); Playwright nay luôn chạy bản dữ liệu mẫu (335 đạt) và docs/05 mục 12 đã ghi tham số v1.2 của trợ lý. Còn thiếu (cần người): link slide, video, app, danh sách đội, thử nghiệm người dùng, push repo.
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
