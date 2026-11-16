import assert from "node:assert/strict";
import { test } from "vitest";
import {
  explainTransactionSchema,
  tokenRiskCheckSchema,
  walletActivityDigestSchema,
  walletPortfolioSchema,
  walletSnapshotSchema,
} from "../src/schemas.ts";

const address = "11111111111111111111111111111111";
const signature = "1".repeat(64);

test("wallet schemas trim and validate addresses", () => {
  assert.deepEqual(walletSnapshotSchema.parse({ walletAddress: ` ${address} ` }), {
    walletAddress: address,
  });
  assert.deepEqual(walletPortfolioSchema.parse({ walletAddress: address }), {
    walletAddress: address,
  });
  assert.equal(walletSnapshotSchema.safeParse({ walletAddress: "invalid" }).success, false);
  assert.equal(tokenRiskCheckSchema.safeParse({ mintAddress: "invalid" }).success, false);
  assert.deepEqual(tokenRiskCheckSchema.parse({ mintAddress: address }), { mintAddress: address });
});

test("transaction schema accepts a valid signature and rejects malformed input", () => {
  assert.deepEqual(explainTransactionSchema.parse({ signature }), { signature });
  assert.equal(explainTransactionSchema.safeParse({ signature: "invalid" }).success, false);
  assert.equal(explainTransactionSchema.safeParse({ signature: " " }).success, false);
});

test("activity digest limit defaults to 20 and enforces the supported range", () => {
  assert.deepEqual(walletActivityDigestSchema.parse({ walletAddress: address }), {
    walletAddress: address,
    limit: 20,
  });
  assert.equal(walletActivityDigestSchema.parse({ walletAddress: address, limit: 1 }).limit, 1);
  assert.equal(walletActivityDigestSchema.parse({ walletAddress: address, limit: 50 }).limit, 50);
  for (const limit of [0, 51, 1.5]) {
    assert.equal(
      walletActivityDigestSchema.safeParse({ walletAddress: address, limit }).success,
      false,
    );
  }
});
