/**
 * Privacy filter applied to everything sent to the model (docs/07 3.8 item 2): Vietnamese phone numbers,
 * e-mails, 12-digit runs (CCCD) and wallet addresses (except the circle being viewed) become `[đã ẩn]`.
 */
export const REDACTED = '[đã ẩn]';

export function scrubPii(text: string, keepAddress?: string): string {
  const keep = keepAddress?.toLowerCase();
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, REDACTED)
    .replace(/0x[0-9a-fA-F]{40}/g, (m) => (keep && m.toLowerCase() === keep ? m : REDACTED))
    .replace(/(?<!\d)\d{12}(?!\d)/g, REDACTED)
    .replace(/(?<![\d.,])(?:\+?84|0)(?:[\s.-]?\d){9,10}(?![\d])/g, REDACTED);
}

/** Untrusted text must not be able to close or open our delimiter tags. */
export function neutralizeTags(text: string): string {
  return text.replace(/<\/?\s*(cau_hoi|lich_su|du_kien|du_lieu)\s*>/gi, '[thẻ đã bỏ]');
}

export function prepareUserText(text: string, keepAddress?: string): string {
  return neutralizeTags(scrubPii(text, keepAddress));
}
