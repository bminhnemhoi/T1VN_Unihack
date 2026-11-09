# Đề xuất M-02: trả trễ cần allowance mà người dùng không có gas

Trạng thái: chỉ đề xuất, chưa viết code. Người quyết định: Towfienes (và Minh nếu chọn phương án đổi contract, vì phải sửa docs/03 và docs/05 trước).

## 1. Vấn đề

`payLate(round)` và `repayDebt(amount)` kéo tiền bằng `transferFrom` từ allowance mà thành viên đã cấp cho dây lúc `join` (permit, giá trị `requiredAllowance = (N − 1) × (C + cọc mở thăm)`). Hai hàm này không nhận `PermitSig`, nên:

1. Allowance còn lại phải đủ gốc còn nợ cộng lãi chậm góp. Nếu allowance đã bị thu hồi, đã cạn hoặc ít hơn, hàm revert `SafeERC20` và người dùng phải tự gửi `USDC.approve`.
2. Người dùng đăng nhập Privy, dùng meta-transaction và thường không có AVAX. Allowlist relay (docs/05 mục 8.2) chỉ cho đích là factory hoặc dây, nên `USDC.approve` và `USDC.permit` không đi qua relay được. Kết quả: người chủ động muốn trả trễ không có đường nào, và hết ân hạn thì bị `markDefault`.

Kiểm bằng e2e A11: để `payLate` chạy, test phải gọi `approve(circle, 30 USDC)` bằng ví có gas.

## 2. Định lượng cho dây demo (N = 5, C = 10 USDC)

Allowance lúc vào dây: 4 × (10 + 0,1) = **40,4 USDC**. Mức tiêu tối đa của một thành viên: 4 khoản góp tối đa 10 USDC cộng tối đa 4 lần cọc mở thăm 0,1 USDC (kéo bằng `transferFrom` nên cũng ăn allowance; lúc trả lại cọc thì allowance không được hoàn). Vậy allowance bằng đúng mức tiêu tối đa khi không ai được giảm nhờ tiền thăm. Phần dư thật chỉ có từ tiền thăm đã giảm khoản góp và từ những lần không commit.

Lãi chậm góp demo (10% năm, `timeScale` = 30 ngày / 180 s = 14.400), trên gốc 10 USDC:

| Trả sau | Lãi | Ghi chú |
|---|---|---|
| 60 s | 0,027397 USDC | |
| 120 s | 0,054794 USDC | hết ân hạn, mức tối đa của `payLate` demo |
| 900 s | 0,410958 USDC | `repayDebt` của người đã vỡ nợ, lãi chạy tiếp không trần |
| 3600 s | 1,643835 USDC | |

Bản thật (ân hạn 48 giờ): tối đa 0,005479 USDC trên gốc 10 USDC.

Hệ quả "lãi ăn allowance của kỳ sau": gốc của khoản thiếu không ăn thêm allowance (lần kéo gốc ban đầu đã thất bại nên chưa tiêu), nhưng lãi là khoản kéo thêm mà allowance ban đầu không chừa. Ví dụ M4 thắng kỳ 1 với tiền thăm 0,6 (một lần commit đã tiêu 0,1): allowance còn 40,3, còn đúng 4 khoản góp 40 nên dư 0,3. Một `payLate` demo tối đa ăn 0,055 nên chịu được khoảng năm lần; nhưng thành viên không có phần dư (mọi thăm bằng 0, hoặc đã commit đủ bốn kỳ không thắng) thì một lần trả trễ có lãi F > 0 làm khoản kéo cuối cùng thiếu đúng F, và vì `transferFrom` là toàn phần, cả khoản 10 USDC của kỳ cuối lại thành khoản thiếu mới. Tức là trả trễ đúng luật có thể sinh ra một lần trễ nữa. Với `repayDebt`, lãi 0,41 USDC sau 15 phút vượt phần dư 0,3 điển hình.

Tổng allowance cần cấp lại khi một người thiếu ở kỳ r: `(số kỳ còn phải góp sau kỳ r) × C + gốc còn nợ + lãi tối đa`. Ví dụ thiếu kỳ 2, trả ở giây 120: 3 × 10 + 10 + 0,055 = 40,055 USDC. Permit đặt allowance bằng giá trị ký (không cộng dồn), nên giá trị này phải tính theo công thức trên, không phải chỉ phần nợ.

## 3. Phương án (a): relay nhận `USDC.permit` do thành viên ký, không đổi contract

Thành viên ký EIP-2612 permit (chữ ký ngoài chuỗi, miễn phí) cho `spender = địa chỉ dây`. Relayer gửi `USDC.permit(...)` và trả gas. Permit tự xác thực bằng chữ ký nên không cần forwarder; ý định "relay `USDC.permit` qua `ERC2771Forwarder`" kém hơn vì bắt người dùng ký hai lần (permit và forward request) mà USDC không đọc `_msgSender()`.

Thay đổi docs/05 mục 8.2: thêm một dạng yêu cầu thứ hai, đề xuất route `POST /api/relay/permit`, body `{ "permit": { owner, spender, value, deadline, v, r, s } }`. Danh sách selector của mục 8.2 (đích factory hoặc dây) giữ nguyên, vì đích ở đây là USDC và đi theo đường riêng. Kiểm theo thứ tự:

