import type { ToolCallback } from "@modelcontextprotocol/server";
import {
  address,
  createSolanaRpc,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { APP_CONFIG } from "@solscope/config";
import { walletPortfolioSchema } from "@solscope/schemas";
import NodeCache from "node-cache";

const rpc = createSolanaRpc(APP_CONFIG.solana.rpcUrl);
const tokenProgramAddresses = [
  address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
];
const metadataProgramAddress = address(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
const METADATA_BATCH_SIZE = 100;
const portfolioCache = new NodeCache({
  stdTTL: 15,
  checkperiod: 30,
});
const addressEncoder = getAddressEncoder();

type TokenHolding = {
  mint: string;
  name: string;
  symbol: string | null;
  amount: string;
  decimals: number;
};

type WalletPortfolio = {
  walletAddress: string;
  holdings: TokenHolding[];
};

type AggregatedHolding = {
  mint: string;
  amount: bigint;
  decimals: number;
};

function readMetadataString(
  data: Buffer,
  offset: number,
): [string, number] | null {
  if (offset + 4 > data.length) {
    return null;
  }

  const length = data.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;

  if (end > data.length) {
    return null;
  }

  return [data.toString("utf8", start, end).replace(/\0+$/, "").trim(), end];
}

function parseMetadata(data: Buffer): { name: string; symbol: string } | null {
  if (data.length < 65) {
    return null;
  }

  const nameResult = readMetadataString(data, 65);
  if (!nameResult) {
    return null;
  }

  const [name, nextOffset] = nameResult;
  const symbolResult = readMetadataString(data, nextOffset);
  if (!symbolResult) {
    return null;
  }

  const [symbol] = symbolResult;
  if (!name && !symbol) {
    return null;
  }

  return { name, symbol };
}

async function getMetadataAddresses(mints: string[]) {
  const metadataSeeds = Buffer.from("metadata");
  return Promise.all(
    mints.map((mint) =>
      getProgramDerivedAddress({
        programAddress: metadataProgramAddress,
        seeds: [
          metadataSeeds,
          addressEncoder.encode(metadataProgramAddress),
          addressEncoder.encode(address(mint)),
        ],
      }).then(([metadataAddress]) => metadataAddress),
    ),
  );
}

async function fetchMetadata(mints: string[]) {
  const metadataAddresses = await getMetadataAddresses(mints);
  const metadataByMint = new Map<
    string,
    { name: string; symbol: string }
  >();

  for (
    let start = 0;
    start < metadataAddresses.length;
    start += METADATA_BATCH_SIZE
  ) {
    const addressBatch = metadataAddresses.slice(
      start,
      start + METADATA_BATCH_SIZE,
    );
    const response = await rpc
      .getMultipleAccounts(addressBatch, {
        commitment: "confirmed",
        encoding: "base64",
      })
      .send();

    addressBatch.forEach((metadataAddress, index) => {
      const account = response.value[index];

      if (!account || account.owner !== metadataProgramAddress) {
        return;
      }

      const parsed = parseMetadata(Buffer.from(account.data[0], "base64"));
      if (parsed) {
        metadataByMint.set(mints[start + index], parsed);
      }
    });
  }

  return metadataByMint;
}

async function fetchWalletPortfolio(
  walletAddress: string,
): Promise<WalletPortfolio> {
  const owner = address(walletAddress);
  const accountResponses = await Promise.all(
    tokenProgramAddresses.map((programId) =>
      rpc
        .getTokenAccountsByOwner(
          owner,
          { programId },
          { commitment: "confirmed", encoding: "jsonParsed" },
        )
        .send(),
    ),
  );
  const holdingsByMint = new Map<string, AggregatedHolding>();

  for (const response of accountResponses) {
    for (const account of response.value) {
      const parsed = account.account.data.parsed.info;
      const amount = BigInt(parsed.tokenAmount.amount);

      if (amount === 0n) {
        continue;
      }

      const existing = holdingsByMint.get(parsed.mint);

      if (existing) {
        existing.amount += amount;
      } else {
        holdingsByMint.set(parsed.mint, {
          mint: parsed.mint,
          amount,
          decimals: parsed.tokenAmount.decimals,
        });
      }
    }
  }

  const holdings = [...holdingsByMint.values()];
  const metadataByMint = await fetchMetadata(holdings.map(({ mint }) => mint));

  return {
    walletAddress,
    holdings: holdings.map(({ mint, amount, decimals }) => {
      const metadata = metadataByMint.get(mint);
      return {
        mint,
        name: metadata?.name || mint,
        symbol: metadata?.symbol || null,
        amount: formatTokenAmount(amount, decimals),
        decimals,
      };
    }),
  };
}

function formatTokenAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) {
    return amount.toString();
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fractional = (amount % divisor)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export const getWalletPortfolio: ToolCallback<
  typeof walletPortfolioSchema
> = async ({ walletAddress }) => {
  const cachedPortfolio =
    portfolioCache.get<WalletPortfolio>(walletAddress);

  if (cachedPortfolio) {
    return {
      content: [
        { type: "text", text: JSON.stringify(cachedPortfolio, null, 2) },
      ],
    };
  }

  const portfolio = await fetchWalletPortfolio(walletAddress);
  portfolioCache.set(walletAddress, portfolio);

  return {
    content: [{ type: "text", text: JSON.stringify(portfolio, null, 2) }],
  };
};
