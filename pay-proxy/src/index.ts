import { readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createx402MCPClient } from "@x402/mcp";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromBytes } from "@solana/kit";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

const signer = await createKeyPairSignerFromBytes(
  Uint8Array.from(JSON.parse(readFileSync(process.env.PAYER_KEYPAIR || "./payer.json", "utf8"))),
);

const remote = createx402MCPClient({
  name: "solscope-pay-proxy",
  version: "1.0.0",
  schemes: [{ network: SOLANA_DEVNET, client: new ExactSvmScheme(signer) }],
  autoPayment: true,
});
await remote.connect(new StreamableHTTPClientTransport(new URL(process.env.SERVER_URL!)));

const proxy = new Server(
  { name: "solscope-pay-proxy", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// Relay whatever tools the remote server has, schemas included
proxy.setRequestHandler(ListToolsRequestSchema, async () => remote.listTools());

let paidCalls = 0;

// Relay every call; the x402 client pays automatically if a 402 comes back
proxy.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    const result: any = await remote.callTool(name, args ?? {});
    console.error(
      "[pay-proxy]",
      name,
      JSON.stringify({
        isError: result.isError,
        paymentMade: result.paymentMade,
        text: result.content?.[0]?.text?.slice(0, 300),
      }),
    );
    if (result.paymentMade) paidCalls++;
    return { content: result.content ?? [], isError: result.isError };
  } catch (e) {
    console.error("[pay-proxy] call failed:", e);
    throw e;
  }
});

await proxy.connect(new StdioServerTransport());