1. `factory.isCircle(spender)`.
2. `circle.memberInfo(owner).joined` và `circle.state()` là Active (hoặc Forming); chặn ví lạ dùng relayer làm máy gửi permit.
3. `value` ≤ `2 × circle.requiredAllowance()` (trần chống giá trị vô lý; thực tế chỉ dây tin cậy mới tiêu được allowance, INV-04 giới hạn mỗi lần kéo).
4. `deadline` trong khoảng (now, now + 1 giờ].
5. Mô phỏng `eth_call` `USDC.permit(...)`. Nếu revert vì nonce đã dùng (ai đó gửi trước) thì chấp nhận khi `allowance(owner, spender) ≥ value`, giống `join` ở docs/03 mục 5.1.
6. Hạn mức: 10 lần mỗi giờ mỗi `owner`, tính cả vào ngân sách chung 1.500 yêu cầu/giờ và vào ngưỡng dừng 0,05 AVAX của relayer; sau đó gửi bằng ví relayer qua khóa tuần tự đã có.

Chi phí gas một `permit` khoảng 60.000 gas, rất nhỏ so với `settleRound`. Luồng UI: ký permit (một lần ký) → `POST /api/relay/permit` → `POST /api/relay` cho `payLate` hoặc `repayDebt`; hàm SDK `quoteRepay` đã có đủ dữ liệu để tính giá trị permit theo công thức mục 2.

Ưu: không đổi contract, không audit lại, không deploy lại, không đổi ABI nên B9 (nối UI) không bị ảnh hưởng; làm trong khoảng nửa ngày (route, test, hàm SDK `signRepayPermit`, tài liệu). Hoàn tác được. Nhược: thêm một bề mặt cho relayer (có thể bị spam gas, đã chặn bằng bước 2 và hạn mức) và hai lần gọi HTTP; đường dự phòng "ví có AVAX tự gọi" vẫn có.

## 4. Phương án (b): thêm `PermitSig` vào `payLate` và `repayDebt`

`payLate(uint32 round, PermitSig calldata permit)` và `repayDebt(uint256 amount, PermitSig calldata permit)`, gọi `_tryPermit(m, value, permit)` giống `join` trước `transferFrom`. Một giao dịch relay duy nhất, không bề mặt mới cho relayer.

Chi phí: đổi hợp đồng đã chốt và đã audit, nên phải làm theo quy trình: sửa docs/03 mục 6.8 và docs/05 mục 3.2, cập nhật test (unit, fuzz, invariant, `WorkedExample`, gas budget), `security-auditor`, đổi ABI (đổi selector `payLate` và `repayDebt`, phải đổi allowlist relay, SDK, keeper nếu có, mọi chỗ UI đang nối B9) và deploy lại. Kích thước `HuiCircle` hiện 22.131 byte trên giới hạn 24.576 (dư 2.445 byte); hai tham số struct thêm vài trăm byte, vừa nhưng sát. Tính đến deploy Fuji dự kiến 11/11, phương án này dời mốc M2 ít nhất một ngày và buộc Minh duyệt đổi luật.

Ngoài ra cả hai hàm còn cần quyết định `value` của permit: contract không biết lãi cho tới lúc chạy, nên người dùng vẫn phải ký giá trị tính trước theo công thức mục 2 (cùng một công thức như phương án (a)).

## 5. So sánh

| Tiêu chí | (a) relay nhận permit | (b) đổi contract |
|---|---|---|
| Đổi contract, audit, deploy lại | Không | Có |
| Đổi ABI/selector, ảnh hưởng B9 | Không | Có |
| Số giao dịch relay cho một lần trả trễ | 2 (permit, rồi payLate) | 1 |
| Bề mặt mới cho relayer | Có, có chặn | Không |
| Thời gian ước tính | khoảng nửa ngày | khoảng 1 đến 2 ngày và nhiều rủi ro mốc |
| Cần Minh duyệt đổi luật | Không (chỉ docs/05 mục 8.2) | Có (docs/03, docs/05) |

## 6. Khuyến nghị

Chọn **(a)**. Cùng mức bảo vệ người dùng, không chạm vào contract đã qua audit trước ngày deploy, hoàn tác được. Làm kèm hai việc nhỏ, đều ở phía SDK/UI và không đổi contract:

1. Lúc `join`, ký permit với một khoản dư nhỏ trên `requiredAllowance` (ví dụ cộng 1 USDC cho dây demo); `join` chỉ đòi allowance ≥ `requiredAllowance` nên hợp lệ. Dư này hấp thụ lãi của vài lần trả trễ nhỏ (0,055 USDC mỗi lần ở demo) mà không cần permit lại.
2. Giao diện trả trễ luôn tính giá trị permit bằng công thức mục 2 (đã nằm trong phạm vi `quoteRepay`) và hiện cho người dùng số USDC sẽ được cấp.

Nếu Minh muốn một giao dịch duy nhất vì lý do trải nghiệm, (b) là roadmap sau cuộc thi, gộp vào lần đổi contract kế tiếp.
