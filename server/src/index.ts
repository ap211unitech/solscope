import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  explainTransactionSchema,
  walletPortfolioSchema,
  walletSnapshotSchema,
} from "@solscope/schemas";
import { explainTransaction, getWalletPortfolio, getWalletSnapshot } from "@solscope/tools";

function createServer(): McpServer {
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

  server.registerTool(
    "get_wallet_portfolio",
    {
      description:
        "Return the wallet's non-zero SPL Token and Token-2022 holdings with token names, symbols, and amounts when on-chain metadata is available.",
      inputSchema: walletPortfolioSchema,
    },
    getWalletPortfolio,
  );

  server.registerTool(
    "explain_transaction",
    {
      description:
        "Explain a Solana transaction in plain English: success/failure, fee, who signed, programs involved, SOL and token balance changes, and a heuristic category (swap, transfer, staking, or other).",
      inputSchema: explainTransactionSchema,
    },
    explainTransaction,
  );

  return server;
}

serveStdio(createServer, {
  onerror: (error) => console.error("[MCP server error]", error),
});
