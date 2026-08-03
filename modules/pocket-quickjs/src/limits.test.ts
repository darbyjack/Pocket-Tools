import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_QUICKJS_SANDBOX_LIMITS, resolveQuickJsSandboxLimits } from "./limits.ts";

test("uses bounded defaults", () => {
  assert.deepEqual(resolveQuickJsSandboxLimits(), DEFAULT_QUICKJS_SANDBOX_LIMITS);
});

test("applies a focused override without mutating defaults", () => {
  const limits = resolveQuickJsSandboxLimits({ executionTimeoutMilliseconds: 500 });
  assert.equal(limits.executionTimeoutMilliseconds, 500);
  assert.equal(DEFAULT_QUICKJS_SANDBOX_LIMITS.executionTimeoutMilliseconds, 250);
});

test("rejects non-integer and out-of-range limits", () => {
  assert.throws(
    () => resolveQuickJsSandboxLimits({ executionTimeoutMilliseconds: 9 }),
    /executionTimeoutMilliseconds/,
  );
  assert.throws(() => resolveQuickJsSandboxLimits({ maximumLogEntries: 1.5 }), /maximumLogEntries/);
  assert.throws(
    () => resolveQuickJsSandboxLimits({ runtimeMemoryBytes: 1024 * 1024 * 1024 }),
    /runtimeMemoryBytes/,
  );
});
