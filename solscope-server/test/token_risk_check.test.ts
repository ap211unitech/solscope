import assert from "node:assert/strict";
import { test } from "vitest";
import {
  compareSupply,
  parseUiAmount,
  readMintDetails,
  sumPercent,
} from "../src/helpers/token_risk_check.ts";
import type { GoPlusHolder } from "../src/types/token_risk_check.ts";

const holder = (percent: number | null): GoPlusHolder => ({
  account: "account",
  balance: "1",
  percent,
  tokenAccounts: [],
  tag: null,
  locked: null,
  lockedDetail: null,
});

test("UI token amounts convert exactly to base units", () => {
  assert.equal(parseUiAmount("12.3400", 6), 12_340_000n);
  assert.equal(parseUiAmount("7", 0), 7n);
  assert.throws(() => parseUiAmount("1.1234567", 6), /invalid token amount/);
  assert.throws(() => parseUiAmount("-1", 6), /invalid token amount/);
});

test("supply comparison handles rounding, tolerance boundaries, and zero supply", () => {
  assert.deepEqual(compareSupply(1_010n, 1_000n), {
    differencePercent: "1.00",
    matchesWithinOnePercent: true,
  });
  assert.deepEqual(compareSupply(1_011n, 1_000n), {
    differencePercent: "1.10",
    matchesWithinOnePercent: false,
  });
  assert.deepEqual(compareSupply(10n, 0n), {
    differencePercent: null,
    matchesWithinOnePercent: null,
  });
});

test("holder concentration requires all expected percentages", () => {
  assert.equal(sumPercent([holder(25), holder(15)], 2, 2), 40);
  assert.equal(sumPercent([holder(25)], 2, 2), null);
  assert.equal(sumPercent([holder(25), holder(null)], 2, 2), null);
  assert.equal(sumPercent([], 10, 0), null);
});

test("mint parsing validates initialization and reports Token-2022 extensions", () => {
  assert.deepEqual(
    readMintDetails(
      {
        parsed: {
          type: "mint",
          info: {
            decimals: 6,
            isInitialized: true,
            mintAuthority: null,
            freezeAuthority: "authority",
            extensions: [{ extension: "transferFeeConfig" }, { invalid: true }],
          },
        },
      },
      "mint",
    ),
    {
      decimals: 6,
      mintAuthority: null,
      freezeAuthority: "authority",
      extensions: ["transferFeeConfig"],
      extensionsAvailable: true,
    },
  );
  assert.throws(
    () =>
      readMintDetails(
        {
          parsed: {
            type: "mint",
            info: {
              decimals: 6,
              isInitialized: false,
              mintAuthority: null,
              freezeAuthority: null,
            },
          },
        },
        "mint",
      ),
    /not initialized/,
  );
});
