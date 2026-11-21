# Video demo HụiSafe

Phim demo 2 đến 3 phút nộp cho Team1 Vietnam UniHack 2026, dựng bằng [Remotion](https://www.remotion.dev/) 4: mọi
khung hình là React, không có cảnh quay tay. Giao diện trong phim dựng lại từ `apps/web` (cùng màu, phông chữ, bố cục và
chữ tiếng Việt); số liệu ở các cảnh sản phẩm là dữ liệu thật của dây `0xc628…5Bfc` trên Fuji.

| Thông số | Giá trị |
|---|---|
| Khung hình | 1920 × 1080, 60 fps, H.264 |
| Thời lượng mục tiêu | 2:42 (trần 3:00 theo luật BTC) |
| Lời đọc | Tiếng Anh, 31 câu (`public/vo/L01.mp3` đến `L31.mp3`), phụ đề tiếng Anh in sẵn và file `.srt` |
| Composition | `Film` (phim), `Board` (bảng phân cảnh), `Spike` (thử chuyển động) trong `src/Root.tsx` |

Giây đầu của phim là câu khai báo dev toggle (Fuji testnet, USDC thử nghiệm, kỳ hụi tua nhanh), theo luật BTC.

## Tài liệu trong thư mục

| File | Nội dung |
|---|---|
| [`STORYBOARD.md`](STORYBOARD.md) | 14 cảnh: lời đọc, khung hình, chữ trên màn, cách chuyển cảnh |
| [`script.md`](script.md) | Lời đọc từng câu, cách đọc tên riêng và con số |
| [`VO-V3-REQUEST.md`](VO-V3-REQUEST.md) | Đề xuất sửa lời đọc và các bước dựng lại sau khi có giọng mới |
| [`CREDITS.md`](CREDITS.md) | Nguồn và giấy phép của nhạc, hiệu ứng âm thanh, giọng đọc, hình, phông chữ |

## Chạy

Cần Node 20.19 trở lên. Ghép tiếng cần `ffmpeg`; bước kiểm tiếng trong `final-check.sh` dùng công cụ `earshot` (xem đầu file script).

```bash
cd video
npm i
npm run dev                      # Remotion Studio, xem và chỉnh từng cảnh
npm run lint                     # eslint + tsc
```

Dựng bản cuối:

```bash
node scripts/vo-plan.mjs         # mốc thời gian từng cảnh theo độ dài lời đọc
npx tsx scripts/cues.ts          # điểm rơi của hiệu ứng âm thanh
node scripts/make-srt.ts         # phụ đề .srt
python scripts/mix.py            # trộn lời đọc, nhạc, hiệu ứng ra audio/mix/master.wav (cần numpy, soundfile)
npx remotion render Film out/video-final-muted.mp4 --codec=h264 --crf=18 --muted
bash scripts/final-check.sh out/video-final-muted.mp4 out/video-final.mp4 out/check   # ghép tiếng, kiểm thông số
```

Thư mục `out/` và `audio/mix/` không nằm trong git. Bản nộp phải được tải lên nơi mở được khi chưa đăng nhập (YouTube
"Không công khai" hoặc Loom); link dán vào form nộp bài, xem `docs/pitch/HO-SO-NOP-BAI.md` mục 4.

## Cấu trúc mã

```text
src/Film.tsx        ghép 14 cảnh theo mốc trong plan.ts
src/acts/           ba hồi của phim (Act1 đến Act3), gồm 14 cảnh
src/ui.tsx          các màn của app dựng lại bằng React
src/objects.tsx     phong bì lá thăm, đồng xu, hũ
src/Captions.tsx    phụ đề in sẵn
src/tokens.ts       màu và phông chữ, khớp apps/web/DESIGN.md
audio/              nhạc nền (CC0), bộ hiệu ứng âm thanh, điểm rơi
public/             lời đọc, ảnh 3D, logo, phông chữ, ảnh chụp landing
```
