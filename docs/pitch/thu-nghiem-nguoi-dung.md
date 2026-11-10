# Thử nghiệm với người dùng thật (M4, 15 đến 16/11/2026)

Trạng thái: NHÁP chờ Towfienes duyệt. Kế hoạch gốc: [docs/11 mục 11](../11-ke-hoach-trien-khai.md). File này là bản chạy được: buổi 25 đến 30 phút cho 5 đến 10 người, trên web thật và Fuji thật. Số liệu thật chỉ có sau buổi thử; trước đó không được ghi con số nào lên slide (checklist nộp, docs/pitch/hoi-dap.md câu 15).

## 1. Mục tiêu

Trả lời ba câu, bằng quan sát chứ không bằng ý kiến:

1. Người không rành crypto có tự vào dây được không (đăng nhập, vào dây, nộp thăm kín) và mất bao lâu?
2. Họ có hiểu ba khái niệm "tiền giữ lại", "chỉ số bảo chứng", "ai cầm tiền giữa các kỳ" không?
3. Họ có tin câu "chủ hụi không cầm tiền" không, trước và sau khi dùng?

Không đo: hiệu năng, độ đẹp, ý định mua. Đây không phải khảo sát thống kê: với 5 đến 10 người chỉ báo số người (ví dụ 6 trên 8), không báo phần trăm lẻ.

## 2. Người tham gia và chỗ ngồi

- 5 đến 10 người từ đủ 18 tuổi: 2 đến 3 người từng chơi hụi (người nhà của đội), 3 đến 5 sinh viên, 1 đến 2 người trong cộng đồng Team1. Không ai bỏ tiền thật.
- Mỗi dây có 5 ghế, và một ghế do một thành viên đội giữ (đóng vai người bỏ đóng, báo trước với người thử). Vậy mỗi dây nhận tối đa 4 người thử. Hai dây đang `Forming` trên Fuji, nên một lần chạy nhận tối đa 8 người:

| Nhóm | Dây | Địa chỉ | Dùng cho |
|---|---|---|---|
| A (4 người thử + 1 ghế đội) | Bidding φ = 50% | `0xd231db0b842dE1C1B153511618341C659F7f7F29` | Mọi nhiệm vụ ở mục 5 |
| B (4 người thử + 1 ghế đội), nếu có nhiều hơn 4 người | Bidding φ = 0, tiền công 1% mỗi lần hốt | `0x58f60387386a75c29CA281509a818C8a50D8F9E2` | Cùng nhiệm vụ; số trên màn hình khác (docs/03 mục 8 chia 10), người điều phối đọc đúng số trên màn |

Cả hai dây: N = 5, C = 10 USDC, kỳ danh nghĩa 30 ngày, chế độ demo (kỳ 3 phút, thăm [0, 90 giây), mở thăm [90, 150 giây), chốt từ 180 giây, ân hạn 120 giây), giữ lại 20%, ký quỹ 48 USDC, chỉ số bảo chứng 100%. Nguồn: `docs/DEPLOY-FUJI.md` mục 7; đọc lại bằng `bash scripts/demo-check.sh` (11/11/2026: cả hai `Forming`, thành viên 0/5, ký quỹ 48, CI 10000).

Hạn vào dây của cả hai dây là 17/11/2026 17:20 UTC (00:20 ngày 18/11 giờ Việt Nam), nên hai buổi 15 và 16/11 còn nằm trong hạn. Sau hạn dây không nhận thêm người; xem `docs/pitch/van-hanh-demo-day.md` mục 2.

## 3. Chuẩn bị trước buổi (đội làm)

Làm từ T-60 phút, người làm ghi vào cột "Xong" của `docs/pitch/van-hanh-demo-day.md`:

