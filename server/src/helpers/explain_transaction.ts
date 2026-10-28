import { formatTokenAmount } from "@solscope/rpc";
import type {
  SolBalanceChange,
  TokenBalance,
  TokenBalanceChange,
  TransactionCategory,
} from "@solscope/types";

export function getTokenBalanceChanges(
  preTokenBalances: readonly TokenBalance[] | undefined,
  postTokenBalances: readonly TokenBalance[] | undefined,
  accountKeys: readonly string[],
): TokenBalanceChange[] {
  const balances = new Map<
    string,
    { accountIndex: number; owner: string | null; mint: string; decimals: number; amount: bigint }
  >();

  for (const balance of preTokenBalances ?? []) {
    const key = `${balance.accountIndex}:${balance.mint}`;
    balances.set(key, {
      accountIndex: balance.accountIndex,
      owner: balance.owner ?? null,
      mint: balance.mint,
      decimals: balance.uiTokenAmount.decimals,
      amount: -BigInt(balance.uiTokenAmount.amount),
    });
  }

  for (const balance of postTokenBalances ?? []) {
    const key = `${balance.accountIndex}:${balance.mint}`;
    const existing = balances.get(key);
    balances.set(key, {
      accountIndex: balance.accountIndex,
      owner: balance.owner ?? existing?.owner ?? null,
      mint: balance.mint,
      decimals: balance.uiTokenAmount.decimals,
      amount: (existing?.amount ?? 0n) + BigInt(balance.uiTokenAmount.amount),
    });
  }

  return [...balances.values()]
    .filter(({ amount }) => amount !== 0n)
    .map(({ accountIndex, owner, mint, decimals, amount }) => ({
      account: accountKeys[accountIndex] ?? `account index ${accountIndex}`,
      owner,
      mint,
      change: formatTokenAmount(amount, decimals),
    }));
}

export function getSolBalanceChanges(
  preBalances: readonly bigint[],
  postBalances: readonly bigint[],
  accountKeys: readonly string[],
): SolBalanceChange[] {
  return preBalances.flatMap((preBalance, index) => {
    const change = (postBalances[index] ?? preBalance) - preBalance;
    if (change === 0n) {
      return [];
    }

    return [
      {
        account: accountKeys[index] ?? `account index ${index}`,
        changeSol: formatTokenAmount(change, 9),
      },
    ];
  });
}

export function classifyTransaction(
  status: "failed" | "success" | "unknown",
  programNames: string[],
  instructionTypes: string[],
  tokenChanges: TokenBalanceChange[],
): TransactionCategory {
  if (status === "failed") {
    return { category: "failed", reason: "The transaction execution failed." };
  }
  if (status === "unknown") {
    return {
      category: "unknown",
      reason: "The RPC response did not include transaction execution metadata.",
    };
  }

  const programs = new Set(programNames.map((name) => name.toLowerCase()));
  const instructions = new Set(instructionTypes.map((type) => type.toLowerCase()));

  if (programs.has("stake") || [...instructions].some((type) => type.includes("stake"))) {
    return {
      category: "staking",
      reason: "A staking program or staking instruction was detected.",
    };
  }

  const changedMints = new Set(tokenChanges.map(({ mint }) => mint));
  if (changedMints.size >= 2) {
    return {
      category: "swap",
      reason: "The transaction changed balances for at least two token mints; this may be a swap.",
    };
  }

  if (
    [...instructions].some((type) => type.includes("transfer")) ||
    programs.has("system") ||
    programs.has("spl-token") ||
    programs.has("spl-token-2022")
  ) {
    return {
      category: "transfer",
      reason: "A system or token transfer instruction was detected.",
    };
  }

  return {
    category: "other",
    reason: "No recognized transfer, swap, or staking pattern was detected.",
  };
}
