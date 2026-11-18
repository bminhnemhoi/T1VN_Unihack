# HụiSafe: hệ thiết kế (landing đã chốt, áp vào web app)

**Phiên bản v4 (12/11/2026).** Thay bản v3 "Sổ hụi, bản in sang" (giấy xanh, mực xanh đen, ấn đỏ, Newsreader) theo quyết định
của Towfienes ngày 12/11 khi chốt landing mới. Bản v3 đầy đủ: `git show 3654b49:apps/web/DESIGN.md`. Những quy tắc của v3 vẫn
còn đúng được giữ ở mục 7.5 đến 9. Đổi quy tắc: sửa file này trước, rồi `app/globals.css`, rồi code.

Nguồn sự thật: mã của landing đã chốt ngày 12/11/2026 (commit `3654b49`), cụ thể `components/landing/landing.module.css`,
`components/landing/fonts.ts`, `components/landing/Landing.tsx`. Mọi giá trị ở mục 1 đến 6 đọc thẳng từ mã đó (ghi **[mã]**).
Mục 7 là **đề xuất** cho web app (ghi **[đề xuất]**), chưa có trong mã. Chuyển động nằm ở [MOTION.md](MOTION.md).

Vì sao không dùng skill `awwwards-design-md`: skill chỉ nhận trang công khai và từ chối `localhost` (`BLOCKED_DESTINATION`),
mà trang chưa deploy. Đọc từ mã nguồn chính xác hơn đo từ ảnh, nên tài liệu này lấy mã làm bằng chứng.

Tham khảo hướng (Awwwards, 12/11): Osmo (bảng màu trên nền ngà), Monolog (chữ đậm cỡ lớn), Pomegranate (chữ thân gọn),
YumLog (mỗi dải một kiểu), Neutomni (màn mở đầu, hiện dần khi cuộn), Butter (easing). Học cấu trúc và nhịp, không chép.

---

## 1. Màu **[mã]**

| Vai trò | Biến | Giá trị | Dùng cho |
|---|---|---|---|
| Nền trang | `--ivory` | `#F4F0E8` | nền chính, chữ trên nền tối |
| Giấy | `--paper` | `#FBF9F4` | thẻ, khung, chip trên nền ngà |
| Mực | `--ink` | `#201D1D` | chữ chính, nền dải tối, nút phụ |
| Mực sâu | `--ink-deep` | `#151313` | nền dải tình huống |
| Mực 2 | `--ink-2` | `#5A5555` | chữ phụ trên nền sáng |
| Đường kẻ | `--line` | `#DCD6CB` | viền 1px trên nền sáng |
| Mờ | `--mute` | `#A39D94` | chữ phụ trên nền tối |
| Mờ 2 | `--dim` | `#8F8A82` | chữ chưa đến lượt (câu chuyện lá thăm) |
| Xanh chanh | `--lime` | `#A1FF62` | **màu tiền và hành động**: nút chính, số tiền trên nền tối, nhãn |
| Đỏ | `--red` | `#F84131` | vỡ nợ, vượt trần, gạch "giựt" (làm nền hoặc vạch, không làm chữ nhỏ trên nền sáng) |
| Đỏ đậm | `--red-ink` | `#C4271A` | chữ đỏ trên nền sáng |
| Đỏ sáng | `--red-soft` | `#FF6A5C` | chữ đỏ trên nền tối |
| Tím | `--violet` | `#6840FF` | viền focus, một thẻ tình huống |
| Đất | `--clay` | `#A0491F` | thẻ tình huống |
| Rừng | `--forest` | `#17402E` | thẻ tình huống, vòng bảo chứng đủ |

Luật dùng màu **[mã]**:
- Xanh chanh **không bao giờ làm màu chữ trên nền sáng** (tương phản thấp). Dùng làm nền với chữ mực, hoặc làm chữ trên nền mực.
- Đỏ chỉ cho cảnh báo thật: vỡ nợ, vượt trần, câu "Cô Tư giựt hụi rồi!". Một màn chỉ một điểm đỏ.
- Dải màu đậm (tím, đất, rừng, chanh) chỉ có ở lưới tình huống của landing; phần còn lại là ngà, giấy, mực.
- Trang chỉ có giao diện sáng (cố ý). Dải tối là một khối trong trang, không phải chế độ tối.

## 2. Chữ **[mã]**

| Vai trò | Font | Trọng lượng | Biến |
|---|---|---|---|
| Tiêu đề và thân | Inter Tight (Google, có `vietnamese`, font biến thiên 400–900) | 400–900 | `--font-sans` |
| Số, nhãn | IBM Plex Mono (Google, có `vietnamese`) | 400, 500, 600 | `--font-mono` |

