# Hồ sơ nộp bài UniHack 2026 (bản chốt 21/11/2026)

Người nộp: Tiến (`Towfienes`). Hạn: **23:59 thứ Bảy 21/11/2026, giờ Việt Nam**; hệ thống khóa đúng giờ
(`team1vn.xyz/api/hack/config`, `submitDeadline`). Nộp ở `team1vn.xyz`: đăng nhập, mở trang hồ sơ, điền **Submit
Project**, bấm **Submit** (lưu nháp chưa tính là nộp). Sau khi nộp vẫn sửa được tới hạn.

Luật loại: "your slides, video and every other link must be open for the judges to view... If the judges cannot open
something, the team is disqualified." Mở thử mọi link bằng tab ẩn danh trước khi bấm Submit.

## 1. Tình trạng từng mục

| Trường của form | Tình trạng | Giá trị hoặc việc còn lại |
|---|---|---|
| Project name * | Sẵn sàng | Mục 2 |
| What it does * | Sẵn sàng | Mục 2 |
| GitHub repository * | Sẵn sàng | `https://github.com/bminhnemhoi/T1VN_Unihack` (repo public) |
| Pitch slides * | Sẵn sàng | `https://docs.google.com/presentation/d/1o5ACVCFPpO_gcy8CKchnLyq9oH6R5DRbcLw3gMhD4Ww/edit?usp=sharing` (bản 26 trang, xem không cần đăng nhập) |
| Demo video * | Sẵn sàng | `https://youtu.be/TQvUQzcTcYI` (YouTube công khai, 2:46) |
| Live app | Sẵn sàng | `https://lamng.tail3abf4e.ts.net:8443` (kiểm 21/11 19:20: trả 200; kiểm lại ngay trước khi nộp) |
| Contract address or explorer link | Sẵn sàng | `https://testnet.snowtrace.io/address/0x5004477143F8Db65f80992A0BD79c1DAb75C8b21` |
| Anything else for the judges | Sẵn sàng | Mục 2 |

Track chọn trong form: **Social finance**.

## 2. Chữ để dán (đã đếm ký tự theo NFC)

Dán nguyên khối, không gõ lại bằng bộ gõ tổ hợp. Form và video dùng tiếng Anh nên đề xuất dán bản tiếng Anh; bản tiếng
Việt ở `form-nop-bai.md`.

**Project name** (97 / 100):

```text
HụiSafe: bidding hụi (ROSCA) on Avalanche where the organiser holds no money but still guarantees
```

**What it does** (791 / 800):

```text
Hụi is how Vietnamese families and traders save and lend to each other, but collapses are common: organisers run off with the pot, or early receivers stop paying and late receivers lose. HụiSafe is a bidding hụi run by smart contracts on Avalanche Fuji. Why on-chain: money stays in each member's wallet; each round the contract pulls contributions and pays the winner in one transaction, so nobody holds the pot between rounds. The organiser posts a locked bond that covers members who stop paying after receiving; early receivers have part of their payout held back; plus a small reserve. Decree 19/2019 rules (bid cap, late fee, ledger) run in code (our reading, pending a lawyer's review). Money comes from members' contributions, early receivers' bids and the organiser's fee. No token.
```

**Anything else for the judges** (797 / 800):

```text
Dev toggle: the demo runs in fast-forward mode (1 round = 2 minutes, grace = 1 minute, bid cap computed on a 30-day period); network fees are paid by our relayer; the bond earns no yield. Fuji testnet USDC only: no real money, no token, no personal data on-chain. Why Avalanche: native USDC with permit (sign once), fees low enough for a relayer to pay, sub-second finality. Vietnam law: crypto is not legal tender (Resolution 05/2025 Art. 4.7), so testnet only; HụiSafe pays no salaries (Labour Code 2019 Art. 95.2); the assistant is free and is not legal or financial advice; no tokenized stocks. HuiFactory (Fuji): https://testnet.snowtrace.io/address/0x5004477143F8Db65f80992A0BD79c1DAb75C8b21. Start with the README: it maps each judging criterion to evidence. Contact: github.com/bminhnemhoi
```

Nếu kỳ demo trong video không phải 2 phút thì sửa con số ở câu đầu cho khớp video rồi đếm lại:

