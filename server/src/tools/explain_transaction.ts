import type { ToolCallback } from "@modelcontextprotocol/server";
import { formatTokenAmount, rpc } from "@solscope/rpc";
import {
  classifyTransaction,
  getSolBalanceChanges,
  getTokenBalanceChanges,
  jsonTextContent,
} from "@solscope/helpers";
import { explainTransactionSchema } from "@solscope/schemas";

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

  return jsonTextContent(result);
};
