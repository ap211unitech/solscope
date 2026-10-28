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
