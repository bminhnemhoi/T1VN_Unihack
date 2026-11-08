/**
 * Approved texts for `explain_rule` (docs/07 3.3, docs/05 12.2). Sources: docs/10 and docs/13 only;
 * nothing here was checked against the original Official Gazette text beyond what those files record.
 * Anything not verified, or that is HụiSafe's own reading, says "cần luật sư xác nhận".
 */
import type { RuleTopic } from '../schemas';

export interface RuleText {
  topic: RuleTopic;
  text: string;
  citation: string;
  url: string;
  checkedAt: string;
}

const ND19_URL = 'https://caselaw.vn/van-ban-phap-luat/339092-nghi-dinh-so-19-2019-nd-cp-ngay-19-02-2019-cua-chinh-phu-ve-ho-hui-bieu-phuong';
const CHECKED = '2026-11-06';
const SHORT_SENTENCE = 'Đây là tóm tắt của nhóm HụiSafe từ docs/10, cần luật sư xác nhận trước khi dùng ngoài môi trường thi.';

export const RULE_TEXTS: Record<RuleTopic, RuleText> = {
  nd19_dieu5_6: {
    topic: 'nd19_dieu5_6',
    text:
      'Điều 5 quy định thành viên tham gia họ phải từ đủ 18 tuổi và không bị mất hoặc hạn chế năng lực hành vi dân sự; ' +
      'người từ 15 đến dưới 18 tuổi có tài sản riêng cũng có thể tham gia. Khoản 2 cho phép thỏa thuận thêm điều kiện khác. ' +
      'Điều 6 quy định chủ họ phải từ đủ 18 tuổi. HụiSafe chỉ nhận người từ đủ 18 tuổi, là điều kiện thêm theo thỏa thuận ở khoản 2 ' +
      '(người dùng tự xác nhận đủ 18 tuổi khi vào dây). ' + SHORT_SENTENCE,
    citation: 'Nghị định 19/2019/NĐ-CP, Điều 5 (thành viên) và Điều 6 (chủ họ)',
    url: ND19_URL,
    checkedAt: CHECKED,
  },
  nd19_dieu12_13: {
    topic: 'nd19_dieu12_13',
    text:
      'Điều 12: chủ họ lập và giữ sổ họ, ghi nội dung thỏa thuận, ngày và số tiền góp, lĩnh, cùng "chữ ký hoặc điểm chỉ". ' +
      'Điều 13: thành viên có quyền đòi biên nhận khi góp, lĩnh, nhận lãi, trả lãi. HụiSafe dựng sổ họ số từ sự kiện trên chuỗi ' +
      '(xuất JSON hoặc PDF); mỗi giao dịch có mã giao dịch và liên kết Snowtrace làm biên nhận. ' +
      'Việc chữ ký điện tử của ví có thay được chữ ký hoặc điểm chỉ trong sổ họ hay không là câu hỏi mở, cần luật sư xác nhận.',
    citation: 'Nghị định 19/2019/NĐ-CP, Điều 12 (sổ họ) và Điều 13 (biên nhận)',
    url: ND19_URL,
    checkedAt: CHECKED,
  },
  nd19_dieu14: {
    topic: 'nd19_dieu14',
    text:
      'Điều 14 khoản 1: chủ họ phải thông báo bằng văn bản cho UBND cấp xã khi phần họ của một kỳ từ 100 triệu đồng trở lên, ' +
      'hoặc khi tổ chức từ hai dây họ trở lên. Văn bản có nhân thân chủ họ (họ tên, số giấy tờ, ngày sinh, nơi cư trú). ' +
      'HụiSafe cảnh báo bằng cờ trong dữ kiện, tính giá trị một kỳ là số phần nhân mức góp quy đổi theo tỷ giá cấu hình; ' +
      'đây là cách tính thận trọng của nhóm, còn cách hiểu "tổng giá trị các phần họ tại một kỳ" cần luật sư xác nhận. ' +
      'Nhân thân do chủ họ tự điền trên máy mình, không gửi lên máy chủ và không đưa vào mô hình AI.',
    citation: 'Nghị định 19/2019/NĐ-CP, Điều 14 khoản 1 (thông báo UBND cấp xã)',
    url: ND19_URL,
    checkedAt: CHECKED,
  },
  nd19_dieu18_4: {
    topic: 'nd19_dieu18_4',
    text:
      'Điều 18 khoản 4: chủ họ phải nộp thay phần họ của thành viên khi đến kỳ mở họ mà có thành viên không góp, ' +
      'trừ trường hợp có thỏa thuận khác. Trong HụiSafe, chủ hụi không cầm tiền nhưng ký quỹ một khoản khóa trong hợp đồng ' +
      'để bù phần thiếu theo thứ tự đã công bố; trách nhiệm của chủ hụi giới hạn ở khoản ký quỹ là một "thỏa thuận khác" ' +
      'phải ghi rõ trong thỏa thuận dây, và tính hợp lệ của giới hạn này cần luật sư xác nhận.',
    citation: 'Nghị định 19/2019/NĐ-CP, Điều 18 khoản 4 (nghĩa vụ của chủ họ)',
    url: ND19_URL,
    checkedAt: CHECKED,
  },
  nd19_dieu20: {
    topic: 'nd19_dieu20',
    text:
      'Điều 20: người lĩnh họ theo thỏa thuận; với họ có lãi thì người trả lãi cao nhất được lĩnh, nếu bằng nhau thì bốc thăm, ' +
      'trừ trường hợp có thỏa thuận khác; người đã lĩnh không được đưa mức lãi. HụiSafe không dùng bốc thăm vì luật cuộc thi cấm yếu tố ngẫu nhiên: ' +
      'khi bằng nhau, người ít lần trễ hơn thắng, rồi đến người nộp thăm sớm hơn. Việc coi quy tắc tất định này là "thỏa thuận khác" ' +
      'cần luật sư xác nhận.',
    citation: 'Nghị định 19/2019/NĐ-CP, Điều 20 (lĩnh họ)',
    url: ND19_URL,
    checkedAt: CHECKED,
  },
  nd19_dieu21: {
    topic: 'nd19_dieu21',
    text:
      'Điều 21: lãi không vượt quá 20%/năm của tổng giá trị các phần họ phải góp trừ đi giá trị các phần họ đã góp, tính trên thời gian còn lại; ' +
      'phần vượt quá vô hiệu. HụiSafe đổi quy định này thành trần tiền thăm từng kỳ (hàm maxBid, tham số capBps = 2000). ' +
      'Công thức trần là cách hiểu của HụiSafe, cần luật sư xác nhận, đặc biệt khi có người bị đóng băng.',
    citation: 'Nghị định 19/2019/NĐ-CP, Điều 21 (lãi suất)',
    url: ND19_URL,
    checkedAt: CHECKED,
  },
  nd19_dieu22: {
    topic: 'nd19_dieu22',
    text:
      'Điều 22 khoản 1: khi chậm góp hoặc chậm giao trả lãi mà không có thỏa thuận thì lãi chậm bằng 50% mức lãi giới hạn. ' +
      'Với trần 20%/năm, HụiSafe đặt lãi chậm góp là 10%/năm (lateRateBps = 1000), trả vào quỹ dự phòng. ' +
      'Khoản 2 điểm b dẫn khoản 5 Điều 466 Bộ luật Dân sự cho người đã lĩnh trong họ có lãi; mức áp dụng cho trường hợp này là câu hỏi mở, cần luật sư xác nhận.',
    citation: 'Nghị định 19/2019/NĐ-CP, Điều 22 khoản 1 (lãi chậm góp)',
    url: ND19_URL,
    checkedAt: CHECKED,
  },
  nd19_dieu25: {
    topic: 'nd19_dieu25',
    text:
      'Điều 25 khoản 1: tranh chấp về họ được giải quyết bằng thương lượng, hòa giải hoặc yêu cầu Tòa án. ' +
      'HụiSafe không phân xử tranh chấp. Sổ họ số và khoản đòi công khai trên chuỗi là chứng cứ tham khảo cho các bên; ' +
      'giá trị chứng cứ của chúng cần luật sư xác nhận. Khi có tranh chấp cụ thể, nên hỏi luật sư hoặc tổ chức trợ giúp pháp lý.',
    citation: 'Nghị định 19/2019/NĐ-CP, Điều 25 khoản 1 (giải quyết tranh chấp)',
    url: ND19_URL,
    checkedAt: CHECKED,
  },
  crypto_vn: {
    topic: 'crypto_vn',
    text:
      'Nghị quyết 05/2025/NQ-CP (hiệu lực từ 09/09/2025, thí điểm 5 năm) Điều 4 khoản 7: chào bán, phát hành, giao dịch, thanh toán tài sản mã hóa ' +
      'phải thực hiện bằng Đồng Việt Nam. Ngân hàng Nhà nước: tiền ảo không phải là phương tiện thanh toán hợp pháp. ' +
      'Nghị định 284/2026/NĐ-CP (từ 01/09/2026) quy định mức phạt với giao dịch tài sản mã hóa không qua tổ chức được cấp phép. ' +
      'Vì vậy HụiSafe chỉ chạy trên mạng thử nghiệm Avalanche Fuji với USDC thử nghiệm không có giá trị và không nhận tiền thật. ' +
      'Văn bản nào nêu tên USDC hay stablecoin chưa tìm thấy; việc áp dụng với USDC cần luật sư xác nhận.',
    citation: 'Nghị quyết 05/2025/NQ-CP Điều 4 khoản 7; Nghị định 284/2026/NĐ-CP; Ngân hàng Nhà nước',
    url: 'https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-5-2025-nq-cp-ve-trien-khai-thi-diem-thi-truong-tai-san-ma-hoa-tai-viet-nam-119250909184045221.htm',
    checkedAt: CHECKED,
  },
  unihack_rules: {
    topic: 'unihack_rules',
    text:
      'Luật của ban tổ chức Team1 Vietnam UniHack 2026: phải có rule engine và mô hình ngôn ngữ không bao giờ là bên quyết định chuyển tiền; ' +
      'agent chạy sau policy contract có trần chi, danh sách cho phép và công tắc tắt; không dữ liệu cá nhân, âm thanh, bản ghi hay địa chỉ nhà trên chuỗi; ' +
      'không thị trường dự đoán hay thưởng ngẫu nhiên; tư vấn pháp lý hoặc tài chính có thu phí cần giấy phép. ' +
      'HụiSafe: luật tiền nằm trong hợp đồng, trợ lý chỉ đọc và tính, không có khóa, không có thành phần ngẫu nhiên trong sản phẩm.',
    citation: 'topics.json của ban tổ chức (team1vn.xyz), truy cập 06/11/2026',
    url: 'https://team1vn.xyz/topics.json',
    checkedAt: CHECKED,
  },
};
