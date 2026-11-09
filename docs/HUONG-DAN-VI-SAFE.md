# Hướng dẫn tạo ví Safe 2/3 trên Fuji (admin của HụiSafe)

Người đọc: leader. Làm một lần, khoảng 20 phút. Cần xong **trước khi deploy lên Fuji** (dự kiến 11/11).

## Vì sao cần

- Luật UniHack: quỹ gom chung phải nằm sau ví nhiều chữ ký (multisig). Đây là ADR-26 trong bản v1.2.
- Admin của HụiSafe chỉ có quyền tạm dừng dây, mở lại và trả tiền theo sổ. Admin **không có hàm rút tiền** của ai.
- Địa chỉ admin của factory **không đổi được sau khi deploy**. Vì vậy phải tạo Safe trước. Người ký bên trong Safe thì đổi được về sau, địa chỉ Safe vẫn giữ nguyên.

## Cấu hình

| Mục | Giá trị |
|---|---|
| Mạng | Avalanche Fuji (testnet, chainId 43113). Không làm trên mainnet |
| Số người ký | 3 |
| Số chữ ký cần cho mỗi lệnh | 2 |
| Người ký 1 | Towfienes |
| Người ký 2 | Minh |
| Người ký 3 | Ví dự phòng tạm, do Towfienes hoặc Minh giữ. Khi chọn được thành viên đóng góp tốt nhất thì thay bằng ví của người đó (xem bước 5) |

## Các bước

### 1. Mỗi người ký chuẩn bị một ví testnet riêng
- Tạo ví mới bằng Core hoặc MetaMask. Dùng ví **chỉ cho việc ký Safe**.
- **Không dùng lại** ví deployer, relayer, keeper hay attester của dự án (ADR-21: mỗi vai một ví).
- Thêm mạng Avalanche Fuji vào ví.
- Lấy một ít AVAX testnet từ faucet chính thức của Avalanche. Chỉ người bấm tạo Safe mới cần AVAX để trả phí.
- Gửi **địa chỉ ví** (dạng `0x...`, công khai, không phải bí mật) cho người sẽ tạo Safe.
- Tuyệt đối không gửi cụm từ khôi phục (seed phrase) hay khóa riêng cho ai, kể cả trong nhóm.

### 2. Tạo Safe
Làm theo hướng dẫn của Avalanche Academy: <https://docs.avax.network/academy/avalanche-l1/permissioned-l1s/06-multisig-setup/03-create-safe-wallet>

1. Mở Ash Wallet: <https://wallet.ash.center>. Đây là giao diện tương thích Safe mà Avalanche Academy dùng trên Fuji.
2. Kết nối ví của người tạo, chọn mạng **Avalanche Fuji**.
3. Chọn tạo Safe mới, đặt tên, ví dụ `HuiSafe Admin`.
4. Thêm 3 địa chỉ người ký ở bảng trên.
5. Đặt ngưỡng **2 trên 3**.
6. Xác nhận và ký giao dịch tạo Safe.
7. Chép **địa chỉ Safe** vừa tạo.

Nếu Ash Wallet lỗi trên Fuji: báo Towfienes. Agent sẽ tạo Safe bằng Protocol Kit của Safe, sau khi kiểm địa chỉ các contract Safe trên chain 43113.

### 3. Kiểm tra
- Mở địa chỉ Safe trên <https://testnet.snowtrace.io>, phải thấy là một contract.
- Trong Ash Wallet, mục chủ sở hữu (owners) phải có đúng 3 địa chỉ, ngưỡng 2.
- Nên thử một lệnh nhỏ: một người tạo lệnh, người thứ hai ký thì lệnh mới chạy.

### 4. Gửi địa chỉ Safe cho Towfienes
Chỉ cần **địa chỉ Safe** (công khai). Agent sẽ:
- ghi vào `packages/config` và `contracts/deployments/fuji.json`;
- deploy factory với admin là Safe, sàn chỉ số bảo chứng 100% (ADR-22);
- deploy `ReputationRegistry` với admin là ví deployer. Quyền duy nhất của admin này là nối registry với factory một lần, ngay trong script deploy;
- thêm vào `/demo-check` bước kiểm `factory.admin()` đúng bằng địa chỉ Safe.

Lệnh deploy lên Fuji luôn chờ người duyệt.

### 5. Thay người ký thứ 3 về sau
Khi nhóm chọn được thành viên đóng góp tốt nhất:
1. Trong Ash Wallet, vào phần chủ sở hữu, chọn thay ví dự phòng bằng địa chỉ ví của người mới.
2. Hai người ký xác nhận lệnh.
3. Địa chỉ Safe **không đổi**, nên không phải deploy lại contract.

## Câu dùng khi pitch

"Tiền nằm trong contract không có hàm rút. Quyền khẩn cấp duy nhất là tạm dừng và trả theo sổ, và quyền đó nằm sau Safe 2/3."
