export type TokenHolding = {
  mint: string;
  name: string;
  symbol: string | null;
  amount: string;
  decimals: number;
};

export type WalletPortfolio = {
  walletAddress: string;
  holdings: TokenHolding[];
};

export type AggregatedHolding = {
  mint: string;
  amount: bigint;
  decimals: number;
};

export type TokenMetadata = {
  name: string;
  symbol: string;
};
