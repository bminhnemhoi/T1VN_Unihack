/**
 * Privy access-token verification behind an interface so tests (and the local anvil rehearsal) can fake it.
 * The real adapter uses the official `@privy-io/node` SDK: `utils().auth().verifyAccessToken` for the token, then the
 * user's Ethereum embedded wallet from `linked_accounts`. It keeps no personal data: only the Privy user id (a DID)
 * and the wallet address leave this module, and the DID is only ever hashed into `attestationId`.
 */
import { PrivyClient } from '@privy-io/node';

type Address = `0x${string}`;

export class InvalidTokenError extends Error {}
export class NoWalletError extends Error {}

export interface PrivyVerifier {
  /** Checks the access token only (cheap, local JWT check). Throws InvalidTokenError. Returns the Privy DID. */
  verifyToken(accessToken: string): Promise<{ userId: string }>;
  /** Looks up the user's Ethereum embedded wallet (a Privy API call: rate limit the user first). Throws NoWalletError. */
  walletOf(userId: string): Promise<Address>;
}

const isAddress = (v: unknown): v is Address => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);

export function createPrivyVerifier(appId: string, appSecret: string): PrivyVerifier {
  const client = new PrivyClient({ appId, appSecret });
  return {
    async verifyToken(accessToken) {
      try {
        const claims = await client.utils().auth().verifyAccessToken(accessToken);
        return { userId: claims.user_id };
      } catch {
        throw new InvalidTokenError('invalid access token');
      }
    },
    async walletOf(userId) {
      const user = await client.users()._get(userId);
      // Deterministic choice when a user has several embedded wallets: the earliest verified one, then by address.
      const wallets = user.linked_accounts
        .filter(
          (a) =>
            a.type === 'wallet' &&
            a.chain_type === 'ethereum' &&
            'connector_type' in a &&
            a.connector_type === 'embedded' &&
            isAddress(a.address),
        )
        .map((a) => ({
          address: (a as { address: Address }).address,
          at: (a as { first_verified_at: number | null }).first_verified_at ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((x, y) => x.at - y.at || x.address.localeCompare(y.address));
      const first = wallets[0];
      if (!first) throw new NoWalletError('no embedded wallet');
      return first.address;
    },
  };
}
