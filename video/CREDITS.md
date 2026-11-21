# Nguồn âm thanh, hình và phông chữ của video demo HụiSafe (B30)

## Nhạc nền

- "Hope On Repeat" của HoliznaCC0, album "Spring Woke Me Up", Free Music Archive.
  Trang bài: https://freemusicarchive.org/music/holiznacc0/spring-woke-me-up/hope-on-repeat/
- Giấy phép: CC0 1.0 Universal (hiến tặng vào phạm vi công cộng), https://creativecommons.org/publicdomain/zero/1.0/
  Trang bài ghi đúng liên kết giấy phép này (kiểm lại 21/11/2026). CC0 không bắt buộc ghi công; nhóm vẫn ghi để rõ nguồn.
- File gốc: `audio/music/hope-on-repeat.mp3` (163,7 s, 48 kHz). Video dùng hai đoạn của bài (đoạn mở đầu dưới phần kể
  chuyện hụi, rồi cả bài từ cảnh S04, bỏ 9 ô nhịp ở giữa); cách cắt ghi trong `scripts/mix.py`.

## Hiệu ứng âm thanh

- Kho âm thanh của earshot (MIT), https://github.com/Leonxlnx/earshot @ 4ac3d2ac2b15. Kho gồm âm thanh tạo bằng code
  và một số âm thanh "fit" dựng lại bằng code từ bản ghi CC0 (mỗi âm có ghi nguồn trong kho). Không có bản ghi nào của
  bên thứ ba được nhúng nguyên trong phim.
- Các âm dùng (`audio/kit.json`, render ra `audio/kit/` kèm `kit.lock.json`): knock/wood (con dấu), cut_hit/punch,
  click/snap, pro_click/tink (đồng xu), fit/tick/domino, pro_pop_in/round, fit/land.light/finger_phone,
  ui_pop/soft, whoosh_fast/tight, whoosh_big/swell, reverse_swell/dark, pro_sub_drop/soft, fit/click/floss_lid,
  notify/mid_tine, fit/key/medium, mallet/glock, swipe/paper.

## Lời đọc

- Giọng Eric của ElevenLabs (voice id `cjVigY5qzO86Huf0OWal`), do phiên điều phối tạo bằng tài khoản của nhóm theo
  `script.md`. File ở `public/vo/L01.mp3` đến `L31.mp3`.

## Hình

- Vật thể 3D (phong bì, đồng xu, hũ, con dấu): Codex Astra render riêng cho dự án, `public/3d/`.
- Ảnh chụp thật: trang landing của HụiSafe (`public/capture/landing-*.png`) và Avalanche Explorer của hai dây trên Fuji
  (`public/capture/explorer-*.png`), chụp 21/11/2026.
- Logo Avalanche và Team1 Vietnam: chỉ để nêu nền tảng và cuộc thi (`public/brand/`).
- Giao diện app dựng lại theo `apps/web` (chuỗi chữ và token màu của chính app).

## Phông chữ

- Inter Tight và IBM Plex Mono, SIL Open Font License 1.1 (`public/fonts/OFL-*.txt`).
