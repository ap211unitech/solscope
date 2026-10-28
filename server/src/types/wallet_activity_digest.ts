export type WalletActivityDigest = {
  walletAddress: string;
  requested: number;
  analyzed: number;
  transactionDataUnavailable: number;
  periodStart: string | null;
  periodEnd: string | null;
  failedTransactions: number;
  feesPaidByWalletSol: string;
  feeTransactionsUnavailable: number;
  categories: Record<string, number>;
  topPrograms: {
    id: string;
    name: string | null;
    count: number;
  }[];
  frequentCounterparties: {
    account: string;
    appearances: number;
  }[];
  recent: {
    signature: string;
    time: string | null;
    category: string;
    summary: string;
  }[];
  note: string;
};
