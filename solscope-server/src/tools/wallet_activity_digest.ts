import type { ToolCallback } from "@modelcontextprotocol/server";
import { createRpcCache, getCachedValue } from "@solscope/rpc";
import { fetchWalletActivityDigest, jsonTextContent } from "@solscope/helpers";
import { walletActivityDigestSchema } from "@solscope/schemas";

const digestCache = createRpcCache();

export const getWalletActivityDigest: ToolCallback<typeof walletActivityDigestSchema> = async ({
  walletAddress,
  limit,
}) => {
  const digest = await getCachedValue(digestCache, `${walletAddress}:${limit}`, () =>
    fetchWalletActivityDigest(walletAddress, limit),
  );

  return jsonTextContent(digest);
};
