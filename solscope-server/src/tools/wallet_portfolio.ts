import type { ToolCallback } from "@modelcontextprotocol/server";
import { createRpcCache, getCachedValue } from "@solscope/rpc";
import { fetchWalletPortfolio, jsonTextContent } from "@solscope/helpers";
import { walletPortfolioSchema } from "@solscope/schemas";

const portfolioCache = createRpcCache();

export const getWalletPortfolio: ToolCallback<typeof walletPortfolioSchema> = async ({
  walletAddress,
}) => {
  const portfolio = await getCachedValue(portfolioCache, walletAddress, () =>
    fetchWalletPortfolio(walletAddress),
  );

  return jsonTextContent(portfolio);
};
