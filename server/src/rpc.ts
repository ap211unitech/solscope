import { address, createSolanaRpc } from "@solana/kit";
import { APP_CONFIG } from "@solscope/config";
import NodeCache from "node-cache";

export const rpc = createSolanaRpc(APP_CONFIG.solana.rpcUrl);

export function formatTokenAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) {
    return amount.toString();
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fractional = (amount % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");

  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export const TOKEN_PROGRAM_ADDRESSES = [
  address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
];

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
