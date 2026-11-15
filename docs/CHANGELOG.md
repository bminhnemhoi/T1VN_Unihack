# Nhật ký thay đổi

Ghi những gì người dùng và giám khảo thấy được trên web (tính năng, sửa lỗi, bản chạy công khai). Mới nhất ở trên. Chi tiết kỹ thuật và số test nằm ở [TIEN-DO.md](TIEN-DO.md); lịch sử đầy đủ trong `git log`.

## 15/11/2026

### Sửa lỗi
- Con dấu **ĐÃ TẠO DÂY** không còn bị lẹm mép trái ở màn tạo dây xong.
- Dây bị hủy (không đủ người trước hạn) không còn hiện "Đã xong". Tổng quan ghi **ĐÃ HỦY**, nêu lý do, nhắc rút ký quỹ nếu còn, và không đếm dây đó vào "Dây đang chơi".
- Rê chuột vào hàng trong danh sách dây ở Tổng quan không còn tràn ra ngoài góc bo.
- Thanh trên của app trên điện thoại (360 tới 414px) gọn một hàng: logo, chip DEMO, trợ lý, số dư, đăng xuất, cài đặt. Chip rút thành "DEMO" dưới 400px, số dư hiện số USDC nguyên.
- Landing và app không còn bị chữ chồng lên nhau khi phóng to trình duyệt (200%, 300%) hay tăng cỡ chữ trình duyệt: bong bóng chat ở hero chảy theo luồng, cỡ chữ landing tính theo rem, thanh điều hướng tự xuống dòng khi chật.

### Thêm: chuyển động ở landing
- Logo lá thăm ở hero được "niêm phong" một lần khi vào trang: phong bì trượt vào, nắp gập xuống, con dấu xanh cộp xuống (dưới 1 giây). Vòng chữ quanh logo xoay chậm và dừng khi khuất hoặc khi tab ẩn. Giảm chuyển động thì hiện sẵn bản hoàn chỉnh.
- Sáu thẻ **Công nghệ** hiện lần lượt khi cuộn tới, icon vẽ nét. Có dải tên công nghệ (Avalanche, Circle USDC, Privy, OpenZeppelin, Foundry) và một câu "Vì sao chọn" ở mỗi thẻ.

### Đổi: chữ Việt và Anh cân bằng
- Thuật ngữ công nghệ giữ tiếng Anh (blockchain, on-chain, smart contract, hash, relayer, wallet), từ vựng hụi giữ tiếng Việt (dây, hốt, bỏ thăm, ký quỹ, kỳ, ân hạn).

### Thêm: hướng dẫn cho người mới
- Ngay sau lần đăng nhập đầu tiên, nếu ví chưa ở dây nào, app hỏi hai câu: bạn từng chơi hụi chưa, và bạn vào HụiSafe để làm gì. Người mới nghe tới hụi được xem 4 thẻ giải thích (hụi là gì, bỏ thăm, hụi truyền thống sợ gì, HụiSafe khác ở đâu); người đã chơi xem 3 điểm khác. Cuối cùng là hướng dẫn 4 chỗ chính của app và nút đi tiếp theo câu trả lời: dán link mời, mở dây đầu tiên, hoặc xem dây mẫu.
- Ví chưa có USDC thử nghiệm thì màn cuối chỉ chỗ lấy miễn phí 20 USDC ở faucet.circle.com.
- Có nút **Bỏ qua** và phím Esc. Câu trả lời chỉ lưu trên máy này, không gửi lên máy chủ. Mở lại ở **Cài đặt → Xem lại hướng dẫn**.

### Thêm: nhãn DEMO gọn thay dải đen
- Dải demo đen ở trên cùng không còn. Thay vào đó là chip **DEMO · Fuji** ngay sau logo, trên landing và app. Bấm chip để đọc: đây là bản chạy thử trên Avalanche Fuji, tiền là USDC thử nghiệm, 1 kỳ = 3 phút, ân hạn 2 phút.
- Hai nút "Thử: mạng" và "Tua nhanh" của bản xem thử chuyển sang **Cài đặt → Công cụ demo** (và vẫn nằm trong cửa sổ của chip khi xem dữ liệu mẫu).

### Thêm: cài HụiSafe như một app trên điện thoại
- Có manifest và biểu tượng, nên Chrome (Android) và Safari (iPhone) cho thêm HụiSafe vào màn hình chính, mở toàn màn hình ở danh sách dây.
- Gợi ý cài hiện một thẻ nhỏ trên thanh menu, chỉ trên điện thoại và chỉ sau một việc thành công (vào dây, tạo dây, nộp thăm) hoặc lần ghé thứ hai ở ngày khác. Không hiện trên landing, giữa lúc đang gửi giao dịch hay đang xem hướng dẫn. Bấm "Để sau" thì 14 ngày sau mới hỏi lại, tối đa 3 lần. Android bấm "Thêm" là cài; iPhone hiện hướng dẫn nút Chia sẻ.
- Chưa có chế độ ngoại tuyến: app không lưu số dư hay kỳ hụi cũ trong máy.

