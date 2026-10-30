export type TokenBalanceChange = {
  account: string;
  owner: string | null;
  mint: string;
  change: string;
};

export type TokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
};

export type SolBalanceChange = {
  account: string;
  changeSol: string;
};

export type TransactionCategory = {
  category: string;
  reason: string;
};

export type AnalyzedTransaction = {
  signature: string;
  time: string | null;
  status: "failed" | "success" | "unknown";
  success: boolean;
  category: TransactionCategory;
  feePayer: string | null;
  feeLamports: bigint | null;
  feeSol: string | null;
  error: unknown | null;
  signers: string[];
  programs: {
    id: string;
    name: string | null;
  }[];
  solChanges: SolBalanceChange[];
  tokenChanges: TokenBalanceChange[];
  summary: string;
};
