# Checklist nộp bài (M6, M7)

NHÁP chờ Towfienes duyệt (B14). Tình trạng ghi theo repo ngày 11/11/2026.

Hạn: nộp xong, đã bấm Submit và đã chụp màn hình xác nhận TRƯỚC 22:00 thứ Sáu 20/11/2026. Hạn chót của BTC là 23:59 thứ Bảy 21/11/2026, hệ thống khóa đúng giờ; 21/11 chỉ để dự phòng và kiểm link lần hai (docs/11 mục 1, 12).

Cách đọc: "Agent" là việc Claude Code đã làm trong repo và có bằng chứng ghi bên cạnh. "Người" là việc cần một người trong đội làm (push, tài khoản, khóa, quay video, điền form, quyết định). Chưa ai tick ô nào ở cột "Xong"; người chủ việc tự tick khi đã làm xong và đã kiểm.

## 1. Repo và code

| Việc | Ai | Tình trạng | Xong |
|---|---|---|---|
| Chuyển repo sang private, rồi push `main` (nhánh `main` đang hơn GitHub nhiều commit), rồi mời `tuantqse90` làm collaborator. Nếu để public thì bỏ bước mời, nhưng phải rà bí mật trước khi push | Người (Towfienes) | CHƯA: agent không push (luật phiên). Không mời thì bị loại (docs/BAO-CAO-LEADER-09-11.md, mục về repo) | [ ] |
| README: bài toán, kiến trúc, cách chạy, cách chạy test, số test, địa chỉ contract | Agent | Đã viết nháp (`README.md`, B14), số test đo ngày 10 đến 11/11. Thiếu: độ phủ (`forge coverage` chưa chạy) và dòng ghi công starter code của BTC (cần người cho biết đã dùng starter code nào) | [ ] |
| Ghi công starter code của BTC trong README | Người | CHƯA: không có thông tin trong repo | [ ] |
| Contract deploy và verify trên Fuji, `contracts/deployments/fuji.json` đã commit | Agent | Đã deploy 10/11/2026 (commit `494e923`), `fuji.json` có trong `main`; `docs/DEPLOY-FUJI.md` ghi 5/5 contract đã verify trên Routescan | [ ] |
| Mở link Snowtrace của HuiFactory bằng tab ẩn danh và thấy "Contract verified" | Người | CHƯA KIỂM: README và form dùng link `testnet.snowtrace.io`, nhưng chỉ biết verify trên Routescan. Nếu Snowtrace chưa hiện, đổi link trong form sang trang đã verify | [ ] |
| `forge test` xanh (unit, fuzz, invariant) | Agent | Theo `docs/TIEN-DO.md` sau A20: 632 test. Lần đo trước (617 test, 463 unit, 36 fuzz, 54 invariant, ngày 11/11) đạt 0 lỗi; chạy lại `forge test` trên commit cuối trước khi nộp | [ ] |
| Bằng chứng Fuji thật: dây Fixed Completed (3 kỳ + `finalize`) | Agent | Đạt 11/11: dây `0xABA89dFfA4e157927710419b01C32bD307bF2461` state = Completed, `settledRounds` = 3, số dư USDC của dây = 0 (lệnh chỉ đọc); hash giao dịch đầy đủ ở `docs/DEPLOY-FUJI.md` mục 15 | [ ] |
| Bằng chứng Fuji thật: dây vỡ nợ Completed (thác bù 8 + 2, `markDefault`, `finalize`) | Agent | Đạt 11/11: dây `0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc` state = 3 (Completed, đọc `cast call state()`); 104 kiểm tra; tx kỳ 2 `0x1cb02efe008f73e87ccb44b327e7fff0786eba5da95005df4916d6b23c010185`; link https://testnet.snowtrace.io/address/0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc; hash từng bước `docs/DEPLOY-FUJI.md` mục 15b. Phải nói đây là ví dụ do script chạy bằng ví demo, số tiền thu nhỏ 10 lần | [ ] |
| `pnpm -r lint`, `typecheck`, `test` xanh | Agent | Đạt (sdk 126, web 369, keeper 18, config 13); Playwright 469 + 6 kiểm chế độ chuỗi; `pytest` 71 đạt | [ ] |
| CI xanh trên commit cuối | Người | CHƯA KIỂM: CI chỉ chạy sau khi push; xem tab Actions | [ ] |
| Slither không còn mức high | Người | `docs/TIEN-DO.md` ghi Slither high 0 ở lần A13; chạy lại `slither .` trên commit cuối trước khi nộp | [ ] |
| Không có bí mật trong repo (khóa, `.env*`, token, secret Privy) | Người | CHƯA KIỂM: agent bị hook chặn không quét. Chạy gitleaks hoặc skill `security-gate` trên toàn lịch sử trước khi push. Lưu ý: secret Privy cũ đã lộ (docs/TIEN-DO.md), phải dùng secret mới và không để secret cũ trong lịch sử | [ ] |
| Secret Privy mới, 3 địa chỉ chủ Safe thật (thay một ví bằng ví của Minh, địa chỉ Safe không đổi), khóa nạp vào phiên deploy | Người | CHƯA: `docs/TIEN-DO.md` M2, `docs/HUONG-DAN-VI-SAFE.md` bước 5 | [ ] |

