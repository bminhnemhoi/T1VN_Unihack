/** Sealed-bid helpers (docs/03 section 6.2, docs/05 sections 5.4 and 13). No randomness picks winners; salt only hides the bid. */
import { bytesToHex, encodeAbiParameters, keccak256 } from 'viem';

type Address = `0x${string}`;
type Hex = `0x${string}`;

/** keccak256(abi.encode(circle, round, member, bid, salt)), same as Solidity `HuiCircle`. */
export function commitHash(
  circle: Address,
  round: number | bigint,
  member: Address,
  bid: bigint,
  salt: Hex,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint32' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
      ],
      [circle, Number(round), member, bid, salt],
    ),
  );
}

/** 32 random bytes from the Web Crypto API, as 0x-hex. */
export function newSalt(): Hex {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

export interface SaltRecord {
  bid: string; // bigint as decimal string (JSON/IndexedDB safe)
  salt: Hex;
  createdAt: number;
}

/** Storage seam so tests can inject a fake. */
export interface SaltStore {
  get(key: string): Promise<SaltRecord | undefined>;
  set(key: string, value: SaltRecord): Promise<void>;
  list(): Promise<Array<[string, SaltRecord]>>;
}

export const saltKey = (circle: Address, round: number | bigint, member: Address): string =>
  `${circle}:${round}:${member}`.toLowerCase();

const DB_NAME = 'huisafe';
const STORE = 'salts';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
  });
}

/** Browser store: IndexedDB `huisafe` / `salts`. Callers must wrap use in try/catch (docs/05 section 13). */
export const indexedDbSaltStore: SaltStore = {
  async get(key) {
    const db = await openDb();
    return (await req(db.transaction(STORE).objectStore(STORE).get(key))) as SaltRecord | undefined;
  },
  async set(key, value) {
    const db = await openDb();
    // Wait for the transaction itself (not just the request) with strict durability: a salt must be on disk before the
    // commit is sent, or a tab closed right after sending could lose it.
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' });
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB write failed'));
      };
    });
  },
  async list() {
    const db = await openDb();
    const store = db.transaction(STORE).objectStore(STORE);
    const [keys, values] = await Promise.all([req(store.getAllKeys()), req(store.getAll())]);
    return keys.map((k, i) => [String(k), values[i] as SaltRecord]);
  },
};

/** Save a bid and its salt. Returns false instead of throwing when storage is unavailable. */
export async function saveSalt(
  circle: Address,
  round: number | bigint,
  member: Address,
  bid: bigint,
  salt: Hex,
  store: SaltStore = indexedDbSaltStore,
  now: () => number = Date.now,
): Promise<boolean> {
  try {
    await store.set(saltKey(circle, round, member), {
      bid: bid.toString(),
      salt,
      createdAt: now(),
    });
    return true;
  } catch {
    return false;
  }
}

/** Load a saved bid and salt, or undefined if missing or storage is unavailable. */
export async function loadSalt(
  circle: Address,
  round: number | bigint,
  member: Address,
  store: SaltStore = indexedDbSaltStore,
): Promise<{ bid: bigint; salt: Hex; createdAt: number } | undefined> {
  try {
    const rec = await store.get(saltKey(circle, round, member));
    if (!rec) return undefined;
    return { bid: BigInt(rec.bid), salt: rec.salt, createdAt: rec.createdAt };
  } catch {
    return undefined;
  }
}
