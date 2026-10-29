import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({
  path: resolve(serverRoot, "../.env"),
  quiet: true,
});

const envSchema = z.object({
  SOLANA_RPC_URL: z
    .url("SOLANA_RPC_URL must be a valid URL.")
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "SOLANA_RPC_URL must use HTTP or HTTPS.",
    }),
  PORT: z.number().default(3000),
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  const issues = envResult.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const APP_CONFIG = {
  solana: {
    rpcUrl: envResult.data.SOLANA_RPC_URL,
  },
  port: envResult.data.PORT,
} as const;
