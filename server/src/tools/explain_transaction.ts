import type { ToolCallback } from "@modelcontextprotocol/server";
import { formatTokenAmount, rpc } from "@solscope/rpc";
import { explainTransactionSchema } from "@solscope/schemas";

type TokenBalanceChange = {
  account: string;
  owner: string | null;
  mint: string;
  change: string;
};

type TokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
};

function getTokenBalanceChanges(
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

function getSolBalanceChanges(
  preBalances: readonly bigint[],
  postBalances: readonly bigint[],
  accountKeys: readonly string[],
): { account: string; changeSol: string }[] {
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

function classifyTransaction(
  status: "failed" | "success" | "unknown",
  programNames: string[],
  instructionTypes: string[],
  tokenChanges: TokenBalanceChange[],
): { category: string; reason: string } {
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

export const explainTransaction: ToolCallback<typeof explainTransactionSchema> = async ({
  signature,
}) => {
  const transaction = await rpc
    .getTransaction(signature, {
      commitment: "confirmed",
      encoding: "jsonParsed",
      maxSupportedTransactionVersion: 0,
    })
    .send();

  if (!transaction) {
    throw new Error(`Transaction not found: ${signature}`);
  }

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
  const programNames = instructions.map((instruction) =>
    "program" in instruction ? instruction.program : instruction.programId,
  );
  const instructionTypes = instructions.flatMap((instruction) =>
    "parsed" in instruction && instruction.parsed ? [instruction.parsed.type] : [],
  );
  const tokenBalanceChanges = getTokenBalanceChanges(
    transaction.meta?.preTokenBalances,
    transaction.meta?.postTokenBalances,
    accountKeys,
  );
  const solBalanceChanges = getSolBalanceChanges(
    transaction.meta?.preBalances ?? [],
    transaction.meta?.postBalances ?? [],
    accountKeys,
  );
  const status: "failed" | "success" | "unknown" =
    transaction.meta === null ? "unknown" : transaction.meta.err === null ? "success" : "failed";
  const category = classifyTransaction(status, programNames, instructionTypes, tokenBalanceChanges);
  const feeSol = transaction.meta ? formatTokenAmount(BigInt(transaction.meta.fee), 9) : null;
  const changeSummary = [
    ...solBalanceChanges.map(({ account, changeSol }) => `${account}: ${changeSol} SOL`),
    ...tokenBalanceChanges.map(
      ({ account, mint, change }) => `${account}: ${change} tokens of ${mint}`,
    ),
  ];
  const programs = [
    ...new Map(
      instructions.map((instruction) => [
        instruction.programId,
        {
          name: "program" in instruction ? instruction.program : null,
          programId: instruction.programId,
        },
      ]),
    ).values(),
  ];
  const result = {
    signature,
    status,
    error: status === "failed" ? transaction.meta?.err : null,
    feeSol,
    signers,
    programs,
    category,
    solBalanceChanges,
    tokenBalanceChanges,
    summary: [
      status === "failed"
        ? "Transaction failed."
        : status === "success"
          ? "Transaction succeeded."
          : "Transaction execution status is unknown because the RPC omitted metadata.",
      feeSol === null ? "Fee: unavailable." : `Fee: ${feeSol} SOL.`,
      signers.length ? `Signed by ${signers.join(", ")}.` : "No signers were reported.",
      programs.length
        ? `Programs involved: ${programs
            .map(({ name, programId }) => (name ? `${name} (${programId})` : programId))
            .join(", ")}.`
        : "No program instructions were reported.",
      changeSummary.length
        ? `Balance changes: ${changeSummary.join("; ")}.`
        : "No balance changes were reported.",
      `Heuristic category: ${category.category} (${category.reason})`,
    ].join(" "),
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
};
