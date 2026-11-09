/**
 * Password-encrypted backup of the sealed-bid salts (docs/05 section 13): Web Crypto only, PBKDF2-SHA256 for the key
 * and AES-256-GCM for the data. The file holds `{ bid, salt }` per `circle:round:member` key; losing a salt means the
 * bid cannot be revealed, so the UI offers this export. The password never leaves the device.
 */
import type { SaltRecord, SaltStore } from './commit';

export const SALT_BACKUP_VERSION = 1;
/** OWASP 2023 guidance for PBKDF2-HMAC-SHA256. Tests lower it. */
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;
const MIN_PASSWORD_LENGTH = 8;

export class SaltBackupError extends Error {
  constructor(
    public readonly code: 'WeakPassword' | 'BadFile' | 'WrongPassword',
    message: string,
  ) {
    super(message);
  }
}

export interface SaltBackupFile {
  v: number;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64, 16 bytes, random per file
  iv: string; // base64, 12 bytes, random per file
  data: string; // base64 AES-GCM ciphertext (includes the tag)
}

const b64 = (u: Uint8Array): string => {
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const material = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt every salt in `store`. Returns the JSON text to save as a file. */
export async function exportSalts(
  store: SaltStore,
  password: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS,
  /** Keep only matching keys (e.g. the current wallet's), so one backup does not carry other wallets' salts. */
  filter?: (key: string) => boolean,
): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new SaltBackupError('WeakPassword', `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
  const entries = (await store.list()).filter(([k]) => (filter ? filter(k) : true));
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const plain = new TextEncoder().encode(JSON.stringify(entries));
  const cipher = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const file: SaltBackupFile = {
    v: SALT_BACKUP_VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: b64(salt),
    iv: b64(iv),
    data: b64(cipher),
  };
  return JSON.stringify(file);
}

const isRecord = (r: unknown): r is SaltRecord => {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return typeof o.bid === 'string' && /^\d+$/.test(o.bid) && typeof o.salt === 'string' && /^0x[0-9a-fA-F]{64}$/.test(o.salt) && typeof o.createdAt === 'number';
};

/**
 * Decrypt a backup and write its entries into `store`. An existing entry is kept unless the backup holds a newer one
 * (by `createdAt`). Returns the number of entries written. Wrong password or tampering gives `WrongPassword`.
 */
export async function importSalts(store: SaltStore, fileText: string, password: string): Promise<number> {
  let file: SaltBackupFile;
  try {
    file = JSON.parse(fileText) as SaltBackupFile;
  } catch {
    throw new SaltBackupError('BadFile', 'File sao lưu không đọc được.');
  }
  if (
    file.v !== SALT_BACKUP_VERSION ||
    file.kdf !== 'PBKDF2-SHA256' ||
    typeof file.iterations !== 'number' ||
    !Number.isInteger(file.iterations) ||
    file.iterations < 1_000 ||
    file.iterations > 2_000_000 ||
    typeof file.salt !== 'string' ||
    typeof file.iv !== 'string' ||
    typeof file.data !== 'string'
  ) {
    throw new SaltBackupError('BadFile', 'File sao lưu không đúng định dạng.');
  }
  let saltBytes: Uint8Array<ArrayBuffer>;
  let ivBytes: Uint8Array<ArrayBuffer>;
  let dataBytes: Uint8Array<ArrayBuffer>;
  try {
    saltBytes = unb64(file.salt);
    ivBytes = unb64(file.iv);
    dataBytes = unb64(file.data);
  } catch {
    throw new SaltBackupError('BadFile', 'File sao lưu không đúng định dạng.');
  }
  if (saltBytes.length !== 16 || ivBytes.length !== 12) throw new SaltBackupError('BadFile', 'File sao lưu không đúng định dạng.');
  let entries: unknown;
  try {
    const key = await deriveKey(password, saltBytes, file.iterations);
    const plain = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, dataBytes);
    entries = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new SaltBackupError('WrongPassword', 'Sai mật khẩu hoặc file đã bị sửa.');
  }
  if (!Array.isArray(entries)) throw new SaltBackupError('BadFile', 'File sao lưu không đúng định dạng.');
  let written = 0;
  for (const e of entries) {
    if (!Array.isArray(e) || typeof e[0] !== 'string' || !isRecord(e[1])) continue;
    const existing = await store.get(e[0]);
    if (existing && existing.createdAt >= e[1].createdAt) continue;
    await store.set(e[0], e[1]);
    written++;
  }
  return written;
}

/** In-memory store for tests and the local rehearsal. */
export function memorySaltStore(): SaltStore & { size(): number } {
  const m = new Map<string, SaltRecord>();
  return {
    async get(k) {
      return m.get(k);
    },
    async set(k, v) {
      m.set(k, v);
    },
    async list() {
      return [...m.entries()];
    },
    size: () => m.size,
  };
}