## 2. App, relayer, keeper, dây demo trên Fuji

| Việc | Ai | Tình trạng | Xong |
|---|---|---|---|
| Web chạy công khai (Live app) với địa chỉ mở được không cần đăng nhập | Người | CHƯA: chưa có link app; triển khai là việc của người (relayer chạy MỘT tiến trình Node liên tục, docs/05 mục 8.2) | [ ] |
| Ví relayer còn ít nhất 0,02 AVAX, keeper có AVAX và đang chạy | Người | CHƯA KIỂM lúc nộp; xem `/demo-check` | [ ] |
| Chia tiền ví demo, tạo 3 dây demo (Bidding φ = 0, Bidding φ = 5000, Fixed N = 3), vào dây, chạy keeper | Người | Script đã sẵn (`FundDemoWallets`, `CreateDemoCircles`, `JoinDemoCircles`, `docs/DEPLOY-FUJI.md`); phần chạy trên Fuji là việc của người điều phối | [ ] |
| "Demo Hoàn Tất": nhánh B của docs/03 mục 8 chạy trọn trên Fuji | Agent | ĐÃ CÓ 11/11: dây `0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc` (`docs/DEPLOY-FUJI.md` mục 15b). Chạy lại trong cùng ngày quay chỉ cần khi muốn nói "sáng nay"; chạy lại cần keeper, RPC riêng, khoảng 17 phút, và ghi thêm một vỡ nợ cho M4 vào sổ uy tín | [ ] |
| Giao diện B10, B11, B12 duyệt xong | Người (Towfienes) | CHƯA: đang chờ duyệt (`docs/TIEN-DO.md`) | [ ] |
| Chế độ demo: build có `NEXT_PUBLIC_HUISAFE_DEMO=true`, dải khai báo hiện đúng chữ | Agent + người | Dải khai báo đã có (B11); người kiểm trên bản triển khai thật | [ ] |

## 3. Video và slide

| Việc | Ai | Tình trạng | Xong |
|---|---|---|---|
| Video 2 đến 3 phút, YouTube hoặc Loom, mở không cần đăng nhập, phụ đề Việt và Anh, câu khai báo dev toggle ở đầu | Người | Kịch bản nháp đã có: `docs/pitch/kich-ban-video.md`. Việc quay, dựng, tải lên là của người. Quay trên Fuji thật; cảnh hoa hồng φ = 50% nếu dây chưa chạy trên Fuji thì quay trên anvil và ghi "chạy cục bộ" | [ ] |
| Slide Canva hoặc Google Slides, ai có link cũng xem được, slide 1 có khai báo dev toggle | Người | Dàn ý nháp đã có: `docs/pitch/slide.md` (12 slide). Việc dựng slide là của người | [ ] |
| Slide trả lời 3 câu: vì sao on-chain, vì sao Avalanche, tiền hoặc lãi đến từ đâu | Agent | Có trong dàn ý (slide 10 của `slide.md`); người dựng thành slide thật | [ ] |
| Slide luật Việt Nam: 4 điểm của BTC, NĐ 19, giới hạn USDC | Agent | Có trong dàn ý (slide 11); chữ pháp lý cần người rà (xem mục 6) | [ ] |
| Số liệu trên slide khớp nguồn (docs/03, `sim/outputs/*.json`); số nào là giả định thì ghi rõ | Agent | Bảng "số và nguồn" ở cuối `slide.md` và `hoi-dap.md`; người đối chiếu lại lần cuối trước khi nộp | [ ] |
| Mở lại ba bài báo vỡ hụi (Báo Pháp luật 20/09/2024, VOV 13/03/2025, VietnamPlus 06/10/2026) để xác nhận số và chữ trước khi đưa lên slide | Người | CHƯA: nháp lấy từ docs/12, chưa mở lại nguồn | [ ] |

## 4. Form trên team1vn.xyz

