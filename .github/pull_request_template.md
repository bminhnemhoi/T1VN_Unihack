## Việc
- Mã việc (docs/11): <!-- C?, W?, T? -->  Mốc: <!-- M? -->
- Mô tả ngắn:

## Thay đổi chính
-

## Luồng tiền (bắt buộc nếu đụng contracts/, /api/relay, /api/attest, keeper, huiMath)
- [ ] Đã gắn nhãn `money-path`
- [ ] test-engineer: unit + fuzz (+ invariant nếu đổi trạng thái tiền). Kết quả:
- [ ] security-auditor: Critical 0, High 0. Tóm tắt báo cáo:
- [ ] Bất biến liên quan (INV-xx):

## Kiểm chứng
- Lệnh đã chạy và kết quả:
- Tx hash trên Fuji (nếu có):
- Ảnh màn hình ở bề rộng 360 px (nếu đổi UI):

## Definition of Done (CLAUDE.md)
- [ ] Đúng docs/03, docs/05; tài liệu đã cập nhật nếu hành vi đổi
- [ ] forge fmt --check, forge build, forge test (gồm invariant) xanh
- [ ] pnpm -r lint, pnpm -r typecheck, pnpm -r test xanh; pytest xanh nếu đụng sim/
- [ ] security-auditor không còn Critical/High; Slither sạch mức high
- [ ] Không bí mật trong diff; không địa chỉ hard-code ngoài packages/config và deployments/fuji.json
- [ ] UI tiếng Việt, mobile-first, số tiền kèm đơn vị
- [ ] Đã chạy /sync-abi nếu đổi interface hoặc event

## Ghi chú cho người review
- Phần do Claude Code viết, phần người viết tay, chỗ cần đọc kỹ:
