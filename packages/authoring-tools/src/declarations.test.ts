import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("the TypeScript CLI resolves to a JavaScript entrypoint", () => {
  const path = require.resolve("typescript/bin/tsc");
  assert.match(path.replaceAll("\\", "/"), /typescript\/bin\/tsc$/);
});
