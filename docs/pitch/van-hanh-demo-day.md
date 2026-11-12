# Vận hành Demo Day (30/11/2026)

Trạng thái: NHÁP chờ Towfienes duyệt. File này là lịch chạy và đường dự phòng trước giờ trình bày. Kịch bản lời nói 3 phút nằm ở [docs/12 mục 3](../12-pitch-demo-nop-bai.md); file này nói về việc phải làm để kịch bản đó chạy được, và nói rõ chỗ kịch bản đang lệch với thứ có thật trên Fuji.

## 1. Trạng thái thật trên Fuji (đọc ngày 11/11/2026; số USDC của organizer và deployer đọc lại sau ví dụ vỡ nợ)

Nguồn: `bash scripts/demo-check.sh` (không FAIL) và `cast call` chỉ đọc; dây vỡ nợ theo `docs/DEPLOY-FUJI.md` mục 15b.

| Hạng mục | Giá trị | Ý nghĩa cho Demo Day |
|---|---|---|
| Factory | `0x5004477143F8Db65f80992A0BD79c1DAb75C8b21`, admin là Safe 2/3 `0xc7BeE5Cc787833C8Fd76b9066d334Ab131E7c3F5`, `minCoverageBps` 10000 | Sẵn sàng |
| Dây 1 `0x58f60387386a75c29CA281509a818C8a50D8F9E2` | Bidding φ = 0, `Forming`, 0/5 người, ký quỹ 48 USDC, CI 100% | Hạn vào dây 17/11 17:20 UTC: HẾT HẠN trước Demo Day |
| Dây 2 `0xd231db0b842dE1C1B153511618341C659F7f7F29` | Bidding φ = 50%, `Forming` (đọc lại `state()` = 0 ngày 11/11), 0/5, ký quỹ 48, CI 100% | Như trên; dùng cho buổi thử người dùng 15 đến 16/11 |
| Dây 3 `0xABA89dFfA4e157927710419b01C32bD307bF2461` | Fixed N = 3, `Completed`, 3 kỳ đã chi, số dư USDC về 0 | Dùng làm "dây đã hoàn tất" để mở sổ hụi và Snowtrace |
| Dây 4 `0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc` (`huisafe-demo-default`) | Bidding N = 5, C = 10, `Completed` (đọc `state()` = 3), ví dụ docs/03 mục 8 nhánh B chạy thật: M4 vỡ nợ, thác bù 8 + 2, `finalize`, 104 kiểm tra | Bằng chứng "dây vỡ nợ thật" cho đoạn 1:50 đến 2:40 của kịch bản. Do script chạy bằng ví demo, không phải người dùng thật |
| Relayer `0x6C03fDfD5aB26Aea68878a62942E9E80811055DB` | 0,05 AVAX | Đủ (cần ≥ 0,02, dưới 0,005 relay dừng) |
| Organizer demo `0x19881652EF890353462D2367B81E862ee8867447` | 18,176 USDC (đọc lại sau ví dụ vỡ nợ; trước đó 48,6), 0,005 AVAX (lần đọc đầu) | THIẾU để tạo bộ dây mới (cần 112 USDC) |
| Deployer `0x077ab81E81FAD22CcA7BefD65D90F2F668B20aB7` | 46 USDC, 0,04 AVAX | Không đủ để bù cho organizer |
| M1..M5 | mỗi ví 121,8 USDC theo lần đọc đầu (đã đọc ba ví đầu); ví dụ vỡ nợ đã dùng USDC của M1..M5, chưa đọc lại | Nguồn USDC cho ví người thử và dây mới. Đọc lại số dư trước khi chuyển |

