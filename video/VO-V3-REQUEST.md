# Đề xuất lời đọc v3: câu đủ chủ vị ở phần mở đầu (chờ tạo lại giọng)

Lý do: người dùng góp ý 21/11 rằng phần đầu phim lược bỏ chữ ("sử dụng chủ vị đầy đủ"). Chữ trên màn đã sửa thành câu
đủ trong bản cuối. Năm câu lời đọc dưới đây vẫn là câu cụt; sửa chúng cần tạo lại MP3 giọng Eric, việc mà worker B30
không làm được (khóa ElevenLabs thuộc phiên điều phối). Sáu câu điều phối đã chốt (L02, L16, L24, L29, L30, L31)
không đụng tới.

| Mã | Đang đọc | Đề xuất v3 |
|---|---|---|
| L01 | A demo on Avalanche Fuji testnet: / test USDC, and rounds sped up to about two minutes. | This demo runs on Avalanche Fuji testnet with test USDC, / and each round is sped up to about two minutes. |
| L05 | Bình Thuận, 2024: / over a hundred billion dong, from 167 people. | In Bình Thuận in 2024, / an organizer took over a hundred billion dong from 167 people. |
| L06 | Trà Vinh, 2025: / 157 fake shares, and twelve years in prison. | In Trà Vinh in 2025, / an organizer faked 157 shares / and got twelve years in prison. |
| L07 | Tây Ninh, 2026: / fake Zalo accounts, nearly five hundred million dong. | In Tây Ninh in 2026, / an organizer used fake Zalo accounts / to take nearly five hundred million dong. |
| L11 | Sign in with Google and you have a wallet. / No AVAX needed: our relayer pays the fees. | Sign in with Google and you have a wallet. / You need no AVAX: our relayer pays the fees. |

Tùy chọn (giữa phim, cùng kiểu): L17 "Highest bid wins." thành "The highest bid wins."; L21 "Round two. // Member 4
comes up ten USDC short." thành "In round two, // Member 4 comes up ten USDC short."

Nguồn dữ kiện (không đổi): Báo Pháp luật 20/09/2024 (chiếm đoạt hơn 100 tỷ đồng của 167 người), VOV 13/03/2025 (đặt
tên hụi viên khống để tự hốt 157 phần, 12 năm tù), VietnamPlus 06/10/2026 (tài khoản Zalo ảo để bỏ thăm và hốt, gần
500 triệu đồng); xem `docs/pitch/slides/build/build_deck.py` slide 3.

Thời lượng: khoảng +18 từ, tức +5 đến 6 s, phim lên khoảng 2:52. Để giữ ≤ 2:50, giảm `END_HOLD` từ 2,8 xuống 2,0 và bớt
0,1 đến 0,2 s ở vài `GAP_BEFORE` trong `src/plan.ts`.

Khi có MP3 mới (cùng tên file, cập nhật hoặc xóa mục tương ứng trong `public/vo/timing.json`):
1. Sửa đúng năm dòng trong bảng ở `script.md`.
2. `node scripts/vo-plan.mjs` (mốc mới cho mọi cảnh) rồi `npx tsx scripts/cues.ts`.
3. `node scripts/make-srt.ts`, `~/.local/share/earshot-venv/bin/python scripts/mix.py`.
4. Render hình (`npx remotion render Film out/video-final-muted.mp4 --codec=h264 --crf=18 --muted`) rồi ghép tiếng như
   trong `.handover/REPORT-B30-VIDEO.md`.
