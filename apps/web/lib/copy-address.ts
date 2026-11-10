/** What the person sees after pressing "copy address": a plain confirmation, or the address itself when the browser refuses. */
export const COPIED_MESSAGE = 'Đã sao chép địa chỉ ví. Gửi địa chỉ này cho đội để nhận USDC thử nghiệm.';
export const copyFailedMessage = (address: string): string => `Máy không cho sao chép tự động. Hãy chép tay: ${address}`;

export type Notify = (message: string, kind?: 'error') => void;

/** Writes `address` to the clipboard and tells the person. Returns whether the copy worked. `write` is `navigator.clipboard.writeText`. */
export async function copyAddress(address: string, write: (text: string) => Promise<void>, notify: Notify): Promise<boolean> {
  try {
    await write(address);
    notify(COPIED_MESSAGE);
    return true;
  } catch {
    notify(copyFailedMessage(address), 'error');
    return false;
  }
}
