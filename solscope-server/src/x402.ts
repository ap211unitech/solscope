import type { McpServer, ToolCallback } from "@modelcontextprotocol/server";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { createPaymentWrapper } from "@x402/mcp";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { APP_CONFIG } from "./config";
import z from "zod";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

// Single source of truth for pricing. Free tools simply aren't listed.
export const TOOL_PRICES = {
  get_wallet_portfolio: "$0.005",
  explain_transaction: "$0.01",
  token_risk_check: "$0.02",
  wallet_activity_digest: "$0.02",
} as const;

export type PaidToolName = keyof typeof TOOL_PRICES;

const facilitator = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});
const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register(SOLANA_DEVNET, new ExactSvmScheme());
await resourceServer.initialize();

// One payment wrapper per tool, once at startup
const wrappers = new Map<string, ReturnType<typeof createPaymentWrapper>>();
for (const [name, price] of Object.entries(TOOL_PRICES)) {
  const accepts = await resourceServer.buildPaymentRequirements({
    scheme: "exact",
    network: SOLANA_DEVNET,
    payTo: APP_CONFIG.solana.paytoAddress,
    price,
  });
  wrappers.set(name, createPaymentWrapper(resourceServer, { accepts }));
}

type Meta = Record<string, unknown>;
type SdkCtx = { mcpReq?: { _meta?: Meta }; _meta?: Meta };
type ToolResult = {
  content: ReadonlyArray<{ type: string; text?: string }>;
};

type PaidToolConfig<S extends z.ZodType> = {
  description: string;
  inputSchema: S;
};

export function registerPaidTool<S extends z.ZodType>(
  server: McpServer,
  name: PaidToolName,
  config: PaidToolConfig<S>,
  handler: ToolCallback<S>,
) {
  const paid = wrappers.get(name)!;

  const run = handler as unknown as (
    args: z.output<S>,
    ctx: unknown,
  ) => ToolResult | Promise<ToolResult>;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const wrapped = paid(async (args: z.output<S>) => {
    const result = await run(args, {});
    return {
      content: result.content.flatMap((item) =>
        item.type === "text" && item.text !== undefined
          ? [{ type: "text" as const, text: item.text }]
          : [],
      ),
    };
  });

  server.registerTool(
    name,
    {
      description: `${config.description} Costs ${TOOL_PRICES[name]} USDC per call.`,
      inputSchema: config.inputSchema,
    },
    ((args: z.output<S>, ctx: SdkCtx) =>
      wrapped(
        args as Record<string, unknown>,
        {
          toolName: name,
          _meta: ctx.mcpReq?._meta ?? ctx._meta,
        } as Parameters<typeof wrapped>[1],
      )) as never,
  );
}