### Đổi: menu nổi trên điện thoại, Tổng quan dễ đọc hơn
- Thanh menu dưới thành một viên thuốc kính mờ nổi lên trên nội dung, một viên nền mực trượt theo mục đang chọn.
- Tổng quan: nhãn viết thường dễ đọc ("Bạn đã góp", "Dây đang chơi"), số lớn hơn kèm đơn vị USDC ngay cạnh, ô "việc gấp nhất" gọn hơn. Chữ mono chỉ còn cho địa chỉ ví, mã giao dịch, đồng hồ đếm ngược và số trong bảng sổ hụi.

### Đổi: landing viết lại
- Hero nói rõ HụiSafe là hụi chạy bằng smart contract trên Avalanche, và đăng nhập bằng Google hoặc email là đủ, không cần ví crypto hay AVAX.
- Phần "Một kỳ hụi" giải thích thăm kín được băm rồi mở ra thế nào và kỳ được chốt ra sao.
- Hàng câu hỏi chuyển xuống thành mục lục bấm được ở phần Tình huống. Các ô tình huống viết lại cho rõ.
- Phần mới **Công nghệ** (smart contract, USDC, ví Privy, commit-reveal, test và kiểm toán, trợ lý AI chỉ tính).
- Logo mới: phong bì lá thăm với con dấu xanh chữ U, kèm chữ HụiSafe.

## 14/11/2026

### Thêm: hiện số dư ví
- **Thanh trên cùng của app** (mọi màn trừ landing): khi đã đăng nhập, cạnh địa chỉ ví có ô **số dư USDC** (làm tròn xuống tới 0,01). Bấm vào ô này để mở phần chi tiết ở Cài đặt. Trên điện thoại ô số dư vẫn hiện.
- **Cài đặt → Số dư ví** (`/cai-dat#so-du`): USDC chính xác tới 6 chữ số thập phân và AVAX (tối đa 4 chữ số, làm tròn xuống). Ghi rõ "Không cần AVAX: phí mạng do HụiSafe trả". Ví có 0 USDC thì hiện hướng dẫn lấy 20 USDC thử nghiệm ở faucet.circle.com (Avalanche Fuji).
- Số dư đọc thẳng từ chuỗi Fuji (`USDC.balanceOf` và số dư AVAX của ví), tự làm mới theo chu kỳ của web (10 giây ở chế độ demo) và giữ số cũ trong lúc làm mới. Đủ trạng thái: đang đọc (khung chờ), đọc lỗi (nút "Đọc lại số dư"), có số.
- Chỉ đọc, không ký và không gửi giao dịch nào. Code: `apps/web/lib/live/useWalletBalance.ts`, `apps/web/components/app/AppFrame.tsx` (`WalletBalanceChip`), `apps/web/components/settings/SettingsView.tsx` (`WalletBalanceBlock`), `formatAvax` trong `apps/web/lib/money.ts` (có test).

## 13/11/2026

### Web chạy công khai
- Địa chỉ: https://lamng.tail3abf4e.ts.net:8443 (VPS của đội, Docker: 1 web + 1 keeper chốt kỳ mỗi 15 giây, Tailscale Funnel). Hướng dẫn: [HOSTING.md](HOSTING.md).
- Đăng nhập Privy bằng Google hoặc email chạy trên địa chỉ công khai; ví nhúng tự tạo, người dùng không cần AVAX.
- Trợ lý chủ hụi chạy bằng model thật (`ag/gemini-3.8-flash` qua 9router).

### Sửa
- Trang trắng khi bấm đăng nhập (vòng cập nhật giữa Privy và web).
- Tạo dây báo "Dịch vụ chưa được cấu hình" trên bản công khai (relay thiếu App ID Privy lúc chạy).
- Trang Sổ hụi của dây thật báo lỗi 500.
- Hero của landing trên điện thoại: ba tin nhắn trong nhóm hiện lại, tiêu đề và logo to hơn, con dấu nằm cạnh dòng "giựt.", hai nút chính rộng hết màn hình. Nút "Mở app" không còn bị lệch lên trên (cả máy tính).
- Thử lại "Tạo dây" sau khi nạp ký quỹ lỗi giờ nạp vào đúng dây vừa tạo, không tạo dây thứ hai.

### Giao diện mới của web app
- Dựng lại theo bản bấm thử đã duyệt: Tổng quan, Dây (thanh kỳ, biên lai, phòng bỏ thăm), Sổ hụi, Dây mới (6 câu hỏi) và mọi trang phụ. Nút giao dịch hiện từng bước Ký → Gửi → Xác nhận.
- Chuyển động mượt hơn và nhẹ hơn trên điện thoại; tắt hết khi bật chế độ giảm chuyển động.
