import type { ToolCallback } from "@modelcontextprotocol/server";
import { analyzeTransaction, fetchParsedTransaction, jsonTextContent } from "@solscope/helpers";
import { explainTransactionSchema } from "@solscope/schemas";

export const explainTransaction: ToolCallback<typeof explainTransactionSchema> = async ({
  signature,
}) => {
  const transaction = await fetchParsedTransaction(signature);

  if (!transaction) {
    throw new Error(`Transaction not found: ${signature}`);
  }

  const analysis = analyzeTransaction(signature, transaction);
  return jsonTextContent({
    signature: analysis.signature,
    status: analysis.status,
    error: analysis.error,
    feeSol: analysis.feeSol,
    signers: analysis.signers,
    programs: analysis.programs.map(({ id: programId, name }) => ({ name, programId })),
    category: analysis.category,
    solBalanceChanges: analysis.solChanges,
    tokenBalanceChanges: analysis.tokenChanges,
    summary: analysis.summary,
  });
};
