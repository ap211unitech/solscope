export type GoPlusAuthority = {
  address: string;
  malicious_address: number | null;
};

export type GoPlusAuthorityCheck = {
  status: string | null;
  authorities: GoPlusAuthority[];
};

export type GoPlusHolder = {
  account: string;
  balance: string;
  percent: number | null;
  tokenAccounts: string[];
  tag: string | null;
  locked: boolean | null;
  lockedDetail: unknown;
};

export type GoPlusMarket = {
  dex: string;
  address: string;
  type: string | null;
  price: string | null;
  tvl: string | null;
  feeRate: string | null;
  lpAmount: string | null;
  burnPercent: string | null;
  openTime: string | null;
  volume24h: string | null;
  volume7d: string | null;
  volume30d: string | null;
};

export type GoPlusTokenData = {
  totalSupply: string;
  holderCount: number | null;
  holders: GoPlusHolder[];
  metadata: {
    name: string | null;
    symbol: string | null;
    description: string | null;
    uri: string | null;
  };
  checks: {
    mintable: GoPlusAuthorityCheck;
    freezable: GoPlusAuthorityCheck;
    metadataMutable: GoPlusAuthorityCheck;
    closable: GoPlusAuthorityCheck;
    balanceMutable: GoPlusAuthorityCheck;
    defaultAccountState: number | string | null;
    nonTransferable: string | null;
    transferFee: unknown;
    transferFeeUpgradable: GoPlusAuthorityCheck;
    transferHook: unknown;
    transferHookUpgradable: GoPlusAuthorityCheck;
    defaultAccountStateUpgradable: GoPlusAuthorityCheck;
    trustedToken: number | string | null;
  };
  markets: GoPlusMarket[];
  lpHolders: Record<string, unknown>[];
  creators: Record<string, unknown>[];
};

export type RiskFlag = {
  severity: "high" | "medium" | "info";
  code: string;
  message: string;
};

export type TokenRiskReport = {
  mintAddress: string;
  tokenProgram: "spl-token" | "token-2022";
  metadata: GoPlusTokenData["metadata"];
  supply: {
    onChain: string;
    goPlus: string;
    decimals: number;
    differencePercent: string | null;
    matchesWithinOnePercent: boolean | null;
  };
  authorities: {
    onChain: {
      mint: string | null;
      freeze: string | null;
    };
    goPlus: {
      mint: GoPlusAuthorityCheck;
      freeze: GoPlusAuthorityCheck;
    };
    agrees: {
      mint: boolean | null;
      freeze: boolean | null;
    };
  };
  goPlusChecks: GoPlusTokenData["checks"];
  token2022Extensions: string[] | null;
  holderData: {
    provider: "GoPlus Solana Token Security API (Beta)";
    holderCount: number | null;
    rankedHoldersReturned: number;
    retrievedAt: string;
  };
  holders: GoPlusHolder[];
  concentration: {
    basis: "GoPlus holder percentages";
    top1Percent: number | null;
    top5Percent: number | null;
    top10Percent: number | null;
  };
  markets: GoPlusMarket[];
  lpHolders: Record<string, unknown>[];
  creators: Record<string, unknown>[];
  riskLevel: "high" | "medium" | "low" | "inconclusive";
  flags: RiskFlag[];
  disclaimer: string;
};

export type MintDetails = {
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  extensions: string[];
  extensionsAvailable: boolean;
};

export type SupplyComparison = {
  differencePercent: string | null;
  matchesWithinOnePercent: boolean | null;
};
