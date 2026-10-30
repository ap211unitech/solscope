import { McpServer } from "@modelcontextprotocol/server";
import {
  explainTransactionSchema,
  tokenRiskCheckSchema,
  walletPortfolioSchema,
  walletActivityDigestSchema,
  walletSnapshotSchema,
} from "@solscope/schemas";
import {
  checkTokenRisk,
  explainTransaction,
  getWalletActivityDigest,
  getWalletPortfolio,
  getWalletSnapshot,
} from "@solscope/tools";
import { registerPaidTool } from "./x402";

export const createMcpServer = (): McpServer => {
  const server = new McpServer({
    name: "solscope-mcp-server",
    version: "1.0.0",
  });

  server.registerTool(
    "get_wallet_snapshot",
    {
      description:
        "Return the wallet's SOL balance and the number of SPL Token and Token-2022 accounts.",
      inputSchema: walletSnapshotSchema,
    },
    getWalletSnapshot,
  );

  registerPaidTool(
    server,
    "get_wallet_portfolio",
    {
      description:
        "Return the wallet's non-zero SPL Token and Token-2022 holdings with token names, symbols, and amounts when on-chain metadata is available.",
      inputSchema: walletPortfolioSchema,
    },
    getWalletPortfolio,
  );

  registerPaidTool(
    server,
    "explain_transaction",
    {
      description:
        "Explain a Solana transaction in plain English: success/failure, fee, who signed, programs involved, SOL and token balance changes, and a heuristic category (swap, transfer, staking, or other).",
      inputSchema: explainTransactionSchema,
    },
    explainTransaction,
  );

  registerPaidTool(
    server,
    "token_risk_check",
    {
      description:
        "Return a heuristic token risk report with GoPlus holder rankings, security checks, metadata, markets, and liquidity-provider data, cross-checked against Solana RPC mint, supply, authorities, and Token-2022 extensions. Not investment advice.",
      inputSchema: tokenRiskCheckSchema,
    },
    checkTokenRisk,
  );

  registerPaidTool(
    server,
    "wallet_activity_digest",
    {
      description:
        "Summarize recent wallet transactions by activity category, fees paid, frequently used programs, and probable counterparties. Transaction classifications and counterparties are heuristic.",
      inputSchema: walletActivityDigestSchema,
    },
    getWalletActivityDigest,
  );

  return server;
};