```bash
python -c "import sys,unicodedata;t=open(sys.argv[1],encoding='utf-8').read().rstrip('\n');print(len(unicodedata.normalize('NFC',t)))" <file>
```

## 3. Slide (bộ v2, 26 trang)

File gốc trong repo: `docs/pitch/slides/HuiSafe-UniHack-2026.pptx` (bản PDF và ảnh từng trang nằm cùng thư mục).
Form chỉ nhận link Canva hoặc Google Slides "that anyone can view". Chọn một trong hai cách:

- **Cách A (nhanh nhất, Tiến tự chủ):** tải file `.pptx` trên lên Google Drive của Tiến, chuột phải, "Mở bằng" rồi
  "Google Trang trình bày"; bấm "Chia sẻ", chọn "Bất kỳ ai có đường liên kết", vai trò "Người xem"; sao chép link.
- **Cách B:** dùng bản đã nằm trên Drive của Minh,
  `https://docs.google.com/presentation/d/1rSJaQvyG8k3K9F5W2zuC-UJGoJw0EE8K6SNIzx_lGbc/edit?usp=sharing`. Bản này
  **chưa bật chia sẻ công khai**; chỉ Minh bật được.

Kiểm trước khi dán: mở link bằng tab ẩn danh, lật đủ 26 trang, font là Inter Tight và IBM Plex Mono.

## 4. Video demo (bắt buộc, 2 đến 3 phút, mở được khi chưa đăng nhập)

Repo có dự án Remotion ở `video/` (kịch bản `video/STORYBOARD.md`, lời đọc `video/script.md`) nhưng **chưa có link
video công khai nào**. Việc còn lại:

1. Render bản cuối (lệnh ở `video/VO-V3-REQUEST.md` mục cuối và `.handover/REPORT-B30-VIDEO.md`).
2. Tải lên YouTube ở chế độ "Không công khai" (Unlisted) hoặc Loom; không dùng Google Drive nếu chưa chắc quyền xem.
3. Mở link bằng tab ẩn danh và bằng 4G trên điện thoại.
4. Video phải có ngay ở đầu: khai báo dev toggle (Fuji testnet, tua nhanh thời gian, USDC thử nghiệm); và trả lời ba
   câu hỏi bắt buộc (vì sao on-chain, vì sao Avalanche, tiền từ đâu) cùng giới hạn pháp lý ở Việt Nam. Vòng loại chọn
   Top 10 nhiều khả năng chỉ xem video và repo.
5. Sau khi có link: dán vào form; điền `VIDEO_URL` trong `docs/pitch/slides/build/build_deck.py` và chỗ
   `<!-- DEMO_VIDEO_LINK -->` trong `README.md`, `README.vi.md` (không bắt buộc trước hạn).

## 5. Kiểm lần cuối trước khi bấm Submit

