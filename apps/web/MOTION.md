# HụiSafe: chuyển động (landing đã chốt, bộ gọn cho web app)

Đi kèm [DESIGN.md](DESIGN.md). Phần A là **bảng chuyển động của landing**, đọc từ mã (`components/landing/LandingMotion.tsx`,
`components/landing/landing.module.css`, commit `3654b49` và các sửa sau đó), kèm số đo thật. Phần B là **bộ chuyển động cho
web app** (đề xuất, chưa có trong mã). Theo skill `awwwards-motion-study`: mọi hiệu ứng được làm phải chỉ ra được một hàng
trong bảng; không thêm hiệu ứng "theo cảm giác".

## Nguyên tắc chung (cả landing và app)

1. **Chỉ animate `transform` và `opacity`** (kể cả `translate`, `rotate`, `scale` riêng lẻ). Không animate `width`, `height`,
   `top`, `left`, `margin`, `flex-basis`, `filter: blur`, `backdrop-filter`. Lý do: hai thuộc tính trên chạy trên GPU
   (compositor), không phải tính lại bố cục mỗi khung hình.
2. **Hiệu ứng lặp vô hạn chạy bằng CSS**, không bằng JS (GSAP tween `repeat: -1`), để luồng chính rảnh.
3. **Giảm chuyển động** (`prefers-reduced-motion: reduce`): tắt mọi animation và transition; trang vẫn đầy đủ, không phần nào
   bị ẩn chờ hiệu ứng.
4. **Nội dung đọc được khi không có JS**: hiệu ứng chỉ dịch chuyển hoặc đổi màu, không giấu nội dung ở trạng thái nghỉ.
5. **Không ngẫu nhiên** (luật cứng số 3): độ nghiêng, độ trễ đều là bộ số cố định.

---

## A. Landing: bảng chuyển động **[mã]**

Thư viện: GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.13 (cuộn mượt, `lerp: 0.1`), tải động chỉ ở landing; rời trang thì
`gsap.context().revert()` và `lenis.destroy()`. ScrollTrigger tắt tự đo lại khi `load` (tránh khựng giữa lúc hero vào),
đo lại một lần sau màn mở đầu.

### A1. Màn mở đầu (render sẵn từ server, che từ khung hình đầu, chạy mỗi lần vào trang)

| Phần tử | Kích hoạt | Biến đổi | Thời lượng | Easing | Chồng lấn | Chạy bằng |
|---|---|---|---|---|---|---|
| Chữ H, U, I | lúc vẽ đầu tiên | `translateY(120%)` → 0 | 0,85 s | `cubic-bezier(0.16,1,0.3,1)` | trễ 0 / 0,08 / 0,16 s | CSS keyframes |
| Đồng xu (dấu nặng) | 0,5 s | rơi từ -5em, nảy 3 nhịp (0 → -0,9em → 0 → -0,25em → 0), mờ → rõ | 0,8 s | `cubic-bezier(0.33,0,0.67,1)` | | CSS |
| Đồng xu | 1,3 s | `scale` 1 → 1,3 → 1 | 0,32 s | ease-in-out | | CSS |
| Dòng chữ dưới + "Bỏ qua" | 0,3 s | `opacity` 0 → 1 | 0,5 s | ease-out | | CSS |
| **Thoát** (khoảng 1,65 s theo đồng hồ của màn mở đầu, hoặc bấm "Bỏ qua") | | | 1,1 s (bỏ qua: 0,65 s) | | | Web Animations API |
| ┗ chữ HỤI | | FLIP: `translate(tx,ty) scale(k)` bay vào đúng chỗ logo trên menu | d | `cubic-bezier(0.65,0,0.35,1)` | | WAAPI |
| ┗ bản chữ màu mực | | `opacity` 0 → 1 (chữ ngà chuyển dần sang mực) | 0,55·d, trễ 0,2·d | ease-in-out | | WAAPI |
| ┗ nền tối | | `opacity` 1 → 0 | 0,7·d, trễ 0,18·d | `cubic-bezier(0.4,0,0.2,1)` | | WAAPI |
| ┗ dòng chữ dưới | | `opacity` 1 → 0 | 0,26 s | ease-out | | WAAPI |
| ┗ hero | | bắt đầu (A2) | | | **ở 30% quãng thoát**: hero trồi lên khi nền còn đang mờ | GSAP |
| ┗ hạ cánh | khi chữ tới logo | logo thật 0 → 1, chữ bay 1 → 0 | 0,16 s | ease-out | đồng thời | WAAPI |
| Dự phòng không JS | 3 s | nền, chữ, dòng dưới mờ dần; ẩn hẳn lúc 3,7 s; logo hiện lúc 3,2 s | 0,7 s | ease-out | | CSS |

Đổi màu chữ bằng cách mờ dần một bản chữ màu mực chồng lên, vì animate `color` không chạy trên GPU.

### A2. Hero (một timeline GSAP, `power3.out` trừ khi ghi khác)

