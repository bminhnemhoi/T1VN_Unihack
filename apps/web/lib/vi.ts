/** Interface strings (docs/02 section 8 wording rules). Keep sentences under 20 words. */
export const vi = {
  appName: 'HụiSafe',
  sampleBanner: 'Màn hình mẫu để xem thử. Chưa nối với mạng, số liệu chỉ để minh họa.',
  demoBanner:
    'CHẾ ĐỘ DEMO: 1 kỳ = 3 phút, ân hạn 2 phút. Trần lãi và lãi chậm góp vẫn tính như kỳ 30 ngày. Tiền là USDC thử nghiệm trên Fuji, không có giá trị. Màn hình này dùng số liệu mẫu.',
  tagline: 'Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.',
  nav: { home: 'Trang chủ', myCircles: 'Dây của tôi', create: 'Tạo dây', room: 'Phòng thăm' },
  help: {
    coverage: 'Phần rủi ro lớn nhất đã có tiền khóa sẵn để bù.',
    bond: 'Tiền chủ hụi khóa để bù khi người đã hốt bỏ đóng.',
    holdback: 'Phần tiền hốt được giữ lại để bù nếu người hốt ngừng đóng. Đóng đủ thì nhận lại hết.',
    reserve: 'Trích mỗi kỳ. Cuối dây chia đều cho người không vỡ nợ.',
    fee: 'Hoa hồng theo NĐ 19, chỉ trả cho kỳ không bị mất.',
    maxBid: 'Thăm cao nhất được phép theo trần lãi 20%/năm.',
  },
} as const;
