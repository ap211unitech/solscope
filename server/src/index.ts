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
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { APP_CONFIG } from "./config";
import { paidTokenRisk } from "./x402";

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

  type RiskArgs = Parameters<typeof checkTokenRisk>[0];
  type RiskCtx = Parameters<typeof checkTokenRisk>[1];

  server.registerTool(
    "token_risk_check",
    {
      description:
        "Return a heuristic token risk report with GoPlus holder rankings, security checks, metadata, markets, and liquidity-provider data, cross-checked against Solana RPC mint, supply, authorities, and Token-2022 extensions. Not investment advice.",
      inputSchema: tokenRiskCheckSchema,
    },
    paidTokenRisk(async (args: RiskArgs) => {
      console.error("[HANDLER] token_risk_check EXECUTED");

      const result = await checkTokenRisk(args, {} as RiskCtx);

      return {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        content: result.content.flatMap((item) =>
          item.type === "text" ? [{ type: "text" as const, text: item.text }] : [],
        ),
      };
    }),
  );

  server.registerTool(
    "wallet_activity_digest",
    {
      description:
        "Summarize recent wallet transactions by activity category, fees paid, frequently used programs, and probable counterparties. Transaction classifications and counterparties are heuristic.",
      inputSchema: walletActivityDigestSchema,
    },
    getWalletActivityDigest,
  );

  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req: Request, res: Response) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[MCP server error]", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const methodNotAllowed = (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
};

app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

const PORT = APP_CONFIG.port;
app.listen(PORT, () => {
  console.log(`solscope-mcp-server listening on http://localhost:${PORT}/mcp`);
});
