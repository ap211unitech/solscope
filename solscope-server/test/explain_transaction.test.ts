import assert from "node:assert/strict";
import { test } from "vitest";
import {
  classifyTransaction,
  getSolBalanceChanges,
  getTokenBalanceChanges,
} from "../src/helpers/explain_transaction.ts";

test("token balance changes combine before and after balances by account and mint", () => {
  const changes = getTokenBalanceChanges(
    [
      {
        accountIndex: 0,
        mint: "mint-a",
        owner: "owner-a",
        uiTokenAmount: { amount: "500", decimals: 2 },
      },
      {
        accountIndex: 1,
        mint: "mint-b",
        uiTokenAmount: { amount: "20", decimals: 0 },
      },
      {
        accountIndex: 3,
        mint: "mint-c",
        uiTokenAmount: { amount: "100", decimals: 0 },
      },
    ],
    [
      {
        accountIndex: 0,
        mint: "mint-a",
        uiTokenAmount: { amount: "250", decimals: 2 },
      },
      {
        accountIndex: 2,
        mint: "mint-c",
        uiTokenAmount: { amount: "1000", decimals: 3 },
      },
    ],
    ["wallet", "account-b", "account-c"],
  );

  assert.deepEqual(changes, [
    { account: "wallet", owner: "owner-a", mint: "mint-a", change: "-2.5" },
    { account: "account-b", owner: null, mint: "mint-b", change: "-20" },
    { account: "account index 3", owner: null, mint: "mint-c", change: "-100" },
    { account: "account-c", owner: null, mint: "mint-c", change: "1" },
  ]);
});

test("SOL balance changes are formatted and missing post-balances mean no change", () => {
  assert.deepEqual(
    getSolBalanceChanges(
      [1_000_000_000n, 0n, 7n],
      [1_500_000_000n, 2_000_000_000n],
      ["wallet", "recipient", "unreported"],
    ),
    [
      { account: "wallet", changeSol: "0.5" },
      { account: "recipient", changeSol: "2" },
    ],
  );
});

test("transaction classification prioritizes status, staking, swaps, and transfers", () => {
  assert.equal(classifyTransaction("failed", [], [], []).category, "failed");
  assert.equal(classifyTransaction("unknown", [], [], []).category, "unknown");
  assert.equal(classifyTransaction("success", [], ["Stake"], []).category, "staking");
  assert.equal(
    classifyTransaction(
      "success",
      [],
      [],
      [
        { account: "a", owner: null, mint: "mint-a", change: "-1" },
        { account: "b", owner: null, mint: "mint-b", change: "1" },
      ],
    ).category,
    "swap",
  );
  assert.equal(classifyTransaction("success", ["system"], [], []).category, "transfer");
  assert.equal(classifyTransaction("success", [], [], []).category, "other");
});