| Phần tử | Biến đổi | Thời lượng | Easing | Vị trí trong timeline |
|---|---|---|---|---|
| Menu (SAFE, liên kết, "Mở app") | `y -12`, `opacity 0` → về chỗ | 0,6 s | power3.out | từ 0, so le 0,06 s |
| 3 dòng tiêu đề | `yPercent 110` → 0 (trồi lên sau mặt nạ `overflow: hidden`) | 1 s | power3.out | so le 0,09 s |
| Gạch đỏ chữ "giựt." | biến `--s` 0 → 1 (`scaleX`) | 0,7 s | power2.inOut | -0,2 s |
| Con dấu | `scale 0` → 1 | 1 s | back.out(1.6) | -0,9 s |
| Vòng chữ con dấu | `rotation -120` → 0 (chữ U giữa luôn đứng thẳng) | 1,4 s | power3.out | cùng lúc con dấu |
| Bong bóng tin nhắn | `x -40`, `scale 0.7` → về chỗ, gốc trái | 0,7 s | back.out(1.8) | -0,8 s, so le 0,14 s |
| Đoạn giới thiệu, nút | `y 24` → 0 | 0,8 s | power3.out | -0,9 s, so le 0,08 s |
| Chip câu hỏi | `y 30`, `scale 0.6`, nghiêng theo bộ số cố định [-9,7,-4,11,-11,5,-7,9]° → về chỗ | 0,7 s | back.out(1.8) | -0,6 s, so le 0,05 s |
| Khung web app | `y 80`, `rotationX 12°` (phối cảnh 1200) → 0 | 1,1 s | power3.out | -0,6 s |
| Ô các kỳ | `y 22`, `scale 0.85` → về chỗ | 0,6 s | back.out(1.6) | -0,6 s, so le 0,08 s |

### A3. Lặp vô hạn (tất cả CSS, chạy trên GPU)

| Phần tử | Biến đổi | Chu kỳ | Ghi chú |
|---|---|---|---|
| Vòng chữ con dấu | `rotate` 0 → 360° | 26 s linear | |
| Bong bóng tin nhắn | `translateY` 0 → -9px → 0 | 4,4 s ease-in-out | lệch nhịp -1,5 s / -3 s |
| Chip câu hỏi | thuộc tính `translate` 0 → -6px, đảo chiều | 2,4 s ease-in-out | bật sau khi hero vào xong; không đụng độ nghiêng |
| Vạch chạy trong khung app | `translateX` 0 → `calc(100% - 2px)` của rãnh | 7 s linear, trễ 1,5 s | |
| Chữ chạy cuối sổ cái | `translateX` 0 → -50% | 28 s linear | |

### A4. Theo cuộn

| Phần tử | Kích hoạt | Biến đổi | Thời lượng | Easing |
|---|---|---|---|---|
| Vòng chữ con dấu | cuộn qua hero (scrub) | `rotation` thêm 160° | theo cuộn | none |
| Lá thăm | đầu dải "Một kỳ hụi" chạm 70% màn | `y 80`, `rotation -6` → 0 | 1,1 s | power3.out |
| Bước 1 / 2 / 3 | khối bước qua mốc 55% màn | đặt `data-state` 1/2/3 trên dải | | |
| ┗ Nắp lá thăm (bước 2) | | `rotateX(100deg)`, `opacity` → 0 (lật lên) | 1 s / 0,4 s trễ 0,55 s | `cubic-bezier(0.7,0,0.2,1)` |
| ┗ Phần che dưới | | `opacity` → 0 | 0,5 s trễ 0,35 s | |
| ┗ Dấu "ĐÃ HỐT" (bước 3) | | `scale 1.8` → 1, `opacity` 0 → 1 | 0,5 s | `cubic-bezier(0.2,1.6,0.4,1)` (đóng dấu) |
| ┗ Chữ bước đang xem, thanh tiến độ | | đổi màu | 0,6 s / 0,5 s | transition |
| Tiêu đề các dải | khối chạm 85% màn | con `y 40` → 0 | 0,76 s, so le 0,08 s | power1.out |
| Thẻ tình huống | lưới chạm 85% | `y 90`, nghiêng ±3° → 0 | 0,9 s, so le 0,1 s | power3.out |
| Dòng sổ cái | mỗi tờ chạm 80% | `x -30` → 0 | 0,6 s, so le 0,1 s | power2.out |
| Chữ khúc kết | cuộn qua (scrub) | màu `#858079` → `#201D1D` từng chữ (lúc nghỉ vẫn đạt 3:1) | theo cuộn | none |
| Không có thư viện | IntersectionObserver dự phòng | vẫn đổi bước lá thăm | | |

### A5. Rê chuột, tương tác

| Phần tử | Biến đổi | Thời lượng |
|---|---|---|
| Mũi tên trong nút | `rotate(45deg)` | 0,5 s `cubic-bezier(0.2,0.7,0.2,1)` |
| Tờ sổ cái | viền và nền đổi màu | 0,3 s |
| Vòng bảo chứng (ô tình huống) | `stroke-dashoffset` | 0,8 s `cubic-bezier(0.7,0,0.2,1)` |
| Thanh thác bù | `flex-basis` | 0,9 s (ngoại lệ: chỉ chạy khi bấm, một dòng nhỏ; nên đổi sang `scaleX` khi đụng tới) |