1. `bash scripts/demo-check.sh` không có FAIL; relayer đủ AVAX (cần ≥ 0,02; 11/11 có 0,05).
2. Keeper đang chạy: `KEEPER_INTERVAL_SECONDS=15 pnpm --filter keeper start`, log có `scan done`.
3. Web chạy bản demo: `NEXT_PUBLIC_HUISAFE_DEMO=true HUISAFE_DEMO=true pnpm --filter web build && pnpm --filter web start`, mở được bằng điện thoại 4G.
4. USDC cho từng người thử: mỗi người cần cho phép dây trích tối đa 40,4 USDC (`requiredAllowance` = (N − 1) × (C + cọc) = 4 × 10,1) và đủ số dư để góp bốn lần, nên chuyển sẵn 45 USDC testnet vào ví của họ sau khi họ đăng nhập (kế hoạch gốc ghi 25 USDC cho C = 5; với C = 10 phải là 45). Nguồn USDC: ví M1..M5 của đội (mỗi ví 121,8 USDC theo demo-check 11/11). Người thử không cần AVAX.
5. Lấy địa chỉ ví của người thử: sau khi đăng nhập, mở trang Cài đặt (liên kết ở chân trang) có khung "Địa chỉ ví của bạn" với nút "Sao chép địa chỉ ví", dùng được ở mọi độ rộng kể cả điện thoại; từ màn rộng 640px trở lên, bấm vào địa chỉ rút gọn ở thanh đầu trang cũng sao chép. Hiện thông báo "Đã sao chép địa chỉ ví"; người thử dán vào tin nhắn gửi đội. (Nút này có từ B19; nút chỉ hiện khi web đọc dây thật, không có ở bản dữ liệu mẫu.)
6. Ghế đội: một thành viên đội vào dây bằng tài khoản Privy của họ trên máy riêng; đây là người sẽ rút hết USDC sang ví phụ sau kỳ 1 để diễn tình huống bỏ đóng (chỉ khi cả nhóm đã được báo trước).
7. Chừa ghế và kích hoạt dây (công cụ A20, `docs/DEPLOY-FUJI.md` mục 8b; người duyệt từng lệnh broadcast, chỉ Fuji). Nút "Bắt đầu dây" chỉ chủ hụi bấm được, mà chủ hụi của hai dây này là ví organizer của script, không đăng nhập web được, nên chủ hụi bắt đầu dây bằng script, không bằng web.
   - **Chừa ghế (tùy chọn).** Hai dây hiện 0/5. Muốn ghế đội do ví demo giữ thay vì một tài khoản Privy của đội, đưa đúng M1 vào trước: không có giá trị `DEMO_JOIN` riêng cho dây Bidding, nên dùng `DEMO_MEMBERS=1 DEMO_ACTIVATE=false forge script script/JoinDemoCircles.s.sol --rpc-url fuji` (mô phỏng), duyệt rồi thêm `--broadcast`. Script đưa M1 vào các dây demo nó nhận ra (bằng mã băm thỏa thuận và nhãn); đọc kỹ danh sách dây và việc sẽ làm mà bước mô phỏng in ra trước khi duyệt `--broadcast`, vì chưa kiểm ở đây dây nào được chọn khi dây Fixed cũ đã `Completed` và dây `huisafe-demo-default` cùng mã băm với dây 1. Còn 4 ghế mỗi dây Bidding cho người thử. `DEMO_ACTIVATE=false` để dây không bị kích hoạt khi còn ghế trống hoặc khi người lạ có thể chen vào đúng lúc đó. Chạy lại an toàn khi đã có người thử trong dây: script chỉ đòi M1 nằm trong dây. Nếu người lạ đã chiếm đúng ghế mà M1 cần thì `join` của M1 revert `CircleFull` và lần chạy dừng, nên đưa M1 vào TRƯỚC khi mời người thử.
   - **Hoặc giữ ghế đội bằng Privy** như mục 2 (một thành viên đội vào bằng tài khoản Privy trên máy riêng, bỏ qua bước chừa ghế).
   - **Kích hoạt khi đủ 5 người** (ghế đội và 4 người thử):

   ```bash
   export CIRCLE=0xd231db0b842dE1C1B153511618341C659F7f7F29      # hoặc 0x58f6...F9E2
   forge script script/ActivateDemoCircle.s.sol --rpc-url fuji                 # (a) mô phỏng: tự kiểm trước
   forge script script/ActivateDemoCircle.s.sol --rpc-url fuji --broadcast     # (b) người duyệt
   ```

   `DEMO_ORGANIZER_PRIVATE_KEY` đọc bằng `vm.envUint`, không gõ trên dòng lệnh. Script tự kiểm trước khi gửi và dừng với lý do đọc được: không phải dây của factory (`NotACircle`), khóa không phải chủ hụi (`NotOrganizer`), dây không còn `Forming` (`NotForming`), chưa đủ N người (`NotFull(có, cần)`), quá hạn vào dây (`JoinDeadlinePassed`), chỉ số bảo chứng dưới mức tối thiểu (`CoverageBelowMinimum`). Ví organizer cần ít AVAX (11/11: 0,005 theo lần đọc đầu; đọc lại trước buổi). Phương án thay không cần khóa organizer: một thành viên đội tạo dây mới ngay trên web (màn Tạo dây, nạp ký quỹ 48 USDC, bấm "Bắt đầu dây"); khi đó nhiệm vụ 2 dùng địa chỉ dây mới, và bài thử còn kiểm luôn luồng tạo dây.
