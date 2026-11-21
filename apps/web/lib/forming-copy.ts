/**
 * Wording of the forming-circle page. The bond belongs to the organizer, so a member who is not the organizer must
 * never read "Ký quỹ của bạn" or "bạn rút lại ký quỹ" (issue #15). Countdown sentence = head + <timer> + tail.
 */
export function formingCopy(o: { organizerView: boolean; full: boolean; n: number }) {
  const countdownHead = o.full ? `Đã đủ ${o.n} người. Còn` : 'Còn';
  const lapse = o.organizerView
    ? 'thì dây tự hủy và bạn rút lại ký quỹ.'
    : 'thì dây tự hủy; bạn không mất tiền, nên thu hồi quyền trích trong ví.';
  const countdownTail = o.full
    ? `để bấm "Bắt đầu dây"; quá hạn mà chưa bắt đầu ${lapse}`
    : `để mời đủ người. Quá hạn mà chưa đủ ${lapse}`;
  return {
    countdownHead,
    countdownTail,
    bondTitle: o.organizerView ? 'Ký quỹ của bạn' : 'Ký quỹ của chủ hụi',
    bondNote: o.organizerView
      ? 'Hết dây bạn lấy lại ký quỹ, chỉ mất phần đã dùng để bù cho người bỏ đóng.'
      : 'Ký quỹ là tiền của chủ hụi, khóa trong smart contract để bù khi có người bỏ đóng.',
  };
}
