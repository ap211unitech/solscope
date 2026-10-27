import type { ToolCallback } from "@modelcontextprotocol/server";
import { address, createSolanaRpc } from "@solana/kit";
import { APP_CONFIG } from "@solscope/config";
import { walletSnapshotSchema } from "@solscope/schemas";
import NodeCache from "node-cache";

const rpc = createSolanaRpc(APP_CONFIG.solana.rpcUrl);
const tokenProgramAddresses = [
  address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
];
const LAMPORTS_PER_SOL = 1_000_000_000n;
const snapshotCache = new NodeCache({
  stdTTL: 15,
  checkperiod: 30,
});

type WalletSnapshot = {
  address: string;
  solBalance: string;
  tokenAccountCount: number;
};

function formatSolBalance(lamports: bigint): string {
  const wholeSol = lamports / LAMPORTS_PER_SOL;
  const fractionalLamports = (lamports % LAMPORTS_PER_SOL)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");

  return fractionalLamports
    ? `${wholeSol}.${fractionalLamports}`
    : `${wholeSol}`;
}

async function fetchWalletSnapshot(
  walletAddress: string,
): Promise<WalletSnapshot> {
  const owner = address(walletAddress);
  const [balance, ...tokenAccountResponses] = await Promise.all([
    rpc.getBalance(owner, { commitment: "confirmed" }).send(),
    ...tokenProgramAddresses.map((programId) =>
      rpc
        .getTokenAccountsByOwner(
          owner,
          { programId },
          {
            commitment: "confirmed",
            encoding: "base64",
            dataSlice: { offset: 0, length: 0 },
          },
        )
        .send(),
    ),
  ]);

  return {
    address: walletAddress,
    solBalance: formatSolBalance(balance.value),
    tokenAccountCount: tokenAccountResponses.reduce(
      (count, response) => count + response.value.length,
      0,
    ),
  };
}

async function getCachedWalletSnapshot(
  walletAddress: string,
): Promise<WalletSnapshot> {
  const cachedSnapshot = snapshotCache.get<WalletSnapshot>(walletAddress);

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const snapshot = await fetchWalletSnapshot(walletAddress);
  snapshotCache.set(walletAddress, snapshot);

  return snapshot;
}

export const getWalletSnapshot: ToolCallback<
  typeof walletSnapshotSchema
> = async ({ walletAddress }) => {
  const snapshot = await getCachedWalletSnapshot(walletAddress);

  return {
    content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
  };
};
