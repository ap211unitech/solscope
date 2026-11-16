import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

type RemoteClient = Pick<
  ReturnType<typeof import("@x402/mcp").createx402MCPClient>,
  "listTools" | "callTool"
>;

export function registerProxyHandlers(proxy: Server, remote: RemoteClient): void {
  // Relay whatever tools the remote server has, schemas included
  proxy.setRequestHandler(ListToolsRequestSchema, async () => remote.listTools());

  // Relay every call; the x402 client pays automatically if a 402 comes back
  proxy.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    try {
      const result = await remote.callTool(name, args ?? {});
      const firstText = result.content?.find((item) => item.type === "text");
      console.error(
        "[pay-proxy]",
        name,
        JSON.stringify({
          isError: result.isError,
          paymentMade: result.paymentMade,
          text:
            firstText?.type === "text" && typeof firstText.text === "string"
              ? firstText.text.slice(0, 300)
              : undefined,
        }),
      );
      return { content: result.content ?? [], isError: result.isError };
    } catch (error) {
      console.error("[pay-proxy] call failed:", error);
      throw error;
    }
  });
}