Hệ quả: trước Demo Day phải tạo dây mới (mục 2 T-1 ngày; riêng "dây vỡ nợ" đã có thật, không phải tạo lại), và phải gom thêm USDC testnet (faucet Circle chỉ cho 20 USDC mỗi 2 giờ mỗi ví, [faucet.circle.com](https://faucet.circle.com/); rủi ro R5 ở docs/11 mục 6).

## 2. Lịch chạy

Giờ ghi theo "T = lúc bắt đầu trình bày". Mỗi việc có người chịu trách nhiệm và ô "Xong". Người chịu trách nhiệm là gợi ý theo bảng thiết bị ở mục 4; Towfienes chốt.

### T-1 ngày (29/11)

| Việc | Lệnh hoặc cách làm | Người | Xong |
|---|---|---|---|
| Nạp USDC cho organizer demo tới ≥ 112 (cộng thêm cho ví người thử nếu cần) | Chuyển từ M1..M5 (mỗi ví 121,8) hoặc gom faucet; chỉ Fuji. `FundDemoWallets` chạy được nếu deployer có đủ (`docs/DEPLOY-FUJI.md` mục 6) | | [ ] |
| Tạo bộ dây mới (Bidding φ = 0, Bidding φ = 50%, Fixed N = 3), hạn vào dây dài | Mô phỏng: `DEMO_FORCE=true JOIN_WINDOW_SECONDS=172800 forge script script/CreateDemoCircles.s.sol --rpc-url fuji`; duyệt rồi thêm `--broadcast`. `DEMO_FORCE` cần vì hai dây Bidding cũ vẫn `Forming` (script từ chối tạo khi đã có dây sống cùng loại), và script tạo luôn cả ba dây, ký quỹ 48 + 48 + 16 = 112 USDC. Khóa organizer đọc bằng `vm.envUint("DEMO_ORGANIZER_PRIVATE_KEY")`, không gõ trên dòng lệnh | Người giữ khóa | [ ] |
| Cho M1..M3 vào dây Fixed mới và kích hoạt (dây Bidding giữ `Forming`; muốn chừa ghế cho "Demo Mời" 4/5 thì `DEMO_MEMBERS=4`, xem mục 7) | `DEMO_JOIN=fixed forge script script/JoinDemoCircles.s.sol --rpc-url fuji --broadcast` (chạy lại an toàn). Hai dây Bidding mới giữ `Forming` | Người giữ khóa | [ ] |
| Kích hoạt dây "Demo Sống" khi đủ người (không bấm được từ web vì chủ hụi là ví script) | `export CIRCLE=<địa chỉ dây>`, `forge script script/ActivateDemoCircle.s.sol --rpc-url fuji` (mô phỏng, script tự kiểm: dây của factory, đúng chủ hụi, `Forming`, đủ N, còn hạn, bảo chứng đạt), duyệt rồi thêm `--broadcast`. Chi tiết `docs/DEPLOY-FUJI.md` mục 8b | Người giữ khóa | [ ] |
| Chạy keeper tới khi dây Fixed mới `Completed` | Mục T-60 | | [ ] |
| Quay sẵn đoạn video dự phòng và chụp ảnh | Mục 5 | | [ ] |
| Cập nhật `contracts/deployments/fuji.json`? | Không đổi: dây mới không nằm trong file này, chỉ factory và hạ tầng. Ghi địa chỉ dây mới vào mục 1 của file này | | [ ] |

### T-60 phút

1. `bash scripts/demo-check.sh` (đặt thêm `KEEPER_ADDRESS`, `ORGANIZER_ADDRESS`, `M1_ADDRESS`..`M5_ADDRESS`, `SAFE_OWNER_1..3` để các dòng CHECK thành PASS). Không được có FAIL. Dòng "dây còn hạn vào dây" của dây Bidding dùng cho demo phải PASS.
2. Keeper: `KEEPER_INTERVAL_SECONDS=15 pnpm --filter keeper start` (cần `KEEPER_PRIVATE_KEY`, `FUJI_RPC_URL` trong môi trường, người điền sẵn trước khi mở phiên). Log phải có `keeper started`, rồi `scan done circles=... failed=0`. Ví keeper cần ít nhất 0,004 AVAX.
3. Web bản demo, một tiến trình Node liên tục (hạn mức và nonce của relay nằm trong bộ nhớ, `docs/05` mục 8.2): `NEXT_PUBLIC_HUISAFE_DEMO=true HUISAFE_DEMO=true pnpm --filter web build && pnpm --filter web start -H 127.0.0.1`. Bản demo có nhãn "Chế độ demo" ở đầu mọi màn và thăm dò chuỗi 5 giây. Không đặt `TRUST_PROXY` khi không có proxy phía trước (`docs/DEPLOY-FUJI.md` mục 10).
4. Biến server cho relay, attest: đã đặt trước khi mở phiên; khi khởi động attest tự đối chiếu khóa với attester của factory và dừng nếu lệch.
5. `/demo-check http://localhost:3000`: web trả 200, `/api/sim/results?scenario=baseline` trả 200, có nhãn demo, chữ tiếng Việt.
6. Mạng hội trường: đăng nhập Privy thử bằng một tài khoản; mở Snowtrace; nếu chặn thì chuyển sang hotspot 4G (mục 6).
7. Cho từng máy đăng nhập sẵn tài khoản của mình (mục 4); kiểm số dư USDC của từng tài khoản đủ (dây mới cần mỗi thành viên cho phép tối đa 40,4 USDC).

### T-30 phút

1. Tạo dây Fixed mới nếu dây "đã hoàn tất" chưa có hoặc đã mất: chạy lệnh ở T-1 ngày. Một dây Fixed N = 3 xong sau khoảng 3 × 180 giây + 120 giây ân hạn, khoảng 11 phút sau khi kích hoạt, nên T-30 là hạn chót an toàn; muộn hơn thì dùng dây `0xABA8...2461` đã Completed.
2. Mở sẵn các tab (mỗi máy một cửa sổ riêng): danh sách dây, dây "đã hoàn tất" (Tổng quan, Sổ hụi, Bảo chứng), dây sẽ bắt đầu trong demo (Phòng bỏ thăm), Snowtrace của dây Fixed (`https://testnet.snowtrace.io/address/0xABA89dFfA4e157927710419b01C32bD307bF2461`), trang Phòng mô phỏng.
3. Hỏi sẵn trợ lý các câu của kịch bản để câu trả lời nằm trên màn (câu hỏi ở docs/12 mục 3.2, 40 đến 65 giây).
4. Đặt "Sao lưu thăm" sẵn cho tài khoản sẽ nộp thăm; kiểm IndexedDB không bị trình duyệt xóa (không dùng cửa sổ ẩn danh cho tài khoản nộp thăm).
5. Tắt thông báo hệ thống, pin, ngủ màn hình; bật chế độ máy bay không dùng (cần mạng).

### T-5 phút

1. Chạy lại `bash scripts/demo-check.sh`. Nếu có FAIL: không sửa tại chỗ; chuyển sang đường dự phòng tương ứng ở mục 6.
2. Kiểm keeper còn chạy (dòng `scan done` mới trong 30 giây gần nhất).
3. Mở màn đầu tiên của kịch bản trên máy chiếu; tab video dự phòng mở sẵn ở tab cuối, tạm dừng.
4. Người nói nhắc lại câu khai báo (mục 3); người cầm máy biết mình bấm gì ở giây nào.

### T-0

Đọc câu khai báo chế độ demo trước khi bấm gì (mục 3), rồi chạy kịch bản docs/12 mục 3.2.

## 3. Câu khai báo chế độ demo

Đọc nguyên văn ở giây đầu tiên (luật BTC: dev toggle phải khai báo ngay đầu pitch, `docs/12` mục 1). Bản Việt:

> "Trước khi bắt đầu, chúng em xin khai báo dev toggle: bản demo chạy ở chế độ demo trên Avalanche Fuji testnet. Thời gian được tua nhanh: mỗi kỳ hụi 3 phút thay vì 30 ngày, ân hạn 2 phút thay vì 48 giờ; trần lãi và lãi chậm góp vẫn tính như kỳ 30 ngày. Tiền trong demo là USDC thử nghiệm, không có giá trị, và sản phẩm không sinh lãi."

Thêm vế (vì các dây demo có mức góp 10 USDC thay vì 100 USDC): "Demo thu nhỏ 10 lần vì giới hạn faucet của USDC thử nghiệm; slide giữ số 100 USDC cho dễ đọc." Bản Anh: `docs/12` mục 1.

Nếu người nói bị ngắt hoặc gọi lên sớm, câu này vẫn đọc trước.

## 4. Ai cầm máy nào

Theo `docs/12` mục 3.1 (thiết bị) và `docs/11` mục 4 (P1, P2, P3). Chỉ là gợi ý; Towfienes chốt từng dòng, đặc biệt người nói.

| Thiết bị | Là tài khoản nào | Chiếu lên màn hình | Người cầm | Việc |
|---|---|---|---|---|
| Laptop A | Chủ hụi (Privy), có thêm một cửa sổ ẩn danh cho "thành viên mới" | Có | P3 | Bấm "Bắt đầu dây", mở các màn của dây "đã hoàn tất", đăng nhập thành viên mới |
| Điện thoại B | Thành viên M4 (Privy), phản chiếu màn hình | Có (qua cáp hoặc phản chiếu) | P2 | Nộp thăm kín, sao lưu thăm, mở thăm |
| Laptop C | Thành viên M2 (Privy) | Không | P1 | Nộp và mở thăm của M2 trong cửa sổ; nút "Chốt kỳ" khi keeper chậm |
| Máy chạy hạ tầng | Web, keeper, relayer, attest | Không | Người giữ biến môi trường | Giữ web, keeper chạy; không đóng terminal |
| Người nói | | | (chờ chốt) | Đọc câu khai báo, dẫn kịch bản |

Mỗi tài khoản Privy phải có sẵn 45 USDC testnet hoặc hơn, và ít nhất một tài khoản dự phòng (người thử dùng chung với ghế đội ở buổi thử người dùng).

## 5. Tài sản dự phòng (làm trước, để trên laptop, USB và đám mây)

- Video quay sẵn theo từng đoạn như `docs/12` mục 4: tạo dây và chỉ số (20 giây), vào dây bằng Google (25 giây), kỳ 1 nộp, mở, chốt (40 giây, đồng hồ thật trên màn), kỳ 2 thiếu, bù, vỡ nợ (40 giây), sổ hụi và Snowtrace (15 giây). Đoạn kỳ 2 có thiếu tiền quay trên anvil cục bộ hoặc bản dữ liệu mẫu và phải ghi nhãn "chạy cục bộ" hoặc "dữ liệu mẫu" (xem khoảng trống ở mục 7).
- Ảnh chụp 390 và 1440 các màn S03, S06, S07, S09, S11, S12 (có sẵn bộ ở `.handover/screens/`, làm lại nếu đổi giao diện).
- PDF hoặc ảnh trang Snowtrace của dây Fixed `0xABA89dFfA4e157927710419b01C32bD307bF2461` và của factory `0x5004477143F8Db65f80992A0BD79c1DAb75C8b21`.
- Sổ hụi in được của dây Fixed (nút "In sổ hụi" ở màn Sổ hụi) lưu PDF.
- Trang Phòng mô phỏng chụp sẵn (`/lab`), vì mô phỏng không cần mạng.

## 6. Đường dự phòng

| Sự cố | Dấu hiệu | Làm ngay |
|---|---|---|
| Fuji hoặc RPC chậm | Không có receipt sau 10 giây, màn quay mãi | Kiểm `bash scripts/demo-check.sh` ở máy hạ tầng (đọc RPC công khai); thử lại một lần; vẫn chậm thì phát đoạn video tương ứng và mở ảnh Snowtrace. Giao diện chưa có RPC dự phòng tự động (biến `FUJI_RPC_URL_FALLBACK` trong docs/04 mục 8 chưa được web đọc), nên đổi RPC phải đặt `FUJI_RPC_URL` rồi khởi động lại web |
| Privy không đăng nhập (mạng hội trường chặn) | Cửa sổ Google lỗi, vòng quay mãi | Chuyển sang hotspot 4G; dùng phiên đã đăng nhập từ T-60 (không đăng xuất); bỏ đoạn "vào dây mới", phát clip 25 giây |
| Relayer lỗi hoặc hết AVAX | `/api/relay` trả 503 `RelayUnavailable` hoặc 429 | Kiểm AVAX relayer (`cast balance 0x6C03...55DB --rpc-url fuji --ether`, dưới 0,005 thì dừng); nạp từ ví có AVAX; chưa có nút "Gửi trực tiếp" trong giao diện (docs/12 mục 4 nhắc nhưng web chưa làm), nên không dựa vào nó |
| Keeper không chốt | Quá 3 phút 30 giây sau khi kỳ bắt đầu vẫn chưa có kết quả | P1 bấm "Chốt kỳ" trên Laptop C (qua relay, không tốn AVAX); nếu relay lỗi thì người có ví AVAX gọi `settleRound()` trực tiếp trên dây |
| Bị gọi lên sớm hoặc muộn | Dây đã qua kỳ 1 khi bắt đầu | Dùng dây dự phòng (mục 1, dây Bidding mới tạo ở T-1 ngày); nói câu khai báo rồi mới bấm "Bắt đầu dây" |
| Hết thời gian vào dây của dây đã chuẩn bị | Dây Bidding cũ quá 17/11 17:20 UTC | Đã tạo dây mới ở T-1 ngày; không dùng dây cũ |
| Fuji ngừng lâu | Mọi giao dịch lỗi | Chạy cục bộ trên anvil và nói rõ là cục bộ: `pnpm --filter web exec tsx scripts/anvil-playground.ts` (dựng anvil, deploy, tạo dây, giữ node chạy, các route attest và relay giả lập Privy ở cổng 3200), rồi `HUISAFE_NETWORK=anvil pnpm --filter web exec next dev -p 3300` (đọc đầu file `scripts/anvil-playground.ts` để biết cách nối `/api/relay`, `/api/attest`). Chỉ cần bằng chứng chạy hết luồng thì `pnpm --filter web e2e:anvil` (106 kiểm tra, không có giao diện). Không bao giờ trỏ sang mainnet |
| Cả web lỗi | Trang trắng | Phát video; mở ảnh chụp; mở dây Fixed trên Snowtrace |
| Máy chiếu không nhận laptop | | Dùng laptop C, hoặc phản chiếu điện thoại B |

## 7. Khoảng trống giữa kịch bản docs/12 và những gì có thật (cần Towfienes quyết)

1. **Dây hết hạn vào dây (ĐÃ CÓ CÔNG CỤ).** Hai dây Bidding hiện tại hết hạn 17/11 17:20 UTC, trước Demo Day. Lệnh tạo bộ mới: `DEMO_FORCE=true JOIN_WINDOW_SECONDS=172800 forge script script/CreateDemoCircles.s.sol --rpc-url fuji` (mô phỏng), duyệt rồi thêm `--broadcast`; tạo cả ba dây, cần organizer có ít nhất 112 USDC (hiện 18,176, nên phải nạp trước; mục 1 và mục 2 T-1 ngày). Còn lại là việc nạp USDC, không còn thiếu công cụ.
2. **Chủ hụi là ví script, không bấm "Bắt đầu dây" được từ web (ĐÃ CÓ CÔNG CỤ).** `ActivateDemoCircle.s.sol` (A20): `export CIRCLE=<địa chỉ dây>`, `forge script script/ActivateDemoCircle.s.sol --rpc-url fuji`, rồi `--broadcast` khi người duyệt đồng ý; script kiểm trước (`NotACircle`, `NotOrganizer`, `NotForming`, `NotFull`, `JoinDeadlinePassed`, `CoverageBelowMinimum`). Giây 0:00 của kịch bản docs/12 vẫn phải đổi: người cầm khóa organizer chạy lệnh này ở máy hạ tầng, và phần "P3 bấm Bắt đầu dây" diễn lại bằng lời, hoặc tạo "Demo Sống" ngay trên web bằng tài khoản Privy của P3 (khi đó thành viên cũng phải là tài khoản Privy). Cần chọn một trước 29/11.
3. **Chừa ghế cho "Demo Mời 4/5" (ĐÃ CÓ CÔNG CỤ).** `DEMO_MEMBERS=4 DEMO_ACTIVATE=false forge script script/JoinDemoCircles.s.sol --rpc-url fuji` đưa M1..M4 vào, dây Bidding còn đúng một ghế cho người vào live bằng Privy; `DEMO_ACTIVATE=false` để chắc chắn dây không bị kích hoạt khi có thể có người lạ chen vào, rồi kích hoạt riêng bằng `ActivateDemoCircle` khi đủ 5 người. Hai giới hạn: nếu người lạ đã chiếm đúng ghế mà một M đã chọn cần thì `join` của M đó revert `CircleFull` và lần chạy dừng (đưa M vào trước khi mở dây cho người ngoài); dây Fixed vẫn chỉ nhận tối đa 3 người (`docs/DEPLOY-FUJI.md` mục 8b).
3b. **Dây vỡ nợ thật trên Fuji (ĐÃ ĐÓNG).** Dây `0xc62828b2f72D288298A6E2fFd0814D0Cb6e15Bfc` đã chạy trọn ví dụ nhánh B (104 kiểm tra; tx kỳ 2 `0x1cb02efe008f73e87ccb44b327e7fff0786eba5da95005df4916d6b23c010185`, `markDefault` `0x33886575dc944a9d66f25209b5e56096a1c0941247ac71c079a11961d6ab9b66`, `finalize` `0xf415cfb744bcd159657fe7be86ce9d32221b4bdf626742499b7efb2de649bc32`; `docs/DEPLOY-FUJI.md` mục 15b). Đoạn 1:50 đến 2:40 chiếu từ trang dây và sổ hụi của dây này, không còn phải chiếu từ anvil hay dữ liệu mẫu. Phải nói rõ: số tiền là bản thu nhỏ 10 lần (mục 3), và đây là ví dụ do script chạy bằng ví demo, không phải người dùng thật bỏ đóng. Dây chạy ngày 11/11, không phải sáng Demo Day. Chạy lại ví dụ làm M4 ghi thêm một vỡ nợ vào sổ uy tín và cần keeper cùng RPC riêng (khoảng 17 phút); chỉ chạy lại khi cần dây mới và sau buổi quay.
4. **Số của docs/12 mục 3 là 100 USDC; dây thật là 10 USDC.** Đã thêm vế khai báo thu nhỏ 10 lần ở mục 3.
5. **docs/12 mục 3.1 tên script (ĐÃ ĐÓNG).** docs/12 đã ghi `CreateDemoCircles.s.sol` (số nhiều); `CreateDemoCircle.s.sol` (số ít) là bản cũ.
6. **"Gửi trực tiếp" và RPC dự phòng tự động** được nhắc trong docs/12 mục 4 và docs/04 mục 8 nhưng chưa có trong web (đã kiểm: không có chuỗi này trong `apps/web/components`, `lib`, `app`).

## Nguồn

- Trạng thái chuỗi: `scripts/demo-check.sh`, `contracts/deployments/fuji.json`, `cast call` chỉ đọc ngày 11/11/2026.
- Dây vỡ nợ thật, `ActivateDemoCircle`, `DEMO_MEMBERS`: `docs/DEPLOY-FUJI.md` mục 8b, 12b, 15b; `contracts/script/ActivateDemoCircle.s.sol`. Số dư organizer và deployer, `state()` của ba dây: `cast call` chỉ đọc ngày 11/11/2026.
- Lệnh tạo và vào dây: `docs/DEPLOY-FUJI.md` mục 6 đến 9, `contracts/script/CreateDemoCircles.s.sol` (đầu file: `DEMO_FORCE`, `JOIN_WINDOW_SECONDS`), `contracts/script/JoinDemoCircles.s.sol` (đầu file: `DEMO_JOIN`, `DEMO_ACTIVATE`).
- Keeper, web, hạn mức: `docs/DEPLOY-FUJI.md` mục 9, 10; `apps/keeper/package.json`; `apps/web/package.json`; `apps/web/lib/chain/server.ts` (`HUISAFE_DEMO`).
- Anvil: `README.md` mục "Trên anvil", `apps/web/scripts/anvil-playground.ts`, `apps/web/package.json` (`e2e:anvil`).
- Kịch bản, câu khai báo, thiết bị: `docs/12-pitch-demo-nop-bai.md` mục 1, 3, 4; checklist: `docs/pitch/checklist-nop.md`; vai P1, P2, P3: `docs/11-ke-hoach-trien-khai.md` mục 3 và 4.
