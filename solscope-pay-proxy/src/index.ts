import { readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createx402MCPClient } from "@x402/mcp";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { registerProxyHandlers } from "./proxy";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

const CONFIG = {
  PAYER_KEYPAIR: process.env.PAYER_KEYPAIR!,
  SERVER_URL: process.env.SERVER_URL!,
};

const signer = await createKeyPairSignerFromBytes(
  Uint8Array.from(JSON.parse(readFileSync(CONFIG.PAYER_KEYPAIR, "utf8"))),
);

const remote = createx402MCPClient({
  name: "solscope-pay-proxy",
  version: "1.0.0",
  schemes: [{ network: SOLANA_DEVNET, client: new ExactSvmScheme(signer) }],
  autoPayment: true,
});
await remote.connect(new StreamableHTTPClientTransport(new URL(CONFIG.SERVER_URL)));

const proxy = new Server(
  { name: "solscope-pay-proxy", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

registerProxyHandlers(proxy, remote);

await proxy.connect(new StdioServerTransport());
