# Pháp lý và tuân thủ

## Mục đích và đọc khi nào

File này nói HụiSafe đứng ở đâu trong luật Việt Nam (hụi, hình sự, tiền mã hóa, dữ liệu cá nhân, AI) và mỗi quy định được đáp ứng thế nào trong code hoặc UI. Đọc khi đổi luật vận hành (đối chiếu `docs/03`), khi làm màn hình đồng ý, sổ họ, cảnh báo, khi viết slide "Luật Việt Nam" và khi chuẩn bị câu hỏi cho luật sư. Văn bản kiểm tra ngày 06/11/2026; nguồn ở `docs/13-tai-lieu-tham-khao.md`.

> **Lưu ý.** Đây là thông tin pháp lý tham khảo do nhóm sinh viên tổng hợp, không phải tư vấn pháp luật. Mọi diễn giải cần luật sư có chứng chỉ hành nghề xác nhận trước khi dùng ngoài môi trường thi. "Cần kiểm tra" là chưa xác minh được.

## 1. Hụi hợp pháp: BLDS 2015 Điều 471, NĐ 19/2019

Điều 471 Bộ luật Dân sự 2015 coi họ, biêu, phường là giao dịch về tài sản theo tập quán ([Luật Long Phan, 16/01/2026](https://luatlongphan.vn/?p=54121)). [Nghị định 19/2019/NĐ-CP](https://caselaw.vn/van-ban-phap-luat/339092-nghi-dinh-so-19-2019-nd-cp-ngay-19-02-2019-cua-chinh-phu-ve-ho-hui-bieu-phuong) ban hành 19/02/2019, hiệu lực 05/04/2019, thay Nghị định 144/2006 (theo ghi chú); chưa thấy văn bản sửa đổi (cần kiểm tra trên vbpl.vn).

Vị trí đề xuất, cần luật sư xác nhận: HụiSafe là phần mềm cho một nhóm cá nhân tự tổ chức dây họ. Chủ hụi và thành viên là cá nhân; pháp nhân vận hành HụiSafe không làm chủ họ, không giữ tiền góp.

| Điều | Nội dung | Cách HụiSafe đáp ứng |
|---|---|---|
| 3.3 | Cấm tổ chức họ để "cho vay lãi nặng, lừa đảo chiếm đoạt tài sản, lạm dụng tín nhiệm chiếm đoạt tài sản, huy động vốn trái pháp luật" | Không quỹ gom chung giữa kỳ; `maxBid` chặn lãi vượt trần; không cho vay, không sinh lãi trên tiền góp (`NoYield`); không hứa lợi nhuận |
| 4.8 | Họ hưởng hoa hồng: người lĩnh họ trả hoa hồng cho chủ họ theo thỏa thuận | `commissionMode` + `feeBps` (mặc định 1% pot), trừ từ pot người hốt, giữ escrow, mất vào quỹ dự phòng nếu kỳ đó có vỡ nợ |
| 5 | Thành viên từ đủ 18 tuổi, không mất hoặc hạn chế năng lực hành vi dân sự; người 15 đến dưới 18 tuổi có tài sản riêng cũng có thể tham gia; khoản 2: "Điều kiện khác theo thỏa thuận" | Chỉ nhận người từ 18 tuổi, là điều kiện thêm theo khoản 2 (tự xác nhận + điều khoản); attester ký `MemberAttestation`; trên chuỗi chỉ có ví và `attestationId` dạng băm |
| 6 | Chủ họ từ đủ 18 tuổi; nhóm tự tổ chức thì bầu chủ họ quá nửa, "trừ trường hợp các thành viên có thỏa thuận khác" | Người tạo dây là chủ hụi; thành viên chấp nhận khi `join` dây có tham số công khai. Bầu chủ hụi để roadmap |
| 8.2.a | Thỏa thuận có thể ghi "Mức hưởng hoa hồng của chủ họ" | Màn hình "Thỏa thuận dây hụi" hiện `feeBps`, `capBps`, `alphaBps`, ký quỹ, quy tắc chia hòa trước khi `join` |
| 12 | Chủ họ lập, giữ sổ họ: nội dung thỏa thuận, ngày và số tiền góp, lĩnh, "chữ ký hoặc điểm chỉ" | Sổ họ số dựng từ event, xuất JSON/PDF (`docs/05` mục 10); bằng chứng là tx hash và chữ ký EIP-712 của thành viên |
| 13 | Quyền đòi biên nhận khi góp, lĩnh, nhận lãi, trả lãi | Mỗi giao dịch có tx hash, link Snowtrace, dòng sổ họ |
| 14 | Thông báo bằng văn bản cho UBND cấp xã khi phần họ một kỳ từ 100 triệu đồng hoặc tổ chức từ hai dây; văn bản có nhân thân chủ họ (họ tên, số giấy tờ, ngày sinh, nơi cư trú) | Cảnh báo khi một kỳ quy đổi từ 100.000.000 đ (tỷ giá cấu hình mặc định 26.000 đ/USDC, khoảng 3.846 USDC) hoặc `activeCirclesOf ≥ 2`; `draft_ubnd_notice` soạn mẫu; nhân thân điền trên máy người dùng, không lên chuỗi, không vào LLM |
| 15.1.c | Quyền chuyển giao phần họ theo BLDS | MVP chưa cho chuyển suất (một người một ví), ghi rõ trong thỏa thuận |
| 18.2 | Chủ họ báo đủ số dây, phần họ, kỳ, số thành viên của mọi dây mình làm chủ cho người muốn vào | Trang chủ hụi đọc `circlesOf(organizer)` từ `HuiFactory` |
| 18.4 | "Nộp thay phần họ của thành viên nếu đến kỳ mở họ mà có thành viên không góp phần họ, trừ trường hợp có thỏa thuận khác" | Ký quỹ B khóa trong contract, nguồn thứ hai của thác bù; CI hiện trước khi vào; `activate()` cần CI ≥ 50%. Giới hạn trách nhiệm ở B là "thỏa thuận khác", phải ghi rõ |
| 20 | Mức lãi cao nhất lĩnh họ; hòa thì bốc thăm, "trừ trường hợp có thoả thuận khác"; đã lĩnh không được đưa mức lãi | Thăm hợp lệ cao nhất thắng; chia hòa tất định ghi trong thỏa thuận thay bốc thăm; hụi chết không được thăm |
| 21 | Lãi "không vượt quá 20%/năm của tổng giá trị các phần họ phải góp trừ đi giá trị các phần họ đã góp trên thời gian còn lại"; phần vượt vô hiệu | `HuiMath.maxBid`, `capBps = 2000`; `revealBid` revert nếu vượt; UI hiện bảng trần. Công thức là diễn giải của nhóm |
| 22.1 | Chậm góp, chậm giao trả lãi; không thỏa thuận thì bằng 50% trần | `lateRateBps = 1000` (10%/năm). Khoản 2 điểm b dẫn khoản 5 Điều 466 BLDS cho người đã lĩnh trong họ có lãi (câu hỏi mở) |
| 25.1 | Tranh chấp giải quyết "bằng thương lượng, hoà giải hoặc yêu cầu Tòa án" | HụiSafe không phân xử; sổ họ và khoản đòi công khai là chứng cứ, như phiếu chi có chữ ký trong [Bản án 48/2024/DS-ST](https://static3.luatvietnam.vn/uploaded/LawJudgs/2024/07/31/ban-an-48-2024-ds-st-103207.pdf) |

Điều 10 (người đã lĩnh rút phải góp nốt; người chưa lĩnh nhận lại phần đã góp khi dây kết thúc) khớp luồng `DefaultedDead` và `Frozen` ở `docs/03` mục 6.6.

## 2. Hình sự và hành chính liên quan vỡ hụi

- BLHS Điều 174 (lừa đảo chiếm đoạt tài sản): từ 500 triệu đồng, tù 12 đến 20 năm hoặc chung thân. Điều 175 (lạm dụng tín nhiệm chiếm đoạt tài sản): từ 500 triệu đồng, tù 12 đến 20 năm. Chỉ chậm hoặc không giao phần họ thì là trách nhiệm dân sự; dùng việc tuyên bố vỡ hụi để chiếm đoạt mới có thể bị xử lý hình sự ([Luật Long Phan, 16/01/2026](https://luatlongphan.vn/?p=54121)). Vụ Trà Vinh: 12 năm tù về tội lừa đảo ([VOV, 13/03/2025](https://vov.vn/phap-luat/12-nam-tu-cho-doi-tuong-mo-day-hui-khong-chiem-doat-tai-san-post1161016.vov)); vụ khác ở `docs/01` mục 1.3.
- BLHS Điều 201 (cho vay lãi nặng): lãi gấp 5 lần trở lên mức cao nhất của BLDS và thu lợi bất chính từ 30 triệu đồng thì phạt 50 đến 200 triệu hoặc cải tạo không giam giữ đến 3 năm; thu lợi từ 100 triệu thì phạt 200 triệu đến 1 tỷ hoặc tù 6 tháng đến 3 năm ([Luật Long Phan, 27/08/2026](https://luatlongphan.vn/?p=53936)).
- NĐ 19 Điều 25 khoản 2 cho quyền đề nghị xử lý vi phạm hành chính. Chưa tìm thấy mức phạt cho việc không thông báo UBND theo Điều 14 (cần kiểm tra).
- Với HụiSafe: không ai giữ tiền góp giữa các kỳ nên không có "két" để ôm; `maxBid` giữ lãi trong 20%/năm, xa ngưỡng gấp 5 lần của Điều 201. Rủi ro còn lại là lợi dụng ngoài chuỗi (thu tiền mặt, hứa lãi cao), nên UI ghi "mọi khoản góp chỉ đi qua contract" và không cho đăng lời hứa lợi nhuận.

## 3. Tiền mã hóa ở Việt Nam (11/2026)

| Văn bản | Nội dung chính | Hiệu lực, nguồn |
|---|---|---|
| Nghị quyết 05/2025/NQ-CP | Điều 3.1: tài sản số là tài sản theo BLDS. Điều 4.7: "Việc chào bán, phát hành, giao dịch, thanh toán tài sản mã hóa phải được thực hiện bằng Đồng Việt Nam." Điều 4.8: cho mục đích trao đổi hoặc đầu tư. Điều 5.2: phát hành dựa trên tài sản thực, không phải chứng khoán hay tiền pháp định. Điều 6.1: "chỉ được chào bán, phát hành cho nhà đầu tư nước ngoài". Điều 7.2: 6 tháng sau khi tổ chức đầu tiên được cấp phép, nhà đầu tư trong nước phải giao dịch qua tổ chức được cấp phép | Từ 09/09/2025, thí điểm 5 năm; [chinhphu.vn](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-5-2025-nq-cp-ve-trien-khai-thi-diem-thi-truong-tai-san-ma-hoa-tai-viet-nam-119250909184045221.htm) |
| Nghị định 284/2026/NĐ-CP | Nhà đầu tư trong nước giao dịch không qua tổ chức được cấp phép: 30 đến 50 triệu đồng (Điều 9). Tổ chức cung cấp, quảng cáo dịch vụ không phép: 180 đến 200 triệu. Cá nhân vi phạm như tổ chức: 1/2 | Từ 01/09/2026; [VietNamNet, 24/07/2026](https://vietnamnet.vn/so-phan-cac-san-giao-dich-tai-san-ma-hoa-quoc-te-se-ra-sao-sau-ngay-1-9-2538660.html); [VnEconomy, 18/07/2026](https://vneconomy.vn/phat-den-50-trieu-dong-voi-ca-nhan-giao-dich-tai-san-ma-hoa-khong-qua-don-vi-duoc-cap-phep.htm) |
| Ngân hàng Nhà nước | "tiền ảo không phải là phương tiện thanh toán hợp pháp"; dùng thanh toán có thể bị phạt 50 đến 100 triệu (NĐ 88/2019 sửa bởi NĐ 143/2021; điều khoản cần kiểm tra); có thể bị truy cứu theo Điều 206 BLHS | [Doanh nghiệp & Hội nhập, 03/03/2025](https://doanhnghiephoinhap.vn/co-the-bi-phat-den-100-trieu-dong-hoac-truy-cuu-trach-nhiem-hinh-su-khi-su-dung-giao-dich-tien-ao-pi-97137.html) |
| Thông tư 32/2026/TT-BTC | Cá nhân, cư trú hay không: thuế 0,1% trên giá chuyển nhượng từng lần | Từ 27/3/2026; [TTTC-TT, 30/03/2026](https://thitruongtaichinhtiente.vn/giao-dich-tai-san-ma-hoa-chinh-thuc-chiu-thue-0-1-80727.html) |
| Cấp phép sàn | Chưa tổ chức nào được cấp phép; 5 hồ sơ qua xét duyệt ban đầu (VIXEX, SCEX, CAEX, TCEX, Moonbase); CAEX đã đạt an toàn thông tin cấp độ 4 và vốn 10.000 tỷ đồng | [Thanh Niên, 23/10/2026](https://thanhnien.vn/khi-nao-viet-nam-co-san-giao-dich-tai-san-ma-hoa-dau-tien-185261023063623604.htm); kiểm tra lại trước pitch |

Không văn bản nào nêu tên USDC hay stablecoin. Theo ghi chú, Điều 3.2 NQ 05 loại "các dạng số của tiền pháp định" khỏi tài sản mã hóa; USDC có thuộc nhóm này không là chưa rõ (cần kiểm tra).

Hệ quả cho hụi USDC giữa người cư trú (suy luận): góp và chi bằng USDC là giao dịch tài sản mã hóa ngoài tổ chức được cấp phép (rủi ro NĐ 284; thời điểm áp dụng gắn với Điều 7.2 NQ 05, nên không nêu ngày cụ thể); không bằng Đồng Việt Nam (trái Điều 4.7); có thể bị coi là dùng tiền ảo để thanh toán; mỗi lần chuyển có thể chịu thuế 0,1%. Vì vậy MVP chỉ chạy trên Fuji với USDC testnet không có giá trị, không nhận tiền thật (ADR-01). Bản thật cho người cư trú phải là chế độ VND (mục 6).

## 4. Dữ liệu cá nhân và AI

| Văn bản | Điểm liên quan | Nguồn |
|---|---|---|
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15; thông qua 26/06/2025, hiệu lực 01/01/2026 | Điều 3: chỉ xử lý "đúng phạm vi, mục đích cụ thể, rõ ràng", lưu trữ phù hợp mục đích. Điều 9: đồng ý tự nguyện, biết rõ, "rõ ràng, cụ thể, có thể in, sao chép bằng văn bản", cho từng mục đích; "Sự im lặng hoặc không phản hồi không được coi là sự đồng ý". Phạt tối đa 3 tỷ đồng; mua bán dữ liệu tới 10 lần khoản thu; chuyển ra nước ngoài tới 5% doanh thu; cá nhân 1/2 | [LuatVietnam, 10/07/2025](https://luatvietnam.vn/tin-van-ban-moi/da-co-luat-bao-ve-du-lieu-ca-nhan-2025-so-91-2025-qh15-186-102925-article.html); [hethongphapluat](https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025.html); [Hà Tĩnh, 05/01/2026](https://hatinh.gov.vn/vi/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-112026) |
| Nghị định 356/2025/NĐ-CP; ban hành 31/12/2025, hiệu lực 01/01/2026 | Dữ liệu nhạy cảm gồm thông tin tài khoản, thẻ, lịch sử giao dịch ngân hàng, thông tin tài chính, tín dụng, vị trí, sinh trắc học. Điều 10 khoản 3: thông báo xử lý tự động, giải thích nguyên tắc thuật toán, cho quyền không tham gia. Điều 11 khoản 2: "Không lưu trữ trực tiếp dữ liệu cá nhân trên chuỗi khối, chỉ lưu trữ khi dữ liệu cá nhân đã được khử nhận dạng hoặc lưu trữ giá trị băm của dữ liệu cá nhân"; đánh giá tuân thủ 1 năm/lần. Đã sửa đổi bởi NĐ 392/2026/NĐ-CP (phạm vi cần kiểm tra) | [LuatVietnam](https://luatvietnam.vn/dan-su/nghi-dinh-356-2025-nd-cp-quy-dinh-chi-tiet-luat-bao-ve-du-lieu-ca-nhan-422896-d1.html); [PBGDPL Cần Thơ](https://pbgdpl.cantho.gov.vn/quy-dinh-ve-danh-muc-du-lieu-ca-nhan-co-ban-va-danh-muc-du-lieu-ca-nhan-nhay-cam) |
| Luật Trí tuệ nhân tạo số 134/2025/QH15; thông qua 10/12/2025, hiệu lực 01/03/2026 | Điều 9: ba mức rủi ro (cao, trung bình, thấp). Điều 10 khoản 1: nhà cung cấp tự phân loại trước khi triển khai. Điều 11 khoản 1: người dùng phải nhận biết được họ đang tương tác với AI. Điều 15: mức trung bình, thấp chủ yếu có nghĩa vụ minh bạch. Điều 35: chuyển tiếp chỉ cho hệ thống chạy trước 01/03/2026 | [LuatVietnam English](https://english.luatvietnam.vn/law-no-134-2025-qh15-dated-december-10-2025-of-the-national-assembly-on-artificial-intelligence-422299-doc1.html) |

Luật AI với Trợ lý chủ hụi: trợ lý chỉ giải thích và tính bằng hàm tất định, không quyết định thay người dùng, không chuyển tiền. Suy luận: nhiều khả năng ở mức rủi ro thấp hoặc trung bình; nhóm ghi biên bản tự phân loại (Điều 10 khoản 1) và nhờ luật sư xác nhận. Ở mức nào cũng phải gắn nhãn AI.

Luật áp dụng cho HụiSafe:
1. **Không dữ liệu cá nhân trên chuỗi.** Chỉ địa chỉ ví và `attestationId = keccak256(serverSecret ‖ privyUserId ‖ circle)` (`docs/05` mục 8.1), băm có khóa bí mật, khớp NĐ 356 Điều 11. `label` không chứa tên người; biệt danh chỉ lưu trên máy chủ hụi.
2. **Đồng ý** tách theo mục đích (xác thực, nhắc hụi qua Telegram, Trợ lý AI); không tick sẵn; lưu bản ghi; cho rút lại.
3. **Tối thiểu hóa:** chỉ tài khoản Privy (Google hoặc email) và tự xác nhận đủ 18 tuổi; MVP không thu CCCD.
4. **Dữ liệu tài chính:** lịch sử góp, hốt theo ví là công khai và không xóa được, nên không đưa thông tin nhận dạng lên chuỗi; liên kết ví với tài khoản chỉ attester biết, bảo vệ như dữ liệu nhạy cảm.
5. **AI là thông tin, không phải tư vấn:** nhãn "Trợ lý AI"; câu "Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý"; giải thích cách tính và dẫn điều luật (đáp ứng NĐ 356 Điều 10 khoản 3); không đưa dữ liệu cá nhân vào prompt; không dùng dữ liệu người dùng để huấn luyện.
6. **Đánh giá tuân thủ** 1 năm/lần khi chạy thật.

## 5. Luật cuộc thi phải nêu khi pitch (4 điểm BTC)

BTC yêu cầu nêu 4 giới hạn pháp lý; nêu đúng được cộng điểm, phớt lờ bị trừ (`topics.json`, LEADER_BRIEF mục 7).

| Điểm BTC | Câu nói nguyên văn | Cơ sở |
|---|---|---|
| Tiền mã hóa không phải phương tiện thanh toán hợp pháp | "Ở Việt Nam, tiền mã hóa không phải phương tiện thanh toán hợp pháp. Nghị quyết 05/2025 yêu cầu mọi giao dịch, thanh toán tài sản mã hóa phải bằng Đồng Việt Nam. Vì vậy bản demo chạy trên Fuji testnet với USDC testnet không có giá trị, và chúng em không nhận tiền thật." | NHNN; NQ 05 Điều 4.7 |
| Lương phải trả bằng VND | "HụiSafe không trả lương. Bộ luật Lao động 2019, Điều 95 khoản 2, quy định tiền lương trả bằng Đồng Việt Nam. Hụi là giao dịch dân sự giữa các thành viên, không phải tiền lương." | [BLLĐ 2019 Điều 95.2](https://luatvietnam.vn/lao-dong-tien-luong/tra-luong-cho-lao-dong-nuoc-ngoai-bang-ngoai-te-562-33455-article.html) |
| Tư vấn có thu phí cần giấy phép | "Trợ lý chủ hụi miễn phí, chỉ đưa thông tin và con số tính bằng công thức cố định, và luôn ghi rõ đây không phải tư vấn tài chính hay pháp lý. Tư vấn pháp luật là hoạt động hành nghề của luật sư. Nếu sau này có dịch vụ thu phí, chúng em sẽ làm cùng đơn vị có giấy phép." | Luật Luật sư Điều 4, 28 ([PLO](https://plo.vn/doan-luat-su-tphcm-len-tieng-ve-tu-van-phap-luat-post529980.html)); mạo danh luật sư bị phạt 30 đến 40 triệu (NĐ 82/2020 Điều 6.7.e, [LSVN](https://lsvn.vn/mao-danh-luat-su-de-hanh-nghe-luat-su-bi-phat-tien-tu-30-den-40-trieu-dong1638065009-a112302.html)) |
| Cổ phiếu token hóa bị chặn theo khu vực | "HụiSafe không có cổ phiếu token hóa, không phát hành và không bán token nào." | Luật cuộc thi |

Câu nên nói thêm ở đầu pitch:
- "Chúng em khai báo dev toggle: ở chế độ demo, mỗi kỳ hụi chỉ dài 3 phút để giám khảo xem trọn một dây; kỳ danh nghĩa dùng tính trần lãi vẫn là 30 ngày." (`docs/03` mục 3.3; kịch bản ở `docs/12`)
- "Hụi là giao dịch hợp pháp theo Điều 471 Bộ luật Dân sự và Nghị định 19/2019. HụiSafe đưa trần lãi, lãi chậm góp, sổ họ, biên nhận và cảnh báo thông báo UBND xã vào code."
- "Bản MVP không sinh lãi trên tiền khóa. Nếu có, lãi thật sẽ đến từ cho vay blue-chip như Aave trên mainnet, không đến từ in token." (ADR-10)

## 6. Chiến lược ra thị trường tuân thủ

| Giai đoạn | Mô tả | Điều kiện pháp lý |
|---|---|---|
| 1. Demo testnet (đang làm) | Fuji, USDC testnet, 5 đến 10 người dùng thử | Luật cuộc thi; không tài sản có giá trị |
| 2. Chế độ VND (roadmap) | Góp, chi bằng chuyển khoản VND qua VietQR; chuỗi giữ sổ họ chống sửa và tính luật chơi (trần lãi, chia hòa, thác bù); ký quỹ chủ hụi nằm trong tài khoản phong tỏa ở ngân hàng đối tác | Hợp đồng với ngân hàng; nền tảng có phải trung gian thanh toán không (cần kiểm tra); Luật 91/2025 |
| 3. Người Việt ở nước ngoài (nghiên cứu) | USDC thật chỉ cho người không cư trú tại Việt Nam, chặn theo khu vực | Luật chuyển tiền, chứng khoán, thuế, KYC/AML từng nước: cần luật sư sở tại (cần kiểm tra). Hụi trong cộng đồng người Việt ở nước ngoài có thật, ví dụ vụ ở Sydney năm 2007 ([Anthony Albanese](https://anthonyalbanese.com.au/statement-hui-fraud), ghi chú) |
| 4. Qua sàn được cấp phép (theo dõi) | Chỉ khi có sàn được cấp phép và được niêm yết stablecoin | Đến 23/10/2026 chưa sàn nào được cấp phép |

## 7. Câu hỏi mở cần luật sư trả lời

1. Chia hòa tất định (ít trễ hơn, rồi commit sớm hơn) thay bốc thăm có hợp lệ như "thỏa thuận khác" ở Điều 20 khoản 2 không?
2. Công thức trần (I = b·L, D = (N − k)·C, T = (N − k)·P/365) có đúng Điều 21 không? Khi có người bị đóng băng (L < N − k) thì sao?
3. Chữ ký ví (EIP-712) và nhật ký on-chain có thay được "chữ ký hoặc điểm chỉ" trong sổ họ không? Luật Giao dịch điện tử 20/2023/QH15 (hiệu lực 01/07/2024) Điều 23: chữ ký điện tử không bị phủ nhận giá trị chỉ vì ở dạng điện tử, nhưng chỉ "chữ ký điện tử chuyên dùng bảo đảm an toàn hoặc chữ ký số" mới tương đương chữ ký tay ([hethongphapluat](https://hethongphapluat.com/luat-giao-dich-dien-tu-2023/dieu-23)).
4. Thỏa thuận bằng văn bản (Điều 7, 8) cần nhân thân, còn HụiSafe giữ nhân thân ngoài chuỗi: lập văn bản thế nào cho hợp lệ?
5. Nền tảng có bị coi là tổ chức họ, huy động vốn (Điều 3 khoản 3), trung gian thanh toán hay tổ chức cung cấp dịch vụ tài sản mã hóa (NQ 05) không? Pháp nhân có được làm chủ họ không?
6. Giới hạn trách nhiệm chủ hụi ở ký quỹ B và thứ tự thác bù (holdback trước ký quỹ) có hợp lệ theo Điều 18 khoản 4 không?
7. Holdback có xung đột với nghĩa vụ giao phần họ cho người lĩnh (Điều 18 khoản 3) không? Có bị tính vào lãi theo Điều 21 không?
8. Lãi chậm góp của người đã hốt trong họ có lãi (Điều 22 khoản 2 điểm b, dẫn khoản 5 Điều 466 BLDS) khác mức 50% trần thế nào?
9. Tiền công bị chuyển vào quỹ dự phòng khi kỳ có vỡ nợ, cọc mở thăm bị mất, quỹ dự phòng chia đều cuối dây: có là phạt vi phạm cần thỏa thuận riêng không?
10. Ngưỡng Điều 14 tính N·C hay (N − 1)·C? Quy đổi USDC theo tỷ giá nào? Dây ngoài nền tảng có tính vào "từ hai dây" không?
11. Không cho chuyển suất trong MVP có trái Điều 15 khoản 1 điểm c không?
12. Địa chỉ ví và lịch sử góp on-chain có là dữ liệu cá nhân (hoặc dữ liệu tài chính nhạy cảm theo NĐ 356) khi attester giữ liên kết với tài khoản không?
13. Trợ lý chủ hụi ở mức rủi ro nào theo Luật AI Điều 9; cần thủ tục gì ngoài nhãn AI?
14. Bản USDC cho người Việt ở nước ngoài cần giấy phép gì ở từng nước? Chặn theo khu vực có đủ không?
15. Nếu chạy USDC thật, thuế 0,1% (TT 32/2026) có áp cho từng lần góp và chi không?

16. `emergencyUnwind` (sau 48 giờ tạm dừng) trả holdback về chủ của nó kể cả người đã vỡ nợ, không áp thứ tự hoàn như `finalize` (03 mục 5.4); khoản vỡ nợ còn lại thành khoản đòi công khai ngoài chuỗi. Cách này có phù hợp với nghĩa vụ hoàn trả giữa các thành viên không, hay cần bù trừ trước khi trả?