Đúng 2 họ font (lamng-design-rule §3). Landing và app dùng chung một cặp, nạp một lần ở `app/fonts.ts` (13/11: bỏ Be Vietnam Pro, Newsreader và font viết tay).

Tất cả miễn phí, tự host qua `next/font` (không gọi Google Fonts lúc chạy).

| Mẫu | Cỡ | Line-height | Letter-spacing | Ghi chú |
|---|---|---|---|---|
| H1 | `clamp(54px, 9.6vw, 140px)`, 800 | 1.02 | -0.045em | `text-wrap: balance`, thoáng dấu Việt |
| H2 | `clamp(40px, 6.4vw, 92px)`, 800 | 1.08 | -0.045em | |
| Tiêu đề thẻ | `clamp(30px, 3.4vw, 46px)` | 1.08 | -0.04em | |
| Logo | 900 24px | 1 | -0.05em | chữ U có dấu nặng là đồng xu |
| Thân | 400 16px | 1.6 | 0 | đoạn tối đa 56ch |
| Thân lớn | 18px | 1.6 | 0 | đoạn mở đầu dải |
| Nhãn | 500 12px mono | 1.3 | 0.08em | IN HOA |
| Số tiền lớn | 500 42px mono | 1.1 | 0 | `tabular-nums` |
| Nút | 600 15px thân | 1 | 0 | |

Mọi con số dùng mono và `font-variant-numeric: tabular-nums` để không nhảy khi đổi.

## 3. Bố cục **[mã]**

- Khung `.wrap`: rộng tối đa 1240px, lề hai bên `max(20px, safe-area)`.
- Landing dựng cho khoảng 1280px; màn rộng hơn phóng cả trang bằng `zoom` theo bậc: 1400px → 1.1, 1560 → 1.22,
  1720 → 1.35, 1900 → 1.5, 2200 → 1.72, 2560 → 2.
- Mốc đổi bố cục: 520, 640, 760 (ẩn link menu), 900 (lưới 2 cột, bento 6 cột), 1100 (bong bóng tin nhắn).
- Nhịp dải: `padding-block: clamp(70px, 9vw, 130px)`; hero 48px / 72px.
- Thứ tự dải: dải demo → menu dính → hero (tiêu đề, con dấu, chip câu hỏi, khung app) → câu chuyện lá thăm (dải tối,
  lá thăm dính bên phải) → lưới tình huống (6 cột: 3+3, 2+2+2) → sổ cái Fuji (2 cột) và chữ chạy → kết.
- Mỗi dải một kiểu (học YumLog), nhưng cùng một bảng màu và một bộ chữ.

## 4. Chiều sâu **[mã]**

- Gần như phẳng. Viền 1px `--line` trên nền sáng, `#3A3636` trên nền tối.
- Bóng chỉ hai loại: bong bóng tin nhắn `0 14px 28px -18px rgba(32,29,29,.45)` và khung app
  `0 40px 80px -40px rgba(32,29,29,.55)`.
- Menu dính: nền ngà 96%, **không** làm mờ nền phía sau (đã bỏ vì tốn GPU khi cuộn).
- Lớp: màn mở đầu 60, menu 30.

## 5. Hình khối **[mã]**

| Thành phần | Bo góc |
|---|---|
| Nút, nhãn, pill | 3–4px (vuông vức, như con dấu) |
| Lá thăm, ô nhỏ | 6–8px |
| Khung app, ô thông tin | 10–14px |
| Thẻ tình huống | 22px |
| Khung xem trước | 20px |
| Chip, bong bóng, công tắc | 999px |

## 6. Thành phần **[mã]**

- **Nút** `.btn`: cao tối thiểu 48px, đệm ngang 20px, bo 4px, chữ 600 15px, ô mũi tên 24px bên phải xoay 45° khi rê
  chuột. Biến thể: `lime` (nền chanh, chữ mực: hành động chính), mặc định (nền mực, chữ ngà), `ghost` (viền mực 1.5px).
