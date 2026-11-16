import assert from "node:assert/strict";
import { test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { registerProxyHandlers } from "../dist/proxy.js";

async function createConnectedProxy(remote) {
  const server = new Server(
    { name: "proxy-test", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  registerProxyHandlers(server, remote);

  const client = new Client({ name: "proxy-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  return { client, server };
}

test("proxy relays tool definitions from the remote server", async () => {
  const tools = [
    { name: "sample_tool", description: "Sample", inputSchema: { type: "object", properties: {} } },
  ];
  const remote = {
    async listTools() {
      return { tools };
    },
    async callTool() {
      throw new Error("not used");
    },
  };
  const { client, server } = await createConnectedProxy(remote);

  try {
    assert.deepEqual((await client.listTools()).tools, tools);
  } finally {
    await client.close();
    await server.close();
  }
});

test("proxy forwards tool arguments and returns remote content and error status", async () => {
  let call;
  const remote = {
    async listTools() {
      return { tools: [] };
    },
    async callTool(name, args) {
      call = { name, args };
      return {
        content: [{ type: "text", text: "remote result" }],
        isError: true,
        paymentMade: true,
      };
    },
  };
  const { client, server } = await createConnectedProxy(remote);

  try {
    const result = await client.callTool({ name: "sample_tool", arguments: { wallet: "abc" } });
    assert.deepEqual(call, { name: "sample_tool", args: { wallet: "abc" } });
    assert.deepEqual(result.content, [{ type: "text", text: "remote result" }]);
    assert.equal(result.isError, true);
    assert.equal("paymentMade" in result, false);
  } finally {
    await client.close();
    await server.close();
  }
});
