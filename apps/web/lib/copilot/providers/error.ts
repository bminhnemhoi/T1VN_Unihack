/**
 * Provider failures reach logs and callers with a status code only. SDK error messages can carry the
 * response body, and a gateway may echo the key back in it, so the original message is never kept.
 */
export class ProviderError extends Error {
  constructor(readonly status: number | undefined) {
    super(`Nhà cung cấp mô hình trả lỗi${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'ProviderError';
  }
  static from(e: unknown): ProviderError {
    const status = typeof (e as { status?: unknown } | null)?.status === 'number' ? (e as { status: number }).status : undefined;
    return new ProviderError(status);
  }
}