8. In hoặc mở sẵn: phiếu đồng ý (mục 4), bảng ghi nhận (mục 7), phiếu khảo sát (mục 8), đồng hồ bấm giờ.

## 4. Đồng ý và dữ liệu

Phiếu đồng ý (giấy hoặc Google Form), người thử đọc và tự tick:

- Mục đích: thử một sản phẩm hụi trên mạng thử nghiệm, người thử không bị đánh giá.
- Đây là mạng thử nghiệm: tiền là USDC thử nghiệm, không có giá trị, không ai bỏ tiền thật.
- Dữ liệu thu: tên gọi do chính họ chọn (không cần tên thật), thời gian thao tác, câu trả lời khảo sát, địa chỉ ví thử nghiệm (đã công khai trên chuỗi), ảnh màn hình không có mặt người.
- Không thu: họ tên thật, số giấy tờ, ngày sinh, nơi ở, số điện thoại, email. Nếu người thử đăng nhập bằng email hoặc số điện thoại thì người điều phối không ghi lại.
- Ghi âm: chỉ khi người thử đồng ý riêng ở một ô tick tách biệt ("Tôi đồng ý cho ghi âm giọng nói trong buổi thử"). Không tick thì chỉ ghi tay. Bản ghi xóa sau 30/11/2026 cùng dữ liệu thô. (Kế hoạch gốc docs/11 mục 11 ghi "không ghi âm"; bản này cho phép ghi âm có đồng ý, Towfienes duyệt chọn một.)
- Rút lui bất cứ lúc nào, không cần lý do; dữ liệu của người đó bị xóa.
- Ảnh nhóm chỉ khi mọi người đồng ý.

## 5. Kịch bản 25 đến 30 phút