- [x] Repo: `main` đã có README mới (PR #19) và CI xanh (PR #20). Mở `github.com/bminhnemhoi/T1VN_Unihack` bằng tab ẩn danh để xem lại.
- [ ] Link slide mở được khi chưa đăng nhập Google.
- [ ] Link video mở được khi chưa đăng nhập, dài 2 đến 3 phút.
- [ ] Live app mở được bằng 4G; relayer còn ít nhất 0,02 AVAX; keeper đang chạy (`bash scripts/demo-check.sh`).
- [ ] Link Snowtrace của HuiFactory hiện mã nguồn đã verify.
- [ ] Đã bấm **Submit** (không chỉ Save draft) và chụp màn hình xác nhận.
- [ ] Builder Pass: cả ba người đủ 5 nhiệm vụ (không ảnh hưởng điểm bài, chỉ liên quan minigame).

## 6. Bài nói 5 phút ở chung kết (30/11, 5 phút trình bày + 5 phút hỏi đáp, không được quá giờ)

Bộ slide có 26 trang để giám khảo đọc; khi nói chỉ đi 10 trang:

| Phút | Trang | Ý chính |
|---|---|---|
| 0:00 | 1, 2 | Khai báo dev toggle ngay câu đầu; một câu về HụiSafe |
| 0:25 | 4, 5 | Hơn 400 tỷ đồng trong 5 vụ báo chí đưa tin; ba điểm yếu của hụi truyền thống |
| 1:10 | 6 | Bỏ việc giữ tiền, giữ việc bảo lãnh |
| 1:40 | demo | Mở app: vào dây bằng Google, bỏ thăm, khui kỳ (hoặc trang 7, 10 nếu mạng lỗi) |
| 3:00 | 11, 12 | Có người bỏ đóng thì bù 8 + 2 USDC; chỉ số bảo chứng 100% |
| 3:40 | 14, 15 | Năm ý Avalanche; ba dây đã chạy trọn trên Fuji |
| 4:15 | 17, 18 | Ba câu hỏi bắt buộc; pháp luật Việt Nam |
| 4:45 | 19, 21 | Hai giới hạn nói trước; lời cảm ơn |

Câu hỏi nhiều khả năng bị hỏi và chỗ trả lời: `docs/pitch/hoi-dap.md`.

## 7. Nhận xét dưới góc nhìn giám khảo (tự chấm theo thang 100 của BTC)

Ước lượng của nhóm, không phải điểm thật. Khoảng điểm phụ thuộc vào video và độ ổn định của bản demo.

| Tiêu chí | Tối đa | Ước lượng | Điểm cộng | Điểm trừ |
|---|---|---|---|---|
| Technical Implementation | 25 | 21 đến 23 | 634 test hợp đồng, 17 bất biến tiền chạy fuzz, công thức đối chiếu ba ngôn ngữ, độ phủ 98,7%, CI trên `main` xanh đủ 6 job (từ PR #20) | 5 issue còn mở (gắn nhãn `sau-nop-bai`); `HuiCircle` sát giới hạn EIP-170; relayer một tiến trình; chưa có audit độc lập |
| Avalanche Integration | 25 | 20 đến 22 | 5 contract verify trên Fuji, 3 dây chạy trọn có mã giao dịch, USDC permit, ERC-2771 không cần AVAX | Lý do "vì sao Avalanche" (phí thấp, USDC) chuỗi EVM nào cũng nói được; chưa dùng L1 riêng hay ICM |
| Creativity & Innovation | 15 | 12 đến 13 | Tách giữ tiền khỏi bảo lãnh; chỉ số bảo chứng có chứng minh và phản ví dụ; hoa hồng trong trần lãi | Đề #01 là đề gợi ý của BTC, nhiều đội cùng làm hụi |
| Impact & Use Case | 15 | 10 đến 12 | Bài toán thật, có nguồn báo chí và số Findex | Chưa thử với người dùng ngoài đội; USDC chưa dùng thật được ở Việt Nam; mô phỏng cho thấy chủ hụi có thể lỗ trên ký quỹ |
| Presentation & Pitching | 10 | 7 đến 9 | Slide có nguồn cho từng số, nói trước giới hạn, đủ ba câu hỏi và bốn điểm luật | Video chưa có link; 26 trang phải rút còn 10 khi nói |
| UI/UX & Demo | 10 | 8 đến 9 | Landing và app hoàn thiện, tiếng Việt, đăng nhập Google, không cần gas | Bản demo chạy trên một VPS qua địa chỉ Tailscale cổng 8443; lỗi kẹt đăng nhập (#6) chưa sửa |
| **Tổng** | **100** | **78 đến 88** | | |

Hai việc nâng điểm nhiều nhất trong thời gian còn lại, theo thứ tự: (1) có link video công khai đúng luật; (2) kiểm bản
demo sống và ví relayer ngay trước giờ chấm. Việc thứ ba, CI xanh trên `main`, đã xong ở PR #20.

Rủi ro bị loại: chỉ có một, là link không mở được (video, slide, hoặc app nếu Tailscale Funnel rớt).

## 8. Sau khi nộp

- 23/11: BTC công bố 10 đội vào chung kết. 30/11, 09:00 đến 11:30: Final Demo Day tại Greenwich Việt Nam, 20 Cộng Hòa
  (kiểm kỹ thuật từ 08:00; thứ tự trình bày bốc ngẫu nhiên).
- Việc để sau: tách và gộp PR #16 (backend) sau khi Minh và Tiến duyệt phần đổi luật vào dây; các issue #6 (sửa trước Demo
  Day), #8, #9, #12, #17; deploy lại web để có PR #21 và #24; thử với 3 đến 5 nhóm hụi.
