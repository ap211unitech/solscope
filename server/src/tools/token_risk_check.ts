import type { ToolCallback } from "@modelcontextprotocol/server";
import { address } from "@solana/kit";
import {
  createRpcCache,
  formatTokenAmount,
  getCachedValue,
  rpc,
  TOKEN_PROGRAM_ADDRESSES,
} from "@solscope/rpc";
import {
  compareSupply,
  createRiskFlags,
  fetchGoPlusTokenData,
  jsonTextContent,
  parseUiAmount,
  readMintDetails,
  sumPercent,
  TOP_HOLDER_COUNT,
} from "@solscope/helpers";
import { tokenRiskCheckSchema } from "@solscope/schemas";
import type { GoPlusTokenData, TokenRiskReport } from "@solscope/types";

const riskCheckCache = createRpcCache();
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchTokenRiskReport(mintAddress: string): Promise<TokenRiskReport> {
  const mint = address(mintAddress);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let mintAccount;
  let supplyResponse;
  let goPlusData: GoPlusTokenData;

  try {
    [mintAccount, supplyResponse, goPlusData] = await Promise.all([
      rpc
        .getAccountInfo(mint, { commitment: "confirmed", encoding: "jsonParsed" })
        .send({ abortSignal: controller.signal }),
      rpc
        .getTokenSupply(mint, { commitment: "confirmed" })
        .send({ abortSignal: controller.signal }),
      fetchGoPlusTokenData(mintAddress),
    ]);
  } catch (error) {
    const timedOut = controller.signal.aborted;
    controller.abort();
    if (timedOut) {
      throw new Error(`Token risk lookup timed out after ${REQUEST_TIMEOUT_MS / 1_000} seconds.`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!mintAccount.value) {
    throw new Error(`Token mint account not found: ${mintAddress}`);
  }
  const program = TOKEN_PROGRAM_ADDRESSES.find(
    (tokenProgram) => tokenProgram.toString() === mintAccount.value?.owner,
  );
  if (!program) {
    throw new Error(`Account is not owned by a supported token program: ${mintAddress}`);
  }

  const mintDetails = readMintDetails(mintAccount.value.data, mintAddress);
  if (mintDetails.decimals !== supplyResponse.value.decimals) {
    throw new Error(`Mint decimals do not match the RPC supply response: ${mintAddress}`);
  }

  const onChainSupply = BigInt(supplyResponse.value.amount);
  const goPlusSupply = parseUiAmount(goPlusData.totalSupply, mintDetails.decimals);
  const supplyComparison = compareSupply(goPlusSupply, onChainSupply);
  const holders = goPlusData.holders.slice(0, TOP_HOLDER_COUNT);
  const concentration = {
    basis: "GoPlus holder percentages" as const,
    top1Percent: sumPercent(holders, 1, goPlusData.holderCount),
    top5Percent: sumPercent(holders, 5, goPlusData.holderCount),
    top10Percent: sumPercent(holders, TOP_HOLDER_COUNT, goPlusData.holderCount),
  };
  const authorityAgreement = {
    mint:
      goPlusData.checks.mintable.status === null
        ? null
        : (goPlusData.checks.mintable.status === "1") === (mintDetails.mintAuthority !== null),
    freeze:
      goPlusData.checks.freezable.status === null
        ? null
        : (goPlusData.checks.freezable.status === "1") === (mintDetails.freezeAuthority !== null),
  };
  const authorityMismatch =
    authorityAgreement.mint === false || authorityAgreement.freeze === false;
  const flags = createRiskFlags(
    mintDetails.mintAuthority,
    mintDetails.freezeAuthority,
    holders,
    goPlusData.holderCount,
    supplyComparison.matchesWithinOnePercent,
    mintDetails.extensions,
    goPlusData,
  );
  if (authorityMismatch) {
    flags.push({
      severity: "info",
      code: "AUTHORITY_DATA_MISMATCH",
      message: "GoPlus and Solana RPC disagree about mint or freeze authority status.",
    });
  }

  const expectedRankedHolders =
    goPlusData.holderCount === null
      ? TOP_HOLDER_COUNT
      : Math.min(TOP_HOLDER_COUNT, goPlusData.holderCount);
  const holderDataIncomplete = holders.length < expectedRankedHolders;
  const riskLevel = flags.some((flag) => flag.severity === "high")
    ? "high"
    : flags.some((flag) => flag.severity === "medium")
      ? "medium"
      : !holders.length ||
          holderDataIncomplete ||
          authorityMismatch ||
          supplyComparison.matchesWithinOnePercent === false
        ? "inconclusive"
        : "low";

  return {
    mintAddress,
    tokenProgram: program === TOKEN_PROGRAM_ADDRESSES[0] ? "spl-token" : "token-2022",
    metadata: goPlusData.metadata,
    supply: {
      onChain: formatTokenAmount(onChainSupply, mintDetails.decimals),
      goPlus: goPlusData.totalSupply,
      decimals: mintDetails.decimals,
      differencePercent: supplyComparison.differencePercent,
      matchesWithinOnePercent: supplyComparison.matchesWithinOnePercent,
    },
    authorities: {
      onChain: {
        mint: mintDetails.mintAuthority,
        freeze: mintDetails.freezeAuthority,
      },
      goPlus: {
        mint: goPlusData.checks.mintable,
        freeze: goPlusData.checks.freezable,
      },
      agrees: authorityAgreement,
    },
    goPlusChecks: goPlusData.checks,
    token2022Extensions: mintDetails.extensionsAvailable ? mintDetails.extensions : null,
    holderData: {
      provider: "GoPlus Solana Token Security API (Beta)",
      holderCount: goPlusData.holderCount,
      rankedHoldersReturned: holders.length,
      retrievedAt: new Date().toISOString(),
    },
    holders,
    concentration,
    markets: goPlusData.markets,
    lpHolders: goPlusData.lpHolders,
    creators: goPlusData.creators,
    riskLevel,
    flags,
    disclaimer:
      "GoPlus supplies holder rankings, metadata, security checks, and market data; its Solana security API is in Beta. Solana RPC independently verifies the mint, token program, decimals, supply, authorities, and available Token-2022 extensions. Holder percentages are GoPlus-reported and may not represent every holder. This is heuristic analysis, not investment advice.",
  };
}

export const checkTokenRisk: ToolCallback<typeof tokenRiskCheckSchema> = async ({
  mintAddress,
}) => {
  const report = await getCachedValue(riskCheckCache, mintAddress, () =>
    fetchTokenRiskReport(mintAddress),
  );

  return jsonTextContent(report);
};