| Phút | Việc | Ghi chú cho người điều phối |
|---|---|---|
| 0 đến 3 | Chào, đọc phiếu đồng ý, hỏi điểm tin tưởng trước (câu T0 ở mục 8) | Chưa giải thích sản phẩm |
| 3 đến 7 | Nhiệm vụ 1: đăng nhập | Bấm giờ từ lúc mở link |
| 7 đến 12 | Nhiệm vụ 2: vào dây | Bấm giờ tới "Đã vào dây" |
| 12 đến 15 | Nhiệm vụ 3: đọc chỉ số bảo chứng | Chờ đủ 5 người, đội chuyển 45 USDC |
| 15 đến 16 | Đội kích hoạt dây (mục 3 bước 7) | Kỳ 1 bắt đầu ngay khi kích hoạt |
| 16 đến 21 | Nhiệm vụ 4: nộp thăm kín (trong 90 giây đầu), mở thăm (giây 90 đến 150) | Chuẩn bị sẵn màn Phòng bỏ thăm trước khi kích hoạt |
| 21 đến 25 | Nhiệm vụ 5: xem sổ hụi sau khi kỳ 1 được chốt (từ giây 180, keeper chi trong vài chục giây) | Kỳ sau do keeper chốt, người thử không cần ở lại |
| 25 đến 30 | Khảo sát (mục 8) và phỏng vấn ngắn, ba câu hiểu khái niệm | Chấm ba câu hiểu ngay tại chỗ |

Nếu kỳ 1 kéo dài quá dự kiến, bỏ nhiệm vụ 5 sang sau khi khảo sát; ghi "chưa làm" chứ không bỏ trống.

### Nhiệm vụ

Đọc nguyên văn đề bài, không thêm gợi ý. Mỗi nhiệm vụ có một dấu hiệu "xong" nhìn thấy trên màn hình.

1. **Đăng nhập.** "Mở đường dẫn này và đăng nhập để vào ứng dụng, theo cách bạn thấy quen nhất." Xong: thấy tên dây hoặc nút "Vào dây" ở trạng thái đã đăng nhập (Privy tạo ví tự động, không hỏi AVAX hay cụm từ khôi phục). Đo: giây từ lúc mở link; chọn Google, email hay số điện thoại.
2. **Vào dây φ = 50%.** "Bạn được mời vào dây hụi này (đưa link dây `0xd231db0b842dE1C1B153511618341C659F7f7F29` theo dạng `/moi/<địa chỉ>`). Hãy đọc luật dây và vào dây nếu bạn đồng ý." Xong: "Đã vào dây". Đo: giây từ lúc mở trang mời; có tick ô đủ 18 tuổi không cần nhắc; có mở "Đọc toàn văn thỏa thuận" không; hiện "Khớp thỏa thuận".
3. **Đọc chỉ số bảo chứng.** "Nhìn con số trên màn hình này và nói cho mình biết nó cho bạn biết điều gì." Xong: người thử nói bằng lời. Không đo giờ. Ngay sau đó hỏi ba câu hiểu khái niệm (mục 8, câu H1 đến H3).
4. **Bỏ thăm kín.** "Kỳ này bạn muốn nhận hũ. Hãy nộp mức thăm của bạn sao cho nó được chấp nhận, rồi khi đến lúc hãy mở thăm." Xong: giao diện xác nhận đã nộp thăm, rồi xác nhận đã mở thăm (người điều phối đối chiếu thêm với sự kiện `BidCommitted` và `BidRevealed` trên Snowtrace nếu giao diện chưa rõ). Đo: có nhập thăm vượt trần không (app chặn); có bấm "Sao lưu thăm" không; có bỏ lỡ cửa sổ mở thăm không (mất cọc 1 USDC, ghi vào lỗi); chỗ nào đọc nhầm "thăm".
5. **Xem sổ hụi.** "Hãy tìm xem ai thắng kỳ 1, người đó nhận bao nhiêu, và chủ hụi được trả bao nhiêu." Xong: nói đúng ba thông tin trên bảng sổ hụi hoặc ở màn Kết quả kỳ. Đo: giây tìm ra; có tìm thấy dòng "tiền công trả ngay cho chủ hụi" không.

### Người điều phối nói và không nói

Nói:
- Câu mở: "Mình thử sản phẩm, không thử bạn. Bạn làm sai là lỗi của sản phẩm, không phải của bạn."
- "Bạn cứ vừa làm vừa nói điều bạn đang nghĩ."
- Khi người thử kẹt hơn 30 giây: "Bạn đang tìm gì?" Đó là câu duy nhất được nói trước khi giúp.
- Thang giúp, ghi mức vào bảng: 0 = tự làm; 1 = nhắc bằng câu hỏi trung tính; 2 = chỉ vùng màn hình; 3 = người điều phối làm hộ. Mức 2 và 3 tính là "cần giúp".

