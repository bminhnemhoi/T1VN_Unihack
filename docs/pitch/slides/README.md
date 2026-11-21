# Slide nộp bài HụiSafe (UniHack 2026)

Bộ slide v2 (21/11/2026): 26 trang, gồm 21 trang chính và 5 trang phụ lục. Mỗi trang có logo HụiSafe ở góc trái và
cụm "UniHack 2026 · Team1 Vietnam" ở góc phải; mỗi con số có nguồn ở phụ lục A (báo chí, thị trường) và B (repo).

| File | Dùng làm gì |
|---|---|
| `HuiSafe-UniHack-2026.pptx` | Bản gốc. Chữ là text box thật, có ghi chú người nói ở từng trang |
| `HuiSafe-UniHack-2026.pdf` | Bản đọc nhanh, dự phòng khi không mở được Google Slides |
| `preview/slide-01.png` … `slide-26.png` | Ảnh từng trang (1600 × 900) |
| `build/` | Script dựng lại: biểu đồ, mockup giao diện, ảnh cắt bài báo, bộ slide |

## Đưa lên Google Slides để nộp

1. Tải `HuiSafe-UniHack-2026.pptx` lên Google Drive, bấm chuột phải, chọn "Mở bằng" rồi "Google Trang trình bày".
   Font Inter Tight và IBM Plex Mono có sẵn trên Google Slides.
2. Bấm "Chia sẻ", ở "Quyền truy cập chung" chọn "Bất kỳ ai có đường liên kết", vai trò "Người xem", rồi sao chép link.
3. Mở link trong tab ẩn danh (chưa đăng nhập Google) và lật hết 26 trang trước khi dán vào form.
4. Khi đã có link video demo công khai: điền `VIDEO_URL` ở đầu phần slide của `build/build_deck.py` rồi dựng lại; trang
   Đội sẽ có thêm mã QR thứ tư. Để trống thì trang đó không có chỗ trống nào.

## Dựng lại

```bash
pip install -r docs/pitch/slides/build/requirements.txt
python docs/pitch/slides/build/build_charts.py     # assets/charts/*.png từ sim/outputs và assets/charts/data.json
python docs/pitch/slides/build/build_mockups.py    # assets/mock/*: khung trình duyệt, điện thoại, ảnh cắt bài báo
python docs/pitch/slides/build/build_deck.py       # HuiSafe-UniHack-2026.pptx
```

Xuất PDF và ảnh xem trước: mở file bằng PowerPoint rồi "Lưu thành PDF", hoặc chạy `build/render.sh` (LibreOffice
trong Docker, cần hai font trên).

## Nguồn ảnh

- Ảnh giao diện trong `build/assets/screens/live/` chụp từ bản đang chạy ngày 21/11/2026; ảnh trong
  `build/assets/screens/` là dữ liệu mẫu theo ví dụ ở docs/03 mục 8.
- Ảnh cắt bài báo trong `build/assets/news/raw/` chụp ngày 21/11/2026 từ trang gốc; đường dẫn từng bài ở phụ lục A của
  slide và trong `build_deck.py` (`CASES`). Chỉ cắt phần tên báo, tiêu đề và đoạn mở đầu, không dùng ảnh nhân vật.
- Ảnh chợ Bến Thành: giấy phép và tác giả ghi ở `build/assets/photos/CREDITS.md`.
- Ảnh thành viên trong `build/assets/team/` do các thành viên cung cấp.
