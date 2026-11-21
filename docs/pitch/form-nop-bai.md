NHÁP chờ Towfienes duyệt

# Chữ cho form nộp bài team1vn.xyz

Viết ngày 11/11/2026 (B14, pitch). Nền: `docs/12-pitch-demo-nop-bai.md` mục 6, viết lại theo bản v1.2 và theo những gì đã chạy thật ở thời điểm viết (hợp đồng đã triển khai trên Fuji ngày 10/11/2026). Giới hạn của form: Project name <= 100 ký tự; What it does <= 800; Anything else <= 800.

**Cách đếm.** Đếm bằng Python theo điểm mã Unicode sau khi chuẩn hóa NFC. Số đếm ghi dưới mỗi khối đã kiểm bằng lệnh ở cuối file. **Dán đúng khối trong bảng mã, không gõ lại bằng bộ gõ tổ hợp (NFD)**, vì NFD làm số ký tự tăng và có thể vượt giới hạn.

**Cần người quyết trước khi dán.** (1) Dán bản tiếng Việt hay tiếng Anh (hai bản đều có; docs/12 chưa nói form yêu cầu ngôn ngữ nào). (2) Thay `[CHƯA CÓ: Telegram]` bằng handle thật: bản Việt còn dư 17 ký tự, bản Anh còn dư 10 ký tự, nên handle thay vào dài tối đa 36 ký tự (bản Việt) hoặc 29 ký tự (bản Anh); sau khi thay phải đếm lại. (3) Chỉ giữ các câu "Đang chạy" nếu đúng lúc nộp.

## 1. Project name (<= 100 ký tự)

Tiếng Việt, 84 ký tự:

```text
HụiSafe: hụi bỏ thăm on-chain trên Avalanche, chủ hụi không cầm tiền mà vẫn bảo lãnh
```

Tiếng Anh, 97 ký tự:

```text
HụiSafe: bidding hụi (ROSCA) on Avalanche where the organiser holds no money but still guarantees
```

## 2. What it does (<= 800 ký tự)

Có trong khối: vấn đề, người dùng, cách chạy (vì sao on-chain), Nghị định 19 trong code (cách hiểu của nhóm, chờ luật sư xác nhận), tiền đến từ đâu, không token.

Tiếng Việt, 783 ký tự:

```text
Hụi (họ) là cách người Việt tiết kiệm và vay nhau, nhưng vỡ hụi xảy ra liên tục: chủ hụi cầm tiền rồi bỏ trốn, hoặc người hốt sớm bỏ đóng khiến người hốt sau mất tiền. HụiSafe là hụi bỏ thăm chạy bằng smart contract trên Avalanche Fuji, cho chủ hụi và nhóm hụi gia đình, tiểu thương, sinh viên. Vì sao on-chain: tiền nằm trong ví từng người; mỗi kỳ contract kéo tiền góp và chi người hốt trong một giao dịch, không ai cầm tiền giữa các kỳ. Chủ hụi không cầm tiền nhưng ký quỹ khóa trong contract để bảo lãnh; người hốt sớm bị giữ lại một phần; có quỹ dự phòng. Trần thăm, lãi chậm góp, sổ họ theo Nghị định 19/2019 chạy trong code (cách hiểu của nhóm, chờ luật sư xác nhận). Tiền đến từ đâu: tiền góp của chính thành viên, tiền thăm người hốt sớm trả, tiền công chủ hụi. Không token.
```

Tiếng Anh, 791 ký tự:

```text
Hụi is how Vietnamese families and traders save and lend to each other, but collapses are common: organisers run off with the pot, or early receivers stop paying and late receivers lose. HụiSafe is a bidding hụi run by smart contracts on Avalanche Fuji. Why on-chain: money stays in each member's wallet; each round the contract pulls contributions and pays the winner in one transaction, so nobody holds the pot between rounds. The organiser posts a locked bond that covers members who stop paying after receiving; early receivers have part of their payout held back; plus a small reserve. Decree 19/2019 rules (bid cap, late fee, ledger) run in code (our reading, pending a lawyer's review). Money comes from members' contributions, early receivers' bids and the organiser's fee. No token.
```

## 3. Anything else for the judges (<= 800 ký tự)

Có trong khối: khai báo dev toggle, chỉ USDC testnet, vì sao Avalanche, bốn điểm luật Việt Nam của BTC, địa chỉ `HuiFactory` kèm link, thứ tự xem (README có dây vỡ nợ thật), liên hệ. Chỗ liên hệ để placeholder.

Tiếng Việt, 783 ký tự (với placeholder 19 ký tự):

```text
Dev toggle: demo chạy chế độ tua nhanh (1 kỳ = 2 phút, ân hạn 1 phút, trần lãi tính như kỳ 30 ngày); phí mạng do relayer trả; ký quỹ không sinh lãi. Chỉ USDC testnet trên Fuji: không tiền thật, không token, không dữ liệu cá nhân on-chain. Vì sao Avalanche: USDC native có permit (ký một lần), phí thấp để relayer trả thay, giao dịch chốt dưới 1 giây. Luật Việt Nam: tiền mã hóa không phải phương tiện thanh toán hợp pháp (NQ 05/2025 Điều 4.7) nên chỉ chạy testnet; HụiSafe không trả lương (BLLĐ 2019 Điều 95.2); trợ lý miễn phí, không phải tư vấn tài chính hay pháp lý; không có cổ phiếu token hóa. HuiFactory (Fuji): https://testnet.snowtrace.io/address/0x5004477143F8Db65f80992A0BD79c1DAb75C8b21. Xem video, app, README (có dây vỡ nợ thật trên Fuji). Hỏi nhanh: [CHƯA CÓ: Telegram]
```

