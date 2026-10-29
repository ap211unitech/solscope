import { address, createSolanaRpc } from "@solana/kit";
import { APP_CONFIG } from "@solscope/config";
import NodeCache from "node-cache";

export const rpc = createSolanaRpc(APP_CONFIG.solana.rpcUrl);

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const sign = amount < 0n ? "-" : "";
  const absoluteAmount = amount < 0n ? -amount : amount;

  if (decimals === 0) {
    return `${sign}${absoluteAmount}`;
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = absoluteAmount / divisor;
  const fractional = (absoluteAmount % divisor)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return fractional ? `${sign}${whole}.${fractional}` : `${sign}${whole}`;
}

export const TOKEN_PROGRAM_ADDRESSES = [
  address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
];

export const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Account",
  ComputeBudget111111111111111111111111111111: "Compute Budget",
  Stake11111111111111111111111111111111111111: "Stake Program",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo",
  AddressLookupTab1e1111111111111111111111111: "Address Lookup Table",
};

export const METADATA_PROGRAM_ADDRESS = address("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const CACHE_OPTIONS = {
  stdTTL: 15,
  checkperiod: 30,
};

export function createRpcCache(): NodeCache {
  return new NodeCache(CACHE_OPTIONS);
}

export async function getCachedValue<T>(
  cache: NodeCache,
  key: string,
  fetchValue: () => Promise<T>,
): Promise<T> {
  const cachedValue = cache.get<T>(key);

  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const value = await fetchValue();
  cache.set(key, value);
  return value;
}