### A6. Số đo (Playwright, Chromium headless, không GPU)

- Cuộn hết trang ở 1800px và 390px, CPU giả lập chậm 6 lần: **0 khung hình quá 34 ms**, trung vị 17 ms.
- Lúc vào trang: khung hình dài chỉ trong 0,2 s đầu (khởi động); **không có** trong màn mở đầu và đoạn thoát.
- Chưa đo trên điện thoại thật.

---

## B. Web app: bộ chuyển động gọn **[đề xuất]**

Web app là chỗ làm việc lặp đi lặp lại. Chuyển động chỉ để **báo cho người dùng biết điều gì vừa xảy ra**, không để trình diễn.
Mỗi màn tối đa **một** khoảnh khắc có chủ đích (v3 cũng giữ luật này).

### B1. Không mang từ landing sang
- Màn mở đầu, cuộn mượt Lenis, hiệu ứng theo cuộn (scrub), vật lơ lửng lặp vô hạn, chữ chạy, phóng cả trang bằng `zoom`.
- GSAP và Lenis không nằm trong gói tải đầu của app. App dùng CSS transition / Web Animations API; riêng thao tác xóa dây hủy mới nạp động `import('gsap/Flip')` (`lib/delete-motion.ts`, B25).

### B2. Bộ thời lượng và easing

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--dur-tap` | 120 ms | nhấn nút, bật tắt, chọn |
| `--dur-ui` | 180 ms | hiện/ẩn menu, tooltip, mở rộng dòng |
| `--dur-panel` | 240 ms | ngăn kéo trợ lý, hộp thoại |
| `--dur-state` | 400 ms | đổi trạng thái có nghĩa (đóng dấu, số tiền về) |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | vào (cùng họ với màn mở đầu landing) |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | chuyển chỗ (cùng đường cong với chữ HỤI bay) |
| `--ease-stamp` | `cubic-bezier(0.2, 1.6, 0.4, 1)` | đóng dấu (cùng dấu "ĐÃ HỐT" của landing) |

Không quá 400 ms cho bất kỳ chuyển động nào người dùng phải chờ.

### B3. Danh sách chuyển động của app

| Tình huống | Chuyển động | Thời lượng | Ghi chú |
|---|---|---|---|
| Nhấn nút | `scale` 1 → 0,97 khi ấn | 120 ms | phản hồi tay, không trang trí |
| Đổi trang trong app | nội dung mới `opacity` 0 → 1, `y 8px` → 0 | 180 ms | không chặn tương tác; không trượt cả màn |
| Thông báo (toast) | trượt lên 12px + hiện | 180 ms vào, 120 ms ra | đã có `role="status"` |
| Ngăn kéo trợ lý | `translateX(100%)` → 0 (máy tính), `translateY(100%)` → 0 (điện thoại) | 240 ms | lớp mờ phía sau chỉ đổi `opacity` |
| Mở rộng dòng sổ / kỳ | dùng `<details>`; nội dung `opacity` 0 → 1 | 180 ms | không animate chiều cao |
| Đồng hồ đếm ngược | đổi số tức thì, mono `tabular-nums` | 0 | **không** nhảy số hay lật; dưới 60 s đổi màu chữ sang đỏ (một lần) |
| Bước trong kỳ (Nộp kín → Mở → Chốt) | thanh bước đổi nền | 400 ms | giống thanh tiến độ của câu chuyện lá thăm |
| Niêm phong thăm thành công | lá thăm thu nhỏ + dấu "ĐÃ NIÊM PHONG" đóng xuống | 400 ms `--ease-stamp` | khoảnh khắc chính của phòng bỏ thăm |
| Hốt / tiền về | số tiền chanh hiện, dấu "ĐÃ HỐT" đóng | 400 ms | khoảnh khắc chính của màn kết quả kỳ |
| Số tiền thay đổi (ô nhập thăm, ước tính) | đổi tức thì | 0 | không đếm chạy (`NumberTicker`) trên số người dùng đang gõ |
| Bảo chứng / thác bù | thanh và vòng đổi bằng `scaleX` / `stroke-dashoffset` | 400 ms | chỉ khi giá trị đổi, không chạy khi tải trang |
| Tải dữ liệu chuỗi | khung xương (skeleton) tĩnh, không nhấp nháy | | nhấp nháy chỉ `opacity` 0,6 ↔ 1, chu kỳ 1,6 s, tắt khi giảm chuyển động |

### B4. Kiểm tra trước khi gộp
- Không phần tử nào animate thuộc tính ngoài nguyên tắc 1 (rà bằng `grep` trong CSS và `style` của component).
- Bật giảm chuyển động: mọi màn vẫn đủ nội dung, Playwright `reducedMotion: 'reduce'` xanh.
- Đo cuộn và thao tác chính (bỏ thăm, chốt kỳ) với CPU chậm 6 lần: không khung hình quá 34 ms.
- Mỗi màn đếm số khoảnh khắc có chủ đích: tối đa một.