Tiếng Anh, 790 ký tự (với placeholder 19 ký tự):

```text
Dev toggle: the demo runs in fast-forward mode (1 round = 2 minutes, grace = 1 minute, bid cap computed on a 30-day period); network fees are paid by our relayer; the bond earns no yield. Fuji testnet USDC only: no real money, no token, no personal data on-chain. Why Avalanche: native USDC with permit (sign once), fees low enough for a relayer to pay, finality under 1 second. Vietnam law: crypto is not legal tender (Resolution 05/2025 Art. 4.7), so testnet only; HụiSafe pays no salaries (Labour Code 2019 Art. 95.2); the assistant is free and is not legal or financial advice; no tokenized stocks. HuiFactory (Fuji): https://testnet.snowtrace.io/address/0x5004477143F8Db65f80992A0BD79c1DAb75C8b21. Watch the video, app, README (real default case on Fuji). Contact: [CHƯA CÓ: Telegram]
```

## 4. Các trường còn lại

| Trường | Giá trị |
|---|---|
| GitHub repository | `github.com/bminhnemhoi/T1VN_Unihack` (docs/12 mục 6; docs/11 mục 12 ghi repo public hoặc đã mời `tuantqse90`; cần xác nhận lúc nộp) |
| Pitch slides | https://docs.google.com/presentation/d/1xVkNyassCzzyNnwSN6EzBGepRhPXO7KLeMb6BYnw4R8/edit?usp=sharing (bộ slide v2, 26 trang, trên Drive của Minh; phải bật "Bất kỳ ai có đường liên kết: Người xem" rồi mở thử bằng tab ẩn danh trước khi dán vào form) |
| Demo video | `[CHƯA CÓ: link YouTube hoặc Loom, mở không cần đăng nhập]` |
| Live app | https://lamng.tail3abf4e.ts.net:8443 (vào thẳng app: `/circles`) |
| Contract address | `HuiFactory` trên Fuji: `0x5004477143F8Db65f80992A0BD79c1DAb75C8b21`. Link: https://testnet.snowtrace.io/address/0x5004477143F8Db65f80992A0BD79c1DAb75C8b21 |

### Thành viên (3 người)

| Họ tên | GitHub | Vai trò |
|---|---|---|
| Ngô Bình Minh (trưởng nhóm) | `bminhnemhoi` | Trưởng nhóm; thiết kế sản phẩm và giao thức (luật dây hụi, tham số v1.2: hoa hồng trong trần lãi, quỹ dự phòng chia theo đúng hạn); pitch |
| Ngô Lâm Tiến | `Towfienes` | Frontend và tích hợp: web app, trải nghiệm người dùng, ví Privy và relayer, triển khai web |
| Ngô Đặng Trọng Hiếu | `yuutosolonely` | Backend và kiểm thử: keeper, SDK, rà soát và viết test |

Bản tiếng Anh (nếu form cần): Ngô Bình Minh (team lead): product and protocol design, pitch · Ngô Lâm Tiến: frontend and integration (web app, UX, Privy wallet and relayer, deployment) · Ngô Đặng Trọng Hiếu: backend and testing (keeper, SDK, test reviews).

Địa chỉ lấy nguyên từ `contracts/deployments/fuji.json` (chainId 43113, deployedAt 2026-11-10T16:49:03Z, gitCommit 494e923). Các hợp đồng khác trong cùng file, nếu form cần liệt kê: `forwarder` `0x789621cFD56Cc79ec47eF6C449B6C53c40516b2C`, `reputation` `0xf8F05aa2804144F5aC71485614480f801927E5c3`, `circleImplementation` `0x3A72591e0d451802F051789497eD5f2B2256673d`, `circleLens` `0xb4Ebda56d43db9e629C1FD6b226ac828BE0637a6`. `docs/TIEN-DO.md` ghi 5/5 hợp đồng đã xác minh trên Routescan: phải mở link Snowtrace ở trên bằng tab ẩn danh để chắc trang hiện mã nguồn đã xác minh, trước khi viết "đã verify" ra ngoài.

## 5. Kiểm tra

| Mục | Bản Việt | Bản Anh |
|---|---|---|
| Project name | 84 / 100 | 97 / 100 |
| What it does | 783 / 800 | 791 / 800 |
| Anything else (với placeholder) | 783 / 800 | 789 / 800 |
| Đã ở dạng NFC | Có | Có |

- Dev toggle: có (Anything else, câu đầu).
- Ba câu bắt buộc: vì sao on-chain (What it does), tiền đến từ đâu (What it does), vì sao Avalanche (Anything else): có.
- Bốn điểm luật BTC (Anything else): tiền mã hóa không phải phương tiện thanh toán hợp pháp; lương trả bằng VND (nêu rằng HụiSafe không trả lương); tư vấn có phí cần giấy phép (trợ lý miễn phí, không phải tư vấn); cổ phiếu token hóa: có.
- Điều 21 kèm "cách hiểu của nhóm, chờ luật sư xác nhận": có (What it does).
- Không nói có tiền thật, không hứa lời, không nói đã được cấp phép hay đã có luật sư xác nhận; số mô phỏng không đưa vào form (nằm ở README và slide): đúng.
- Không dùng emoji. Các từ cấm: không có (đã tìm bằng grep).

Lệnh kiểm (chạy trên từng khối, ví dụ ghi khối vào file tạm rồi chạy):

```bash
python3 -c "import sys,unicodedata;t=open(sys.argv[1],encoding='utf-8').read();print(len(unicodedata.normalize('NFC',t)), t==unicodedata.normalize('NFC',t))" <file>
```

(Nếu dùng `echo` hay trình soạn thảo thêm ký tự xuống dòng ở cuối file, số đếm tăng 1; không tính ký tự đó.)
