import { assertIsSignature } from "@solana/kit";
import { formatTokenAmount, rpc } from "@solscope/rpc";
import type {
  AnalyzedTransaction,
  SolBalanceChange,
  TokenBalance,
  TokenBalanceChange,
  TransactionCategory,
} from "@solscope/types";

export function fetchParsedTransaction(signature: string) {
  assertIsSignature(signature);
  return rpc
    .getTransaction(signature, {
      commitment: "confirmed",
      encoding: "jsonParsed",
      maxSupportedTransactionVersion: 1,
    })
    .send();
}

type ParsedTransaction = NonNullable<Awaited<ReturnType<typeof fetchParsedTransaction>>>;

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

  const programs = new Set(
    programNames
      .filter((name): name is string => typeof name === "string")
      .map((name) => name.toLowerCase()),
  );
  const instructions = new Set(
    instructionTypes
      .filter((type): type is string => typeof type === "string")
      .map((type) => type.toLowerCase()),
  );

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

export function analyzeTransaction(
  signature: string,
  transaction: ParsedTransaction,
): AnalyzedTransaction {
  const accountKeys = transaction.transaction.message.accountKeys.map((key) =>
    typeof key === "string" ? key : key.pubkey,
  );
  const signers = transaction.transaction.message.accountKeys.flatMap((key) =>
    typeof key === "string" || !key.signer ? [] : [key.pubkey],
  );
  const instructions = [
    ...transaction.transaction.message.instructions,
    ...(transaction.meta?.innerInstructions?.flatMap((group) => group.instructions) ?? []),
  ];
  const programNames = instructions.flatMap((instruction) => {
    const name = "program" in instruction ? instruction.program : instruction.programId;
    return typeof name === "string" ? [name] : [];
  });
  const instructionTypes = instructions.flatMap((instruction) =>
    "parsed" in instruction && typeof instruction.parsed?.type === "string"
      ? [instruction.parsed.type]
      : [],
  );
  const tokenChanges = getTokenBalanceChanges(
    transaction.meta?.preTokenBalances,
    transaction.meta?.postTokenBalances,
    accountKeys,
  );
  const solChanges = getSolBalanceChanges(
    transaction.meta?.preBalances ?? [],
    transaction.meta?.postBalances ?? [],
    accountKeys,
  );
  const status: "failed" | "success" | "unknown" =
    transaction.meta === null ? "unknown" : transaction.meta.err === null ? "success" : "failed";
  const category = classifyTransaction(status, programNames, instructionTypes, tokenChanges);
  const programsById = new Map<string, { id: string; name: string | null }>();
  for (const instruction of instructions) {
    if (typeof instruction.programId !== "string") {
      continue;
    }
    const name = "program" in instruction ? instruction.program : null;
    programsById.set(instruction.programId, {
      id: instruction.programId,
      name: typeof name === "string" ? name : null,
    });
  }
  const programs = [...programsById.values()];
  const feeLamports = transaction.meta ? BigInt(transaction.meta.fee) : null;
  const feeSol = feeLamports === null ? null : formatTokenAmount(feeLamports, 9);
  const feePayer = accountKeys[0] ?? null;
  const changeSummary = [
    ...solChanges.map(({ account, changeSol }) => `${account}: ${changeSol} SOL`),
    ...tokenChanges.map(({ account, mint, change }) => `${account}: ${change} tokens of ${mint}`),
  ];
  const summary = [
    status === "failed"
      ? "Transaction failed."
      : status === "success"
        ? "Transaction succeeded."
        : "Transaction execution status is unknown because the RPC omitted metadata.",
    feeSol === null ? "Fee: unavailable." : `Fee: ${feeSol} SOL.`,
    signers.length ? `Signed by ${signers.join(", ")}.` : "No signers were reported.",
    programs.length
      ? `Programs involved: ${programs
          .map(({ name, id }) => (name ? `${name} (${id})` : id))
          .join(", ")}.`
      : "No program instructions were reported.",
    changeSummary.length
      ? `Balance changes: ${changeSummary.join("; ")}.`
      : "No balance changes were reported.",
    `Heuristic category: ${category.category} (${category.reason})`,
  ].join(" ");

  return {
    signature,
    time:
      transaction.blockTime === null
        ? null
        : new Date(Number(transaction.blockTime) * 1_000).toISOString(),
    status,
    success: status === "success",
    error: status === "failed" ? transaction.meta?.err : null,
    category,
    feePayer,
    feeLamports,
    feeSol,
    signers,
    programs,
    solChanges,
    tokenChanges,
    summary,
  };
}
