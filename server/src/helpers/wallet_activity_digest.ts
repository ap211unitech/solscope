import { address } from "@solana/kit";
import { formatTokenAmount, rpc } from "@solscope/rpc";
import type { AnalyzedTransaction, WalletActivityDigest } from "@solscope/types";
import { analyzeTransaction, fetchParsedTransaction } from "./explain_transaction";

const TRANSACTION_FETCH_BATCH_SIZE = 5;
const TOP_RESULT_COUNT = 5;
const RECENT_TRANSACTION_COUNT = 10;

const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Account",
  ComputeBudget111111111111111111111111111111: "Compute Budget",
  Stake11111111111111111111111111111111111111: "Stake Program",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo",
  AddressLookupTab1e1111111111111111111111111: "Address Lookup Table",
};

const BOILERPLATE_PROGRAMS = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "ComputeBudget111111111111111111111111111111",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "AddressLookupTab1e1111111111111111111111111",
]);

function topEntries<TKey extends string>(counts: Map<TKey, number>, count: number) {
  return [...counts]
    .sort(([keyA, countA], [keyB, countB]) => countB - countA || keyA.localeCompare(keyB))
    .slice(0, count);
}

async function fetchTransactions(signatures: string[]) {
  const transactions = [];
  for (let start = 0; start < signatures.length; start += TRANSACTION_FETCH_BATCH_SIZE) {
    const batch = signatures.slice(start, start + TRANSACTION_FETCH_BATCH_SIZE);
    const batchTransactions = await Promise.all(
      batch.map((signature) => fetchParsedTransaction(signature)),
    );
    transactions.push(...batchTransactions);
  }
  return transactions;
}

export async function fetchWalletActivityDigest(
  walletAddress: string,
  limit: number,
): Promise<WalletActivityDigest> {
  const owner = address(walletAddress);
  const signatures = await rpc
    .getSignaturesForAddress(owner, { limit, commitment: "confirmed" })
    .send();

  if (signatures.length === 0) {
    return {
      walletAddress,
      requested: limit,
      analyzed: 0,
      transactionDataUnavailable: 0,
      periodStart: null,
      periodEnd: null,
      failedTransactions: 0,
      feesPaidByWalletSol: "0",
      feeTransactionsUnavailable: 0,
      categories: {},
      topPrograms: [],
      frequentCounterparties: [],
      recent: [],
      note: "No transactions found for this address.",
    };
  }

  const transactions = await fetchTransactions(signatures.map(({ signature }) => signature));
  const analyses: AnalyzedTransaction[] = [];
  let transactionDataUnavailable = 0;
  transactions.forEach((transaction, index) => {
    if (transaction) {
      analyses.push(analyzeTransaction(signatures[index].signature, transaction));
    } else {
      transactionDataUnavailable += 1;
    }
  });

  const categories = new Map<string, number>();
  const programs = new Map<string, number>();
  const counterparties = new Map<string, number>();
  let feesPaidLamports = 0n;
  let feeTransactionsUnavailable = 0;

  for (const analysis of analyses) {
    const category = analysis.category.category;
    categories.set(category, (categories.get(category) ?? 0) + 1);
    for (const program of analysis.programs) {
      if (!BOILERPLATE_PROGRAMS.has(program.id)) {
        programs.set(program.id, (programs.get(program.id) ?? 0) + 1);
      }
    }
    if (analysis.feePayer === walletAddress) {
      if (analysis.feeLamports === null) {
        feeTransactionsUnavailable += 1;
      } else {
        feesPaidLamports += analysis.feeLamports;
      }
    }

    const others = new Set<string>();
    for (const change of analysis.solChanges) {
      others.add(change.account);
    }
    for (const change of analysis.tokenChanges) {
      if (change.owner) {
        others.add(change.owner);
      }
    }
    others.delete(walletAddress);
    for (const account of others) {
      if (!Object.hasOwn(KNOWN_PROGRAMS, account)) {
        counterparties.set(account, (counterparties.get(account) ?? 0) + 1);
      }
    }
  }

  const times = analyses.flatMap((analysis) => (analysis.time ? [analysis.time] : [])).sort();
  return {
    walletAddress,
    requested: limit,
    analyzed: analyses.length,
    transactionDataUnavailable,
    periodStart: times[0] ?? null,
    periodEnd: times[times.length - 1] ?? null,
    failedTransactions: analyses.filter((analysis) => analysis.status === "failed").length,
    feesPaidByWalletSol: formatTokenAmount(feesPaidLamports, 9),
    feeTransactionsUnavailable,
    categories: Object.fromEntries(categories),
    topPrograms: topEntries(programs, TOP_RESULT_COUNT).map(([id, count]) => ({
      id,
      name: KNOWN_PROGRAMS[id] ?? null,
      count,
    })),
    frequentCounterparties: topEntries(counterparties, TOP_RESULT_COUNT).map(
      ([account, appearances]) => ({
        account,
        appearances,
      }),
    ),
    recent: analyses.slice(0, RECENT_TRANSACTION_COUNT).map((analysis) => ({
      signature: analysis.signature,
      time: analysis.time,
      category: analysis.category.category,
      summary: analysis.summary,
    })),
    note: "Categories and counterparties are heuristics derived from parsed instructions and balance changes; counterparties may include pools, vaults, or exchanges. Transaction details unavailable from the RPC are excluded from analysis.",
  };
}