- **Nhãn** `.label`: mono 12px in hoa, giãn 0.08em. Bản có nền: chanh, chữ mực, bo 3px (TESTNET, CHẾ ĐỘ DEMO).
- **Chip câu hỏi**: bo tròn, nền giấy, viền `--line`, 600 14px; biến thể `hot` (nền mực, chữ chanh), `warn` (nền đỏ, chữ mực).
- **Thẻ thông tin** (`.kv`): hàng nhãn–giá trị, giá trị mono; hàng `big` là số tiền chanh 26px.
- **Phân đoạn** (`.seg`): nút bo tròn cao 48px trong rãnh tối; nút đang chọn nền ngà.
- **Sổ** (`.entry`): lưới 54px / 1fr / auto, kẻ chấm, cột kỳ mono xám, cột tiền mono căn phải.
- **Nhãn demo (`DemoChip`)**: viên thuốc chanh `DEMO · Fuji` cạnh logo (dưới 400px rút thành `DEMO`), bấm mở ghi chú mạng thử nghiệm và công cụ xem mẫu (B23, thay dải đen 36px cũ).

---

## 7. Áp vào web app **[đề xuất]**

Web app là chỗ làm việc, không phải chỗ trình diễn. Giữ **bảng màu, bộ chữ, hình khối**; giảm **cỡ, độ tương phản dải,
chuyển động**.

### 7.1. Ánh xạ vào biến shadcn hiện có (`app/globals.css`, `:root`)

| Biến app | Hiện tại | Đề xuất |
|---|---|---|
| `--background` | `#F5F7FA` | `#F4F0E8` (ngà) |
| `--foreground`, `--card-foreground` | `#11203F` | `#201D1D` (mực) |
| `--card`, `--popover` | `#FFFFFF` | `#FBF9F4` (giấy) |
| `--primary` / `--primary-foreground` | `#1C4BB5` / trắng | `#201D1D` / `#F4F0E8` (nút phụ, liên kết đậm) |
| `--action` | `#1C4BB5` | `#A1FF62` với chữ `#201D1D` (một nút chính mỗi màn) |
| `--secondary`, `--muted`, `--accent` | `#E8EDF5` | `#ECE7DD` (ngà đậm hơn một bậc, cần đo tương phản) |
| `--muted-foreground` | `#46526B` | `#5A5555` |
| `--border` | `#C9D2E0` | `#DCD6CB` |
| `--input` | `#7B879E` | `#8F8A82` (cần đo lại: viền ô nhập ≥ 3:1 trên ngà) |
| `--ring` | `#1C4BB5` | `#6840FF` (tím, như landing) |
| `--destructive`, `--state-bad` | `#A91D1D` | `#C4271A` |
| `--state-ok`, `--ngoc` | `#0A6246` | `#17402E` (rừng) |
| `--state-warn-bg` / `--state-warn` | `#FFF0BF` / `#5A3A00` | giữ, hoặc nền `#FFE8D6` chữ `#7A2E12` (cần đo) |
| `--radius` | `0.5rem` | `0.25rem` cho nút và ô nhập; thẻ dùng `--radius-2xl` |

Mọi cặp màu đổi phải qua axe (WCAG 2.2 AA) trên đủ 16 màn trước khi gộp.

### 7.2. Chữ trong app
- Tiêu đề màn: Inter Tight 800, `clamp(28px, 4vw, 44px)`, line-height 1, -0.03em. Không dùng cỡ 140px của landing.
- Tiêu đề khối: Inter Tight 700, 20–24px.
- Thân: Inter Tight 16px (cỡ gốc `html` 16px; giữ cỡ chữ người dùng chọn trong Cài đặt).
- Số tiền, đếm ngược, địa chỉ ví: IBM Plex Mono, `tabular-nums`, luôn kèm đơn vị USDC.
- Nhãn trạng thái (Sống, Đã hốt, Trễ, Vỡ nợ): mono 11–12px in hoa trên nền nhãn bo 3px.
- Font `Newsreader` và font viết tay của bộ cũ: đã bỏ khỏi app.

### 7.3. Bố cục app
- Không zoom cả trang như landing; app dùng cỡ cố định để bảng và ô nhập đúng kích thước.
- Máy tính: thanh menu trên cùng (logo HỤI, Dây của tôi, Tạo dây, Phòng mô phỏng, nút Đăng nhập); nội dung rộng tối đa 1240px.
- Điện thoại: thanh dưới 3–4 mục như hiện tại, vùng bấm 48px.
- Mỗi màn một việc chính, **một** nút chanh. Trên đầu là "việc cần làm ngay", rồi số tiền của bạn, rồi chi tiết.
- Dải tối chỉ dùng cho **một** khối nổi bật mỗi màn (ví dụ khối đếm ngược và ô bỏ thăm), giống khung app trong hero.

### 7.4. Giữ nguyên từ app hiện tại
- Luật: vùng bấm 48px, không cuộn ngang ở 390/768/1440, bảng rộng thành thẻ dưới 768/1024px (B17), chữ tiếng Việt,
  số tiền kèm USDC, dải demo trên mọi màn.
