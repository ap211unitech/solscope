import { isAddress } from "@solana/kit";
import z from "zod";

export const walletSnapshotSchema = z.object({
  walletAddress: z
    .string("Wallet address is required")
    .trim()
    .refine(isAddress, "Wallet address must be a valid Solana address"),
});

export type WalletSnapshotInput = z.infer<typeof walletSnapshotSchema>;
