# Nhật ký thay đổi

Ghi những gì người dùng và giám khảo thấy được trên web (tính năng, sửa lỗi, bản chạy công khai). Mới nhất ở trên. Chi tiết kỹ thuật và số test nằm ở [TIEN-DO.md](TIEN-DO.md); lịch sử đầy đủ trong `git log`.

## 20/11/2026

### Sửa lỗi từ đợt kiểm thử của Hiếu (B29)
- **Ô bỏ thăm không còn đọc sai dấu chấm** (issue #10): trước đây gõ `14.8` bị hiểu thành 148 USDC (dấu chấm bị xóa), có thể niêm phong thăm lớn gấp 10 lần ý định. Giờ dấu chấm là dấu thập phân, và dưới ô hiện dòng "Bạn sẽ niêm phong thăm: X USDC" để thấy đúng số trước khi bấm.
- **Trang tạo dây**: gõ mức góp `1.000` trước đây phần xem trước hiểu 1.000 USDC nhưng lệnh tạo dây gửi 1 USDC; giờ hai bên dùng chung một con số.
- **Khui kỳ ngay lúc 00:00 không còn báo "Chưa đến thời điểm"** (issue #11): đồng hồ trên màn hình có thể chạy trước giờ khối Fuji 2 đến 5 giây; app tự gửi lại đúng chữ ký đã ký sau vài giây, không bắt ký lại.
- **Keeper công bằng hơn** (PR #3, issue #1, #2): dây đã có ký quỹ luôn được keeper xem, không bị dây rác mới hơn chen mất; dây dọn hụt không bị bỏ qua vĩnh viễn. Trang lời mời tải nhanh hơn (đọc uy tín song song).

### Chủ hụi cầm nhịp, sổ hụi đúng sau tất toán, ký gọn mà an toàn (B28)
- **Sổ hụi đúng sau khi dây kết thúc**: dây vỡ nợ thật trên Fuji giờ hiện ký quỹ 48 → 46 → 36 → 26 → 16, kỳ 2 của M4 "bù 8 từ tiền giữ lại + 2 từ ký quỹ", bảo chứng lúc mở 100%; bỏ dòng "khoản đòi công khai" sai (không thành viên nào bị nhận thiếu), thay bằng "M4 còn nợ 32 USDC đã được ký quỹ chủ hụi bù". Trước đó trang đọc số "còn phải hoàn" nên hiện 32, 30, 20, 10, 0 và bảo chứng 20%.
- **Chủ hụi cầm nhịp**: hết giờ mở thăm, dây dừng ở "Chờ chủ hụi khui". Chủ hụi có **bàn khui kỳ** (ai hốt, nhận bao nhiêu, ai đủ hay thiếu tiền), có thể chờ người thiếu nạp tiền rồi bấm "Khui kỳ k, mở kỳ k+1". Quá 5 phút (demo) hoặc 24 giờ (bản thật) mà chủ hụi chưa khui thì keeper hoặc thành viên khui thay, nên chủ hụi không giữ dây làm con tin được. Chủ hụi giữ một chân thì không có lượt ưu tiên.
- **Bỏ thăm khi ví ít tiền**: không còn bị chặn (người kẹt tiền là người cần hốt nhất); chỉ cần đủ cọc mở thăm, kèm cảnh báo số tiền cần nếu không thắng. Thẻ **"Kỳ này của bạn"** cho thấy kỳ này cần đóng bao nhiêu, ví có bao nhiêu, quyền trích còn bao nhiêu.
- **Trang mời rõ hơn**: 40,40 USDC là mức trích tối đa cho cả dây, không phải số bị trừ ngay; báo trước "Bạn sẽ là người thứ N" và ý nghĩa với dây cố định hay bỏ thăm.
- **Ký gọn**: ví Privy ký không bật hộp riêng khi yêu cầu đúng là của HụiSafe (đúng hàm, đúng dây do factory tạo, hạn ngắn, quyền trích trong mức); lệch bất kỳ chỗ nào thì vẫn hiện hộp Privy. Đã qua kiểm toán bảo mật (0 Critical, 0 High; lỗi Medium và Low đã sửa).
- **Cột "Ròng"** trong sổ hụi của dây đã kết thúc, cùng số với trang Tất toán.
- **Máy dò số liệu** `pnpm --filter web probe:fuji`: mở sổ hụi các dây thật trên Fuji và so từng ô với chuỗi, chạy trước khi quay video.

## 18/11/2026

### Chuẩn hoá Runtime, Ký không rớt mạng, Khóa ví 0đ & Bàn đấu thăm trực tiếp (B27)
- **Ký một lần, tự retry không bắt ký lại**: tầng gửi `/api/relay`, `/api/relay/permit` và `/api/attest` tự thử lại 3 lần (`0 / +250 / +600 ms`) khi kết nối đổi nhịp ngay sau lúc ký ví nhúng Privy; kèm bộ đệm chữ ký 90 giây trên trình duyệt để bấm *Gửi lại* sau khi mất mạng không bật lại hộp ký lần 2, chặn lỗi giả `AttestationUsed` khi vào dây, và lưu kép mã bí mật mở thăm (`IndexedDB` + `localStorage` dự phòng).
- **Đồng hồ chuẩn chuỗi & Nhịp Demo 2 phút không khoảng chết**: đồng bộ trực tiếp `block.timestamp` từ Fuji (`useChainClock`), xoá lỗi trừ kép làm đồng hồ nhảy giật, giảm chu kỳ làm mới phòng hụi xuống 4 giây, chuyển pha đúng giây `00:00`, và chỉnh cấu hình Demo cho dây mới thành `120 giây = 75 giây nộp thăm kín + 45 giây mở thăm` (0 giây chờ chết, ân hạn 60 giây).
- **Keeper tự động khui & tất toán sau 1–3 giây, tách chuẩn 4 vai trò**: Keeper đặt hẹn giờ thức dậy sát `deadline + 1s` để tự động khui kỳ và tự động tất toán cuối dây (`finalize`); ẩn nút *Chốt kỳ* ở màn hình Con hụi (chỉ hiện cứu hộ nếu Keeper trễ > 30 giây), Chủ hụi đứng ngoài quản lý không còn bị hiện ô gõ thăm mà có **Bàn giám sát Chủ hụi** riêng + nút phụ *Khui kỳ ngay*, thành viên đã hốt thấy thẻ nghĩa vụ góp & hoàn tiền giữ lại, và Kỳ cuối (`k = N`) có giao diện nhận trọn không đấu thăm.
- **Bộ khóa 3 lớp chống ví 0 USDC / nợ xấu & Bàn hụi nhiều người chơi**: chặn cứng ví thiếu tiền kỳ đầu (`< C + cọc thăm`) và ví đang vỡ nợ chưa trả ngay tại `/api/attest` kèm hộp hướng dẫn nhận Faucet ở trang mời, chặn tạo dây khi Chủ hụi thiếu tiền ký quỹ, gắn nhãn kiểm tra đủ tiền kỳ 1 cho từng ghế ở màn gom người + nút Chủ hụi tự tham gia 1 chân, chặn bỏ thăm khi ví dưới `1 phần góp C`; bổ sung bảng trạng thái trực tiếp (`Phong bì #1`, `Cao nhất`), 4 chip chọn nhanh mức thăm (`25% / 50% / 75% / Kịch trần`), công tắc **Tự động mở thăm khi tới giờ** và dải thông báo người vừa thắng kỳ trước.

### Sửa lỗi và tối ưu giao diện, chuyển động, trợ lý AI (B26)
- **Trợ lý AI nhanh và bền mạng hơn**: tối ưu lời gọi mô hình (`reasoning_effort: low` trên cổng OpenAI-compatible, giảm thời gian phản hồi từ ~20–28 giây xuống ~4 giây), sửa bộ kiểm tra đầu ra không từ chối nhầm `figures` kèm đơn vị (`%`, `USDC`) hay lời chào mở đầu, giữ nhịp kết nối stream và tự động thử lại khi mạng đổi nhịp (`ERR_NETWORK_CHANGED`), bổ sung nút **Thử lại** / **Mở Máy tính** ngay trên bong bóng lỗi cùng phím `Enter` để gửi nhanh.
- **Nút địa chỉ ví trên thanh đỉnh**: thay nút trống không icon (bị ẩn chữ ở màn hình 761–1180px do dùng chung lớp `.lbl`) bằng pill địa chỉ ví rõ ràng (`0xa4DC…e1A8` + chấm trạng thái + icon sao chép đổi sang dấu tích xanh khi đã chép), hiển thị xuyên suốt mọi cỡ tablet và máy tính mà không tràn hàng.
- **Mở lối xem dây thật khi chưa đăng nhập**: trên bản chạy Fuji, màn Tổng quan lúc chưa đăng nhập có nút mở xem ngay dây thật trên Fuji, hai tab **Dây** và **Sổ hụi** mở thẳng dây mẫu Fuji thay vì đứng yên, và đường dẫn "Xem dây mẫu" ở trang Đăng nhập không còn quay vòng về màn đòi đăng nhập.
- **Ngăn kéo Trợ lý AI trên máy tính**: trượt ngang mượt từ cạnh phải thay vì bay chéo từ góc dưới-phải; trên điện thoại vẫn trượt từ dưới lên.
- **Cài đặt "Chữ lớn"**: phóng chữ thực sự trên cả các trang phụ (`.pg`) lẫn 4 màn chính của app (từ 16 lên 22 điểm) mà không làm vỡ thanh trên trên điện thoại 360px.
- **Landing và chuyển động GSAP**: nới khoảng cách dòng tiêu đề để các dấu chồng tiếng Việt (*ộ/ế*, *g/ự*) không chạm nhau ở mọi cỡ chữ; bong bóng tin nhắn trên điện thoại không còn lẹm mép trái lúc trượt vào; nhịp mở màn → niêm phong logo gọn hơn (~3,2 giây), bấm phím `Esc` bỏ qua được màn mở đầu; thêm hiệu ứng GSAP tinh gọn cho dải chia quỹ dự phòng và các thẻ tương tác; đồng bộ thanh tiến độ `1. Ký → 2. Gửi → 3. Xác nhận` kèm vòng xoay cho trang mời và các trang phụ.

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
