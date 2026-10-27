import z from "zod";

export const walletSnapshotSchema = z.object({
  address: z.string("Wallet address is required").nonoptional(),
});

export type WalletSnapshotInput = z.infer<typeof walletSnapshotSchema>;
