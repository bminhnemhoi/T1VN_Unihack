import { describe, expect, it, vi } from 'vitest';
import { COPIED_MESSAGE, copyAddress, copyFailedMessage } from './copy-address';

const ADDR = '0xd231db0b842dE1C1B153511618341C659F7f7F29';

describe('copyAddress', () => {
  it('writes the full address and says "Đã sao chép"', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const notify = vi.fn();
    expect(await copyAddress(ADDR, write, notify)).toBe(true);
    expect(write).toHaveBeenCalledWith(ADDR);
    expect(notify).toHaveBeenCalledWith(COPIED_MESSAGE);
    expect(COPIED_MESSAGE).toMatch(/^Đã sao chép/);
  });

  it('when the browser refuses, shows an error that carries the address so it can be copied by hand', async () => {
    const notify = vi.fn();
    expect(await copyAddress(ADDR, () => Promise.reject(new Error('denied')), notify)).toBe(false);
    expect(notify).toHaveBeenCalledWith(copyFailedMessage(ADDR), 'error');
    expect(copyFailedMessage(ADDR)).toContain(ADDR);
  });
});
