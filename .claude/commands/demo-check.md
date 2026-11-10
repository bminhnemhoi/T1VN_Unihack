---
description: Kiểm tra sẵn sàng demo hoặc nộp bài (chỉ đọc) - Fuji, contract đã deploy và verify, USDC và AVAX của các ví, relayer, keeper, web và nhãn chế độ demo, dây demo, CI, bí mật, checklist nộp bài - trả bảng ĐẠT / CHƯA ĐẠT / CẦN NGƯỜI KIỂM.
argument-hint: "[url web, ví dụ http://localhost:3000 hoặc link production]"
disable-model-invocation: true
allowed-tools:
  - Bash(cast chain-id *)
  - Bash(cast block-number *)
  - Bash(cast code *)
  - Bash(cast call *)
  - Bash(cast balance *)
  - Bash(gh run list *)
---

Kiểm tra sẵn sàng demo. Web cần kiểm: $ARGUMENTS (trống thì bỏ phần web, chỉ kiểm chuỗi và repo).
Chỉ đọc: không broadcast, không sửa file, không đọc `.env*`. Nguồn checklist: `docs/11-ke-hoach-trien-khai.md` mục 12, `docs/12-pitch-demo-nop-bai.md`.

Các bước:

1. **Mạng:** `cast chain-id --rpc-url fuji` ra `43113`; `cast block-number --rpc-url fuji` tăng giữa hai lần gọi.
2. **Contract:** đọc `contracts/deployments/fuji.json`; với forwarder, reputation, circleImplementation, factory: `cast code <địa chỉ> --rpc-url fuji` khác `0x`; `cast call <reputation> "factory()(address)" --rpc-url fuji` khớp factory. In link `https://testnet.snowtrace.io/address/<địa chỉ>` để người xác nhận đã verify (rủi ro R16: Etherscan ngừng API Fuji từ 15/11/2026).
2b. **Admin là Safe:** `cast call <factory> "admin()(address)" --rpc-url fuji` phải bằng `admin` trong `fuji.json` và là Safe 2/3, KHÔNG phải ví deployer (`jq -r .admin contracts/deployments/fuji.json` rồi so với địa chỉ deployer người cho); `cast call <admin> "getThreshold()(uint256)" --rpc-url fuji` ra `2` và `cast call <admin> "getOwners()(address[])" --rpc-url fuji` ra đúng ba chủ đã chốt (docs/DEPLOY-FUJI.md mục 2); `cast call <reputation> "admin()(address)" --rpc-url fuji` là deployer (chỉ có quyền `setFactory` một lần, đã dùng). Lệch thì CHƯA ĐẠT: admin của factory không đổi được sau deploy.
3. **USDC:** `cast call 0x5425890298aed601595a70AB815c96711a31Bc65 "version()(string)" --rpc-url fuji` ra `"2"`; số dư USDC của ví chủ hụi và M1..M5 (người cho địa chỉ) bằng `cast call <USDC> "balanceOf(address)(uint256)" <ví> --rpc-url fuji`; dây demo C = 10 USDC cần ký quỹ 48 USDC và mỗi thành viên đủ allowance (N − 1)·(C + revealBond) = 40,4 USDC; Demo Day có 3 dây (48 + 48 + 16 ký quỹ, thành viên cần cho cả ba 100,8 USDC allowance): organizer ≥ 112 USDC, mỗi M ≥ 101 USDC.
4. **AVAX:** `cast balance <ví> --rpc-url fuji --ether` cho relayer (cần ≥ 0,02 AVAX), keeper, deployer.
5. **Dây demo:** `cast call <factory> "circlesOf(address)(address[])" <organizer> --rpc-url fuji` ra đủ 3 dây (Bidding φ = 0, Bidding φ = 5000, Fixed N = 3); với từng địa chỉ dây demo, đọc `state()`, `currentRound()`, `coverageIndexBps()`, `params()`; trạng thái phải là Forming còn hạn `joinDeadline`, hoặc Active đúng kỳ dự kiến cho buổi demo.
6. **Keeper:** có event `RoundSettled` gần đây trên dây demo (`cast logs` theo địa chỉ dây, khoảng block nhỏ) hoặc người xác nhận keeper đang chạy (quét 15 giây ở chế độ demo).
7. **Web** (nếu có URL): mở bằng MCP Playwright nếu phiên có; nếu không, `curl -sS -o /dev/null -w "%{http_code}" <url>` (sẽ hỏi người duyệt) phải ra 200, và `<url>/api/sim/results?scenario=baseline` ra 200. Với Playwright: bề rộng 360 px, có nhãn "Chế độ demo", chữ tiếng Việt, nút đăng nhập Google/email, không lỗi console.
8. **Repo:** `gh run list --limit 3` (CI xanh ở commit cuối); `git ls-files '*.env*' '*.pem' '*.key' '*keystore*'` chỉ được ra `.env.example`; `contracts/deployments/fuji.json` đã commit.
9. **Nộp bài (người kiểm, liệt kê để tick):** link mở được bằng tab ẩn danh và điện thoại 4G; video 2-3 phút công khai, có khai báo dev toggle ở đầu; slide công khai, slide 1 có khai báo dev toggle, đủ 3 câu hỏi và slide luật Việt Nam; form: Project name ≤ 100 ký tự, What it does ≤ 800, Anything else ≤ 800 (NFC); repo private thì đã mời `tuantqse90`; Builder Pass 3/3; bấm Submit và chụp xác nhận.

Báo cáo: bảng `Hạng mục | Trạng thái (ĐẠT / CHƯA ĐẠT / CẦN NGƯỜI KIỂM) | Bằng chứng (lệnh, số, link) | Việc cần làm`, rồi danh sách việc ưu tiên trước giờ demo.
