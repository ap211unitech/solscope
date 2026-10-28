import { address } from "@solana/kit";
import { formatTokenAmount, rpc, TOKEN_PROGRAM_ADDRESSES } from "@solscope/rpc";
import type { WalletSnapshot } from "@solscope/types";

export async function fetchWalletSnapshot(walletAddress: string): Promise<WalletSnapshot> {
  const owner = address(walletAddress);
  const [balance, ...tokenAccountResponses] = await Promise.all([
    rpc.getBalance(owner, { commitment: "confirmed" }).send(),
    ...TOKEN_PROGRAM_ADDRESSES.map((programId) =>
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
    solBalance: formatTokenAmount(balance.value, 9),
    tokenAccountCount: tokenAccountResponses.reduce(
      (count, response) => count + response.value.length,
      0,
    ),
  };
}