- Logic, đọc chuỗi, relay, SDK: không đổi. Chỉ thay lớp giao diện.

### 7.5. Nguyên tắc dashboard (giữ từ v3)
Nguồn: phân tích Mercury, Stripe, Ramp, Brex, Wise, Linear (v3, 08/11).
- **Kết luận trước:** đầu màn là một dòng trả lời "tôi có ổn không, tôi phải làm gì" (khối "việc cần làm ngay"), rồi mới tới số.
- Tiền đang đi lại đặt cạnh số dư; ngoại lệ (trễ, thiếu, vỡ nợ) được đẩy lên, không chìm trong bảng.
- Việc cần làm đứng trước biểu đồ. "Bình tĩnh là đáng tin": không trang trí thừa.
- Màu chỉ để báo trạng thái, luôn kèm chữ hoặc biểu tượng (không dùng màu làm tín hiệu duy nhất).
- Số căn phải, `tabular-nums`, định dạng vi-VN ("288,48 USDC"); trần thăm hiển thị rút gọn thì làm tròn **xuống**.
- Danh sách nhiều mục nằm trong một khối, ngăn bằng đường kẻ mảnh; không xếp chồng các thẻ giống hệt nhau.

### 7.6. Thành phần đặc trưng: sổ hụi (giữ từ v3, đổi màu)
Sổ hụi giấy là một lưới: mỗi kỳ một hàng, mỗi thành viên một cột. HụiSafe hiện cấu trúc đó bằng UI thật, đọc được bằng trình đọc màn hình:
- `components/circle/RoundStrip.tsx`: mỗi kỳ một ô trên từng dòng dây (xong / đang / sau). Kỳ của bạn: v3 tô đỏ ấn, v4 tô
  **chanh trên mực** (giống ô "Đang thăm" trong khung app của landing); đỏ dành cho vỡ nợ.
- `components/circle/LedgerGrid.tsx`: "Bảng sổ hụi" trong phòng bỏ thăm, kỳ × thành viên, `<table>` thật có tiêu đề hàng và cột
  (từ 1024px), dưới đó mỗi kỳ một dòng mở rộng được. Không phải giấy kẻ trang trí.
- Dữ liệu mẫu từ `DEMO_LEDGER` trong `lib/sample.ts` (docs/03 mục 8 nhánh B).

## 8. Không làm
Giữ danh sách cấm của v3, chỉnh theo landing đã chốt:
- Không gradient trang trí (kể cả chữ gradient), ánh sáng phát quang, icon emoji; kính mờ chỉ cho viên thuốc điều hướng dưới trên điện thoại (B23).
- Không lưới thẻ giống hệt nhau làm khung trang; không một bo góc và một bóng cho mọi thứ.
- Không viền 1px nằm dưới bóng đổ rộng; không chữ nhạt hơn `--ink-2` trên nền sáng (hay `--mute` trên nền tối).
- Không hai nút chính cùng trọng lượng; không màu làm tín hiệu duy nhất; không số liệu tròn bịa ra.
- Không animate width, height, top, left (xem MOTION.md).
- Không thêm màu ngoài bảng ở mục 1; không dùng xanh chanh làm chữ trên nền sáng.
- Không có yếu tố ngẫu nhiên nào, kể cả trang trí (luật cứng số 3).
- Không chép logo, ảnh, chữ của các site tham khảo.
- Đã nới so với v3 (quyết định 12/11): nhãn nhỏ trên tiêu đề được dùng (landing có "TESTNET · HỤI BỎ THĂM ON-CHAIN"), nhưng tối đa
  một nhãn mỗi khối; chữ thân tối thiểu 16px thay vì 18px vì người dùng mục tiêu là người trẻ (giữ cỡ chữ chỉnh được ở Cài đặt).

## 9. Tham khảo đã dùng
- v3 (08–09/11, đo bằng dembrandt): roscash, thesusu, cosayv, huio, moneyfellows, Mercury, Wise, Monzo. Ghi chú đầy đủ:
  `docs/design-research/layout-references-09-11.md`. Học được: ví dụ số thật trong hero, một nút chính kèm một liên kết, xen dải
  sáng và dải tối, khối kiểu hóa đơn cho phí và thác bù, vật trung tâm của hero là chính sản phẩm.
- v4 (12/11, Awwwards MCP): Osmo, Monolog, Pomegranate, YumLog, Neutomni, Butter (xem đầu file). Xanh chanh `#A1FF62` lấy từ bảng
  màu đo được của Osmo, theo lựa chọn của Towfienes; v3 từng loại màu chanh (Wise) vì muốn giữ bảng màu riêng.
