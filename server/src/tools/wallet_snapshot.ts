import type { ToolCallback } from "@modelcontextprotocol/server";
import { walletSnapshotSchema } from "@solscope/schemas";

export const getWalletSnapshot: ToolCallback<
  typeof walletSnapshotSchema
> = async ({ address }) => ({
  content: [{ type: "text", text: "running here.." }],
});