Không nói:
- "An toàn", "không rủi ro", "chắc chắn", "đầu tư", "lãi", "bảo hiểm". Chỉ dùng chữ trên giao diện.
- Giải thích "tiền giữ lại", "chỉ số bảo chứng" trước khi hỏi ba câu hiểu khái niệm.
- Chỉ nút phải bấm khi chưa qua mức 1 của thang giúp.
- Mọi từ về ví, AVAX, gas, chữ ký, blockchain, trừ khi người thử nói trước.
- Bình luận đúng sai khi người thử trả lời câu hiểu khái niệm; chỉ nói "cảm ơn".
- Tên người thật của người thử trong bảng ghi; chỉ dùng tên gọi họ tự chọn.

## 6. Ảnh chụp cho pitch (chỉ khi người thử đồng ý)

Màn tạo dây có đồng hồ chỉ số, phòng bỏ thăm, kết quả kỳ, thác bù, sổ hụi. Ảnh màn hình, không có mặt. Đặt tên `thu-<mã người thử>-<màn>.png` trong thư mục `.handover/thu-nghiem/` (nằm ngoài git), xóa sau 30/11.

## 7. Bảng ghi nhận (mỗi người một bảng)

Mã người thử: `____` (tên gọi tự chọn)   Nhóm: A / B   Ngày: ____   Người ghi: ____   Đồng ý ghi âm: có / không

| Nhiệm vụ | Bắt đầu | Xong | Giây | Mức giúp (0-3) | Chỗ vấp (màn, nút, chữ) | Câu nói nguyên văn | Lỗi kỹ thuật |
|---|---|---|---|---|---|---|---|
| 1 Đăng nhập (Google / email / điện thoại) | | | | | | | |
| 2 Vào dây | | | | | | | |
| 3 Đọc chỉ số bảo chứng | | | | | | | |
| 4 Nộp thăm kín | | | | | | | |
| 4 Mở thăm | | | | | | | |
| 5 Xem sổ hụi | | | | | | | |

Lỗi kỹ thuật ghi: relayer lỗi, mở thăm lỗi, mất salt, trễ chốt kỳ (quá 3 phút 30 giây), đăng nhập lỗi, và giờ xảy ra để đối chiếu log.

Ghi chú tổng: ____

## 8. Khảo sát (thang 1 đến 5 và câu mở)

Thang 1 = hoàn toàn không đồng ý, 5 = hoàn toàn đồng ý. Đọc to, không giải thích.

Trước buổi:

- **T0.** "Bạn có tin một người chủ hụi giữ tiền của cả dây sẽ không bỏ trốn không?" (1 đến 5)

Sau buổi:

1. "Mình tự vào được dây mà không cần ai chỉ." (1 đến 5)
2. "Nộp thăm kín và mở thăm là dễ hiểu." (1 đến 5)
3. "Mình tin rằng ở sản phẩm này chủ hụi không cầm tiền." (1 đến 5), rồi hỏi: "Vì sao bạn chọn mức đó?" (mở, ghi nguyên văn)
4. "So với hụi mình từng chơi hoặc nghe kể, mình thấy an tâm hơn." (1 đến 5)
5. "Mình sẽ dùng sản phẩm này cho một dây hụi thật của mình nếu nó chạy trên tiền thật." (1 đến 5)
6. "Điều khó hiểu nhất là gì?" (mở)
7. "Nếu được đổi một điều, bạn đổi điều gì?" (mở)
8. "Bạn đã tin chủ hụi không cầm tiền hơn hay kém đi so với lúc bắt đầu, và vì sao?" (mở; câu hỏi tin tưởng lặp lại để bắt trường hợp điểm số và lời nói lệch nhau)

