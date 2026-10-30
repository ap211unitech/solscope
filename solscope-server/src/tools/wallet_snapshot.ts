import type { ToolCallback } from "@modelcontextprotocol/server";
import { createRpcCache, getCachedValue } from "@solscope/rpc";
import { jsonTextContent, fetchWalletSnapshot } from "@solscope/helpers";
import { walletSnapshotSchema } from "@solscope/schemas";

const snapshotCache = createRpcCache();

export const getWalletSnapshot: ToolCallback<typeof walletSnapshotSchema> = async ({
  walletAddress,
}) => {
  const snapshot = await getCachedValue(snapshotCache, walletAddress, () =>
    fetchWalletSnapshot(walletAddress),
  );

  return jsonTextContent(snapshot);
};
