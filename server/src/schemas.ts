import { isAddress, isSignature } from "@solana/kit";
import z from "zod";

const walletAddressSchema = z.object({
  walletAddress: z
    .string("Wallet address is required")
    .trim()
    .refine(isAddress, "Wallet address must be a valid Solana address"),
});

export const walletSnapshotSchema = walletAddressSchema;
export const walletPortfolioSchema = walletAddressSchema;
export const explainTransactionSchema = z.object({
  signature: z
    .string("Transaction signature is required")
    .trim()
    .refine(isSignature, "Transaction signature must be a valid Solana signature"),
});

export type WalletSnapshotInput = z.infer<typeof walletSnapshotSchema>;
export type WalletPortfolioInput = z.infer<typeof walletPortfolioSchema>;
export type ExplainTransactionInput = z.infer<typeof explainTransactionSchema>;
