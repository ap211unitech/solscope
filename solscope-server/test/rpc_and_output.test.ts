import assert from "node:assert/strict";
import { test } from "vitest";
import { createRpcCache, formatTokenAmount, getCachedValue } from "../src/rpc.ts";
import { jsonTextContent } from "../src/helpers/tool_output.ts";

test("token amounts preserve sign and trim insignificant fractional zeroes", () => {
  assert.equal(formatTokenAmount(123_450_000n, 6), "123.45");
  assert.equal(formatTokenAmount(-1_000n, 3), "-1");
  assert.equal(formatTokenAmount(42n, 0), "42");
  assert.equal(formatTokenAmount(0n, 9), "0");
});

test("cached values are reused and failed fetches are not cached", async () => {
  const cache = createRpcCache();
  let fetchCount = 0;
  const fetchValue = async () => {
    fetchCount += 1;
    return { value: 7 };
  };

  assert.deepEqual(await getCachedValue(cache, "key", fetchValue), { value: 7 });
  assert.deepEqual(await getCachedValue(cache, "key", fetchValue), { value: 7 });
  assert.equal(fetchCount, 1);

  await assert.rejects(
    getCachedValue(cache, "failure", async () => {
      throw new Error("upstream unavailable");
    }),
    /upstream unavailable/,
  );
  assert.equal(cache.has("failure"), false);
  cache.close();
});

test("tool output serializes bigint values as decimal strings", () => {
  assert.deepEqual(jsonTextContent({ amount: 123n, nested: [456n] }), {
    content: [{ type: "text", text: '{\n  "amount": "123",\n  "nested": [\n    "456"\n  ]\n}' }],
  });
});
