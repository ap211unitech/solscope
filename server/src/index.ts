import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { walletSnapshotSchema } from "@solscope/schemas";
import { getWalletSnapshot } from "@solscope/tools";

function createServer(): McpServer {
  const server = new McpServer({
    name: "solscope-mcp-server",
    version: "1.0.0",
  });

  server.registerTool(
    "greet",
    {
      description: "Greet someone by name.",
      inputSchema: z.object({
        name: z.string().min(1),
      }),
    },
    async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    }),
  );

  server.registerTool(
    "get_wallet_snapshot",
    {
      description: `Return wallet snapshot i.e. it's SOL balance and number of token accounts`,
      inputSchema: walletSnapshotSchema,
    },
    getWalletSnapshot,
  );

  return server;
}

serveStdio(createServer, {
  onerror: (error) => console.error("[MCP server error]", error),
});
