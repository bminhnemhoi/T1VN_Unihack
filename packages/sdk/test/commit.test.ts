import { describe, expect, it } from 'vitest';
import {
  commitHash,
  loadSalt,
  newSalt,
  saltKey,
  saveSalt,
  type SaltRecord,
  type SaltStore,
} from '../src/commit';

const circle = '0x1111111111111111111111111111111111111111';
const member = '0x2222222222222222222222222222222222222222';

function memoryStore(): SaltStore & { data: Map<string, SaltRecord> } {
  const data = new Map<string, SaltRecord>();
  return {
    data,
    get: async (k) => data.get(k),
    set: async (k, v) => void data.set(k, v),
    list: async () => [...data.entries()],
  };
}

describe('commit', () => {
  it('newSalt gives 32 bytes and differs between calls', () => {
    const a = newSalt();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(newSalt()).not.toBe(a);
  });

  it('commitHash depends on every field', () => {
    const salt = `0x${'ab'.repeat(32)}` as const;
    const base = commitHash(circle, 1, member, 5n, salt);
    expect(base).toMatch(/^0x[0-9a-f]{64}$/);
    expect(commitHash(circle, 2, member, 5n, salt)).not.toBe(base);
    expect(commitHash(circle, 1, member, 6n, salt)).not.toBe(base);
    expect(commitHash(circle, 1n, member, 5n, salt)).toBe(base);
  });

  it('saves and loads a salt with a bigint bid', async () => {
    const store = memoryStore();
    const salt = newSalt();
    expect(await saveSalt(circle, 3, member, 4_931_506n, salt, store, () => 42)).toBe(true);
    expect(store.data.has(saltKey(circle, 3, member))).toBe(true);
    expect(await loadSalt(circle, 3, member, store)).toEqual({
      bid: 4_931_506n,
      salt,
      createdAt: 42,
    });
    expect(await loadSalt(circle, 4, member, store)).toBeUndefined();
  });

  it('never throws when storage fails', async () => {
    const broken: SaltStore = {
      get: async () => {
        throw new Error('blocked');
      },
      set: async () => {
        throw new Error('blocked');
      },
      list: async () => {
        throw new Error('blocked');
      },
    };
    expect(await saveSalt(circle, 1, member, 1n, newSalt(), broken)).toBe(false);
    expect(await loadSalt(circle, 1, member, broken)).toBeUndefined();
  });
});
