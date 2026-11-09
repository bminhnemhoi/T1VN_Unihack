# Tham khảo bố cục landing và dashboard (09/11/2026)

Mục đích: học cách các sản phẩm hụi/ROSCA và fintech sắp xếp trang để trùng tu giao diện HụiSafe (giữ nhận diện "Sổ hụi", dựng lại bố cục). Chỉ học cấu trúc và nhịp; không lấy logo, hình, chữ, màu nhận diện.

## Cách làm và giới hạn
- Chụp bằng `playwright-cli` (headless) ở **1440 x 900, 768 x 1024, 390 x 844**, ảnh full-page cuộn để nạp ảnh lazy, kèm `snapshot` cấu trúc a11y. Ảnh và JSON thô nằm ở `.handover/refs/<site>/` (git-excluded, không đưa vào repo).
- Trích màu, font, khoảng cách bằng `dembrandt --json-only` (computed CSS) cho 4 site hụi. Mercury, Wise đã đo từ 08/11 (xem `apps/web/DESIGN.md` mục 1); Monzo đã chụp nhưng **chưa phân tích**.
- Đã xem ảnh 1440 của 7 site. Ảnh 390 và 768 đã chụp đủ nhưng mới dùng để kiểm cỡ, chưa đọc kỹ từng phần.
- Chụp Mercury bị lỗi một phần (trang cuộn theo kịch bản, ảnh 1440 rộng 3431 px, nhiều vùng tối trống): chỉ dùng phần đầu trang.
- Dashboard thật nằm sau đăng nhập nên **không xem được**; phần dashboard dưới đây suy ra từ ảnh màn hình sản phẩm đặt trên trang công khai.
- Nhãn: **[Quan sát]** là thấy trên ảnh hoặc số đo; **[Suy luận]** là ý tôi rút ra.

## Từng site

### roscash.org (ROSCA có đấu giá, USDC, sát HụiSafe nhất)
- [Quan sát, dembrandt] nền ấm `#f5f3ee`, chữ `#0b0f14`, nhấn xanh `#0088cc` và xanh lá `#16a34a`; font Geist Sans + Geist Mono; tiêu đề 56 đến 60px, weight 600, tracking -2.24px; thang 4px; bo 4 đến 10px; nút chữ nhật bo nhẹ.
- [Quan sát, bố cục] hero bằng **ví dụ cụ thể** ("4 người x 25 USD mỗi tuần, mỗi tuần một người nhận 100 USD"), hai thẻ lựa chọn nhỏ ("cần tiền ngay" / "chờ đến lượt"), **một** nút chính + một liên kết chữ ("có mã mời"), điện thoại bên phải. Sau đó: "Hoạt động thế nào" bằng khung sản phẩm, "Một tháng trong dây" 3 thẻ nhỏ, 3 thẻ giải thích (tiền nằm ở đâu, lúc nhận tiền, nếu có người lỡ góp), máy tính có thanh trượt, giới thiệu người sáng lập, footer gọn.
- Học: hero mở bằng một ví dụ số; một hành động chính; có thẻ nói thẳng chuyện "nếu có người lỡ góp". Không lấy: xanh dương, ảnh và lời của người sáng lập, thống kê.

### thesusu.app
- [Quan sát, dembrandt] nền `#fbfaf7`, chữ `#141412`, nhấn vàng `#ffd000`; Bricolage Grotesque weight 800 (hero 112px, line-height 0.94, tracking -5px) + JetBrains Mono cho nhãn nhỏ.
- [Quan sát, bố cục] hero chữ rất lớn + điện thoại + đĩa vàng; dải tên gọi hụi khắp thế giới; "Mọi người góp, một người nhận, rồi đến lượt" bằng vòng avatar quanh số tiền + 3 bước đánh số; "Vòng hụi của bạn thấy gì" 3 điện thoại (thứ tự nhận, theo dõi khoản chi, tìm dây); thẻ **phí như biên lai** (pot, phí nền tảng, phí xử lý, bạn nhận); khối an toàn có 6 mục; FAQ hai cột (tiêu đề bên trái, danh sách bên phải); CTA cuối nền đen.
- Học: bố cục **tiêu đề trái, nội dung phải** cho FAQ và niềm tin; **thẻ biên lai** cho phí (rất hợp thác bù và dòng chi của HụiSafe); thứ tự nhận hiển thị như danh sách có dòng nổi bật. Không lấy: vàng, font nén đậm, avatar hoạt hình, logo.

