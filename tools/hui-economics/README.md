# hui-economics: máy tính dòng tiền HụiSafe

Mô hình số nguyên của một dây hụi, tính đúng như contract: chia làm tròn xuống, thác bù, thứ tự hoàn, lãi chậm góp tính theo từng phần. Dùng để tối ưu hoa hồng và làm số liệu cho báo cáo `docs/BAO-CAO-LEADER-09-11.md`. Chỉ cần Python 3, không cần thư viện ngoài.

| File | Việc |
|---|---|
| `hui_engine.py` | Mô hình một dây: `settle`, `pay_late`, `mark_default`, `finalize` |
| `schedules.py` | Thêm cách tính hoa hồng "nằm trong trần lãi" (φ) và hàm đánh giá: lời của chủ hụi sau rủi ro, lời lỗ từng vị trí, lãi thực của người hốt đầu |
| `validate.py` | Kiểm mô hình với các con số mà `contracts/test/integration/WorkedExample.t.sol` khẳng định. Phải in `TẤT CẢ KHỚP` |
| `sybil.py` | Tấn công 1 và 2 ví ảo của chủ hụi |
| `final_tables.py` | Bảng cấu hình theo chu kỳ, so sánh cách tính hoa hồng, độ nhạy theo α và mức góp |
| `weekly_report.py` | Mô phỏng dây 5 người góp 1 triệu: tuần, biến thể bỏ chạy, tháng |

```bash
cd tools/hui-economics
python3 validate.py       # luôn chạy trước
python3 sybil.py
python3 final_tables.py   # khoảng 1 phút
python3 weekly_report.py
```

Giả định (ghi rõ trong báo cáo): mỗi kỳ người thắng thăm bằng 50% mức được phép; rủi ro bỏ đóng theo Klonner & Rai (2,04% với người hốt nửa đầu, 0,59% với nửa sau, bỏ ngay sau khi hốt). Đây là mô phỏng để chọn tham số, không phải dự báo. Cách tính hoa hồng "trong trần" và chia quỹ dự phòng theo số kỳ đúng hạn là đề xuất; contract chưa có.
