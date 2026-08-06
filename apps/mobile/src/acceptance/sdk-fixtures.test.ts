import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { inspectMiniAppSource } from "../../../../packages/authoring-tools/src/inspection.ts";
import {
  SDK_ACCEPTANCE_CAPABILITIES,
  SDK_ACCEPTANCE_FIXTURES,
  validateSdkAcceptanceFixtureCatalog,
} from "./sdk-fixtures.ts";

test("defines mandatory executable fixtures for every public SDK version", () => {
  validateSdkAcceptanceFixtureCatalog();

  assert.deepEqual(
    SDK_ACCEPTANCE_FIXTURES.map(({ sdkVersion }) => sdkVersion),
    ["1.0", "1.1", "1.2"],
  );
  assert.equal(SDK_ACCEPTANCE_FIXTURES.find(({ id }) => id === "tip-splitter")?.mandatory, true);
  assert.equal(SDK_ACCEPTANCE_FIXTURES.find(({ id }) => id === "bathroom-pay")?.mandatory, true);

  const covered = new Set(SDK_ACCEPTANCE_FIXTURES.flatMap(({ capabilities }) => capabilities));
  assert.deepEqual([...covered].sort(), [...SDK_ACCEPTANCE_CAPABILITIES].sort());
});

for (const fixture of SDK_ACCEPTANCE_FIXTURES) {
  test(`executes and inspects the ${fixture.id} SDK ${fixture.sdkVersion} fixture`, async () => {
    const fileUrl = new URL(`../../../../${fixture.sourcePath}`, import.meta.url);
    const source = await readFile(fileUrl, "utf8");
    const inspection = await inspectMiniAppSource(source, fixture.sourcePath);

    assert.equal(inspection.manifest.id, fixture.id);
    assert.equal(inspection.manifest.name, fixture.name);
    assert.equal(inspection.manifest.sdkVersion, fixture.sdkVersion);
    assert.ok(Object.keys(inspection.settings).length >= fixture.minimumSettings);
    assert.ok(Object.keys(inspection.collections).length >= fixture.minimumCollections);
    assert.ok(inspection.screens.length >= fixture.minimumScreens);
    assert.ok(inspection.actions.length >= fixture.minimumActions);
  });
}

test("rejects incomplete fixture catalogs", () => {
  assert.throws(
    () => validateSdkAcceptanceFixtureCatalog(SDK_ACCEPTANCE_FIXTURES.slice(0, 2)),
    /SDK 1.2 has no fixture/,
  );
  assert.throws(
    () =>
      validateSdkAcceptanceFixtureCatalog([
        SDK_ACCEPTANCE_FIXTURES[0]!,
        { ...SDK_ACCEPTANCE_FIXTURES[0]!, sourcePath: "duplicate.miniapp.js" },
      ]),
    /duplicate fixture ID/,
  );
});
