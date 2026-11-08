/**
 * UBND notice template (NĐ 19 Điều 14, docs/05 12.2). Placeholders only: personal data is typed by the
 * organizer on their own device and never reaches the server or the model (docs/07 3.8).
 */
export const UBND_PLACEHOLDERS = ['[HỌ TÊN]', '[SỐ GIẤY TỜ]', '[NGÀY SINH]', '[NƠI CƯ TRÚ]'] as const;

export function ubndNoticeMarkdown(circle: string): string {
  return [
    '# THÔNG BÁO TỔ CHỨC HỌ (HỤI)',
    '',
    'Kính gửi: Ủy ban nhân dân xã/phường/thị trấn nơi cư trú của chủ họ.',
    '',
    'Căn cứ Nghị định 19/2019/NĐ-CP, Điều 14 khoản 1, tôi thông báo về việc tổ chức họ như sau.',
    '',
    '## Thông tin chủ họ',
    '',
    '- Họ và tên: [HỌ TÊN]',
    '- Số giấy tờ tùy thân: [SỐ GIẤY TỜ]',
    '- Ngày sinh: [NGÀY SINH]',
    '- Nơi cư trú: [NƠI CƯ TRÚ]',
    '',
    '## Thông tin dây họ',
    '',
    `- Địa chỉ hợp đồng của dây (mạng thử nghiệm Avalanche Fuji): ${circle}`,
    '- Số phần, mức góp, kỳ, danh sách thành viên: xem sổ họ số dựng từ dữ liệu trên chuỗi tại địa chỉ hợp đồng nêu trên.',
    '',
    'Ngày ... tháng ... năm ...',
    '',
    'Người thông báo (ký, ghi rõ họ tên)',
    '',
    '> Đây là mẫu tham khảo do HụiSafe soạn, cần luật sư xác nhận trước khi nộp. Hãy tự điền các ô trong ngoặc vuông trên máy của bạn.',
  ].join('\n');
}
