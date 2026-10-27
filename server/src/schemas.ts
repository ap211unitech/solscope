import { isAddress } from "@solana/kit";
import z from "zod";

const walletAddressSchema = z.object({
  walletAddress: z
    .string("Wallet address is required")
    .trim()
    .refine(isAddress, "Wallet address must be a valid Solana address"),
});

export const walletSnapshotSchema = walletAddressSchema;
export const walletPortfolioSchema = walletAddressSchema;

export type WalletSnapshotInput = z.infer<typeof walletSnapshotSchema>;
export type WalletPortfolioInput = z.infer<typeof walletPortfolioSchema>;