| Việc | Ai | Tình trạng | Xong |
|---|---|---|---|
| Project name (<= 100 ký tự), What it does (<= 800), Anything else (<= 800), dán đúng bản NFC | Agent | Đã soạn nháp song ngữ và đếm ký tự: `docs/pitch/form-nop-bai.md`. Người chọn dán bản Việt hay Anh, thay handle Telegram rồi đếm lại | [ ] |
| Có đủ 3 câu bắt buộc và 4 điểm luật của BTC trong bài nộp | Agent | Có trong `form-nop-bai.md` và `slide.md` | [ ] |
| Điền các trường link: GitHub, slide, video, live app, Contract address (link của HuiFactory) | Người | Địa chỉ HuiFactory đã có sẵn trong form nháp; các link kia chưa có (`[CHƯA CÓ: ...]`) | [ ] |
| Mở thử mọi link bằng tab ẩn danh và trên điện thoại dùng 4G (20/11 và 21/11) | Người | CHƯA | [ ] |
| Bấm Submit, không chỉ lưu nháp; chụp màn hình xác nhận | Người | CHƯA | [ ] |

## 5. Con người và ngoài code

| Việc | Ai | Tình trạng | Xong |
|---|---|---|---|
| Builder Pass: 3 trên 3 người đủ 5 nhiệm vụ (docs/11 mục 10) | Người (từng người) | CHƯA KIỂM: không có trong repo | [ ] |
| Danh sách đội: tên đội, tên 3 thành viên và vai (điền vào slide 1 và form) | Người | CHƯA: để trống `[CHƯA CÓ: ...]` trong nháp | [ ] |
| Thử nghiệm với người dùng thật 15 đến 16/11 (5 đến 10 người, phiếu đồng ý, bảng đo, 3 phát hiện và việc đã sửa) | Người | CHƯA diễn ra: kế hoạch ở docs/11 mục 11. Kịch bản chạy được, phiếu đồng ý, bảng ghi, khảo sát và mẫu ba số ở `docs/pitch/thu-nghiem-nguoi-dung.md`; lịch vận hành và đường dự phòng Demo Day ở `docs/pitch/van-hanh-demo-day.md`. Nháp ghi "chưa đo"; chỉ đưa lên slide số đo thật | [ ] |
| Đăng ký các buổi Luma (workshop 17/11, office hours 19/11 và 20/11) | Người | CHƯA KIỂM | [ ] |
| Hỏi BTC thời lượng pitch ở chung kết (chưa công bố, docs/12 mục 2) | Người | CHƯA | [ ] |

## 6. Pháp lý và cam kết lời nói (rà lần cuối)

| Việc | Ai | Tình trạng | Xong |
|---|---|---|---|
| Không có câu "không bao giờ mất tiền", "an toàn tuyệt đối", "chặn gian lận" trong video, slide, form, README | Agent | Đã rà bằng grep trong `docs/pitch/` và README: không có. Người nghe lại video sau khi quay | [ ] |
| Chỉ dùng hai câu cam kết của docs/03 mục 7.3 (cú sốc đồng thời; một ví ảo) | Agent | Có trong README và nháp pitch | [ ] |
| Ý kiến luật sư về NĐ 19 Điều 14, 20, 21 và việc hoa hồng nằm trong trần lãi; USDC có thuộc "tài sản mã hóa" theo NQ 05/2025 không; giá trị pháp lý của chữ ký ví trong sổ họ | Người | CHƯA: là câu hỏi mở của docs/10; trong nháp đều ghi "cần luật sư xác nhận" | [ ] |
| Không dữ liệu cá nhân on-chain; không nhận tiền thật; không bán token | Agent | Đúng theo luật cứng của dự án và code đã kiểm (INV-10 kiểm tĩnh ở CI) | [ ] |
| Chưa chạy eval trợ lý với mô hình thật (cần khóa của người dùng); nháp chỉ dẫn số eval mock 33/33 và nói rõ là kịch bản viết tay | Người | CHƯA: `pnpm --filter web eval:copilot -- --mode live --runs 3` khi người đã export các biến `COPILOT_*` | [ ] |

## 7. Lịch gợi ý tới hạn nộp

| Ngày | Việc chính |
|---|---|
| 11 đến 14/11 | Duyệt giao diện B10 đến B12; push repo (private, mời `tuantqse90`); chạy 3 dây demo trên Fuji; triển khai web, relayer, keeper |
| 15 đến 16/11 | Thử nghiệm với người dùng thật; ghi số đo thật |
| 17/11 | Đóng băng tính năng (docs/TIEN-DO.md) |
| 18 đến 19/11 | Quay video v1, dựng slide, rà số liệu và pháp lý |
| 20/11 | Video cuối, kiểm Fuji và ví demo, form nháp trước 18:00, Submit trước 22:00, chụp màn hình xác nhận |
| 21/11 | Dự phòng: kiểm mọi link bằng tab ẩn danh và 4G; hạn chót 23:59 |
