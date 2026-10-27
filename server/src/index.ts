import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { walletSnapshotSchema } from "@solscope/schemas";
import { getWalletSnapshot } from "@solscope/tools";

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

  return server;
}

serveStdio(createServer, {
  onerror: (error) => console.error("[MCP server error]", error),
});