### cosayv.com
- [Quan sát, dembrandt] nền `#f4f7f5`, chữ `#0d1f17`, xanh `#1a6b4a`, vàng nhấn `#d4a017`; Plus Jakarta Sans 800 (60px); thang 8px; bo 18 và 22px.
- [Quan sát, bố cục] hero + điện thoại ví; **dải xanh đậm** chứa các chip niềm tin; 3 thẻ "hai cách tiết kiệm"; lưới 6 thẻ "tin cậy do thiết kế"; phần 4 bước nền xanh đậm kèm điện thoại; ví và phí; quốc gia; khung CTA; footer có **đoạn miễn trừ pháp lý** dài.
- Học: xen kẽ nền sáng và nền tối để tạo nhịp; 4 bước có hình sản phẩm bên cạnh; footer pháp lý rõ. Không lấy: xanh lá, hình ví, lưới 6 thẻ giống nhau (DESIGN.md cấm).

### huio.vn (phần mềm sổ hụi Việt Nam)
- [Quan sát, dembrandt] Be Vietnam Pro weight 800 (hero 68px), cam `#ee6b45`, chữ `#1c1a15`, các dải lavender và kem.
- [Quan sát, bố cục] hero + điện thoại; 4 thẻ tính năng viền dày; "4 bước"; băng chuyền màn hình app (danh sách hụi, tiến độ, tài chính); bảng giá 4 gói; hàng tuân thủ NĐ 19; FAQ dạng hỏi đáp; CTA nền tối.
- Học: giọng Việt gần gũi; liệt kê tuân thủ NĐ 19 thành **hàng gọn**; FAQ viết bằng câu người chơi hay hỏi; màn hình danh sách hụi có thanh tiến độ. Không lấy: mascot, cam, minh họa pastel, bảng giá.

### moneyfellows.com/en-us
- [Quan sát] hero xanh dương phủ kín chỉ có logo; các hàng xen kẽ ảnh và chữ; khối "Xây trên niềm tin" với logo cơ quan quản lý; đánh giá người dùng; blog; thanh tải app.
- Học: **khối niềm tin nêu cơ quan quản lý** (HụiSafe thay bằng NĐ 19 và hợp đồng công khai). Không lấy: xanh dương, ảnh người, mẫu hero trống.

### Mercury, Wise, Monzo
- Mercury (chỉ phần đầu trang xem được): hero một câu, ô email + hai nút. Wise: **máy tính ngay trong hero** (số gửi, số nhận, phí). Monzo: đã chụp, chưa phân tích. Số đo của Mercury, Wise ở DESIGN.md mục 1.
- Học: sản phẩm làm hero (thẻ chỉ số bảo chứng sống của HụiSafe đúng tinh thần này). Không lấy: chữ in hoa nén của Wise, lime, ảnh phong cảnh của Mercury.

## Dashboard: điều quan sát được trên ảnh sản phẩm
- [Quan sát] thesusu: thẻ dây có thanh tiến độ, danh sách thứ tự nhận với dòng "kỳ này" nổi bật, số tiền lớn ở đầu. cosayv: thẻ số dư lớn + hàng nút hành động + giao dịch gần đây. huio: danh sách hụi kèm tiến độ và số tiền theo kỳ, 4 tab đáy. roscash: danh sách dây + thẻ "bước tiếp theo".
- [Suy luận] mẫu chung: một con số chính ở đầu, một hành động kế tiếp rõ, danh sách dây dạng hàng có trạng thái, thứ tự nhận hiển thị như tiến trình. Hợp với tổng quan 4 chỉ số + danh sách dây của HụiSafe.

## Mẫu rút ra cho HụiSafe (quyết định)
1. Hero mở bằng ví dụ số thật của dây (docs/03 mục 8), không khẩu hiệu trừu tượng.
2. Một nút chính, một liên kết chữ phụ.
3. Xen kẽ phần giấy sáng và phần mực đêm để tạo nhịp, mỗi phần một ý.
4. Hai cột "tiêu đề trái, nội dung phải" cho FAQ và niềm tin.
5. Thẻ biên lai cho thác bù và tiền công (tái dùng `Waterfall`).
6. Hình sản phẩm là UI thật (bảng Sổ hụi), không minh họa.
7. Nhịp khoảng cách: thang 4 và 8px (dembrandt, 3 trong 4 site); khoảng giữa các phần khoảng 100 đến 140px ở 1440 [Suy luận từ ảnh, chưa đo].

## Không lấy
Logo, ảnh, minh họa, mascot, câu chữ, màu nhận diện của mọi site trên.
