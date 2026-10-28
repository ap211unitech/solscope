import { address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";
import {
  formatTokenAmount,
  METADATA_PROGRAM_ADDRESS,
  rpc,
  TOKEN_PROGRAM_ADDRESSES,
} from "@solscope/rpc";
import type { AggregatedHolding, TokenMetadata, WalletPortfolio } from "@solscope/types";

const METADATA_BATCH_SIZE = 100;
const addressEncoder = getAddressEncoder();

function readMetadataString(data: Buffer, offset: number): [string, number] | null {
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

function parseMetadata(data: Buffer): TokenMetadata | null {
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
        programAddress: METADATA_PROGRAM_ADDRESS,
        seeds: [
          metadataSeeds,
          addressEncoder.encode(METADATA_PROGRAM_ADDRESS),
          addressEncoder.encode(address(mint)),
        ],
      }).then(([metadataAddress]) => metadataAddress),
    ),
  );
}

async function fetchMetadata(mints: string[]) {
  const metadataAddresses = await getMetadataAddresses(mints);
  const metadataByMint = new Map<string, TokenMetadata>();

  for (let start = 0; start < metadataAddresses.length; start += METADATA_BATCH_SIZE) {
    const addressBatch = metadataAddresses.slice(start, start + METADATA_BATCH_SIZE);
    const response = await rpc
      .getMultipleAccounts(addressBatch, {
        commitment: "confirmed",
        encoding: "base64",
      })
      .send();

    addressBatch.forEach((metadataAddress, index) => {
      const account = response.value[index];

      if (!account || account.owner !== METADATA_PROGRAM_ADDRESS) {
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

export async function fetchWalletPortfolio(walletAddress: string): Promise<WalletPortfolio> {
  const owner = address(walletAddress);
  const accountResponses = await Promise.all(
    TOKEN_PROGRAM_ADDRESSES.map((programId) =>
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