Ba câu hiểu khái niệm (hỏi ở nhiệm vụ 3 và sau buổi, người điều phối chấm 0 hoặc 1, không sửa đáp án trước khi hết buổi):

- **H1.** "Tiền giữ lại là gì?" Đúng khi nói được: một phần tiền hốt được giữ lại để bù nếu người hốt ngừng đóng, đóng đủ thì nhận lại.
- **H2.** "Chỉ số bảo chứng 100% nghĩa là gì?" Đúng khi nói được: ký quỹ chịu được trường hợp xấu lớn nhất (mọi người đã hốt cùng bỏ đóng một lúc), hoặc ít nhất là "ký quỹ của chủ hụi đủ bù". Sai nếu nói "không bao giờ mất tiền".
- **H3.** "Giữa các kỳ, ai cầm tiền?" Đúng khi nói được: không ai cầm, tiền nằm ở ví từng người cho tới lúc chốt kỳ.

## 9. Tổng hợp thành ba số cho slide

Điền sau khi xong mọi buổi. Chỉ ghi số đo thật; chưa đủ n thì ghi "chưa có".

| Số | Cách tính | Kết quả |
|---|---|---|
| Số 1: tự vào dây | (số người xong nhiệm vụ 1 và 2 với mức giúp 0 hoặc 1) trên (số người thử); trung vị của giây từ mở trang mời tới "Đã vào dây" | __ trên __ người; trung vị __ giây |
| Số 2: hiểu khái niệm | Số người trả lời đúng ít nhất 2 trong 3 câu H1 đến H3, trên số người thử | __ trên __ người |
| Số 3: tin tưởng | Điểm câu T0 trung bình, điểm câu 3 sau buổi trung bình; số người điểm tăng, giữ nguyên, giảm | T0 = __, sau = __; tăng __, giữ __, giảm __ |

Quy tắc dùng:

- Slide ghi số kèm n và nói "mẫu nhỏ, không phải thống kê". Không làm tròn thành phần trăm khi n dưới 20.
- Ba chỗ vấp nhiều nhất và việc đã sửa được ghi cạnh số (docs/11 mục 11 bước 8): chỗ vấp + số người gặp + sửa gì.
- Câu nói nguyên văn dùng trên slide phải được người nói đồng ý và không có tên thật.
- Nếu số 3 giảm hoặc số 2 thấp, vẫn ghi đúng; slide kể điều học được, không giấu.

## 10. Sau buổi

1. Điền mục 9, lưu bảng ghi và khảo sát ở `.handover/thu-nghiem/` (ngoài git).
2. Cập nhật `docs/pitch/hoi-dap.md` câu 15 và `docs/pitch/slide.md` phần "người dùng thật thử" bằng số thật, đổi dòng "chưa có số" tương ứng.
3. Xóa dữ liệu thô và ghi âm sau 30/11/2026.

## Nguồn

- Kế hoạch và chỉ số đo: `docs/11-ke-hoach-trien-khai.md` mục 11 (ba câu hiểu, điểm tin tưởng trước và sau, không thu số giấy tờ).
- Dây, địa chỉ, tham số: `docs/DEPLOY-FUJI.md` mục 7; `contracts/deployments/fuji.json`; đọc lại bằng `scripts/demo-check.sh` và `cast call` chỉ đọc ngày 11/11/2026 (hạn vào dây, số thành viên, `requiredAllowance` = 40.400.000 đơn vị).
- Cửa sổ kỳ demo: `docs/03-dac-ta-giao-thuc.md` mục 3.3.
- Chủ hụi của dây do script tạo, kích hoạt: `contracts/script/JoinDemoCircles.s.sol` (đầu file), `docs/03` mục 4 (chỉ chủ hụi `activate`).
- Chữ cấm và câu cam kết: `docs/03` mục 7.3, `docs/10`.
