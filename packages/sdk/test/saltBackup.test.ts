import { describe, expect, it } from 'vitest';
import { exportSalts, importSalts, memorySaltStore, SaltBackupError } from '../src/saltBackup';

const SALT = `0x${'ab'.repeat(32)}` as const;
const ITER = 1000;

async function seeded() {
  const s = memorySaltStore();
  await s.set('0xc:1:0xm', { bid: '600000', salt: SALT, createdAt: 10 });
  await s.set('0xc:2:0xm', { bid: '0', salt: SALT, createdAt: 20 });
  return s;
}

describe('salt backup', () => {
  it('round trips through a password and does not leak plaintext', async () => {
    const file = await exportSalts(await seeded(), 'correct horse', ITER);
    expect(file).not.toContain('600000');
    expect(file).not.toContain('abab');
    const target = memorySaltStore();
    expect(await importSalts(target, file, 'correct horse')).toBe(2);
    expect(await target.get('0xc:1:0xm')).toEqual({ bid: '600000', salt: SALT, createdAt: 10 });
  });

  it('two exports differ (random salt and iv)', async () => {
    const s = await seeded();
    expect(await exportSalts(s, 'correct horse', ITER)).not.toBe(await exportSalts(s, 'correct horse', ITER));
  });

  it('wrong password and tampering are refused', async () => {
    const file = await exportSalts(await seeded(), 'correct horse', ITER);
    await expect(importSalts(memorySaltStore(), file, 'wrong password')).rejects.toMatchObject({ code: 'WrongPassword' });
    const j = JSON.parse(file);
    j.data = j.data.slice(0, -4) + 'AAAA';
    await expect(importSalts(memorySaltStore(), JSON.stringify(j), 'correct horse')).rejects.toBeInstanceOf(SaltBackupError);
  });

  it('weak password, junk file and absurd iteration counts are refused', async () => {
    await expect(exportSalts(await seeded(), 'short', ITER)).rejects.toMatchObject({ code: 'WeakPassword' });
    await expect(importSalts(memorySaltStore(), 'not json', 'correct horse')).rejects.toMatchObject({ code: 'BadFile' });
    const file = JSON.parse(await exportSalts(await seeded(), 'correct horse', ITER));
    file.iterations = 4_000_000_000;
    await expect(importSalts(memorySaltStore(), JSON.stringify(file), 'correct horse')).rejects.toMatchObject({ code: 'BadFile' });
  });

  it('import keeps a newer local entry and writes a newer backup entry', async () => {
    const file = await exportSalts(await seeded(), 'correct horse', ITER);
    const target = memorySaltStore();
    await target.set('0xc:1:0xm', { bid: '1', salt: SALT, createdAt: 99 }); // newer locally
    await target.set('0xc:2:0xm', { bid: '2', salt: SALT, createdAt: 1 }); // older locally
    expect(await importSalts(target, file, 'correct horse')).toBe(1);
    expect((await target.get('0xc:1:0xm'))!.bid).toBe('1');
    expect((await target.get('0xc:2:0xm'))!.bid).toBe('0');
  });
});
