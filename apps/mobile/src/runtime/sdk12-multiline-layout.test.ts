import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MULTILINE_LINES,
  multilineInputHeight,
} from "../ui/multiline-input-layout.ts";

test("uses four visible lines by default", () => {
  assert.equal(DEFAULT_MULTILINE_LINES, 4);
  assert.equal(multilineInputHeight(), multilineInputHeight(4));
});

test("keeps every supported multiline height finite and bounded", () => {
  const heights = ([2, 3, 4, 5, 6, 7, 8] as const).map(multilineInputHeight);
  assert.deepEqual(heights, [74, 98, 122, 146, 170, 194, 218]);
  assert.ok(heights.every(Number.isFinite));
  assert.ok(heights.every((height) => height >= 74 && height <= 218));
});
