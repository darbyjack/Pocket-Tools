import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function replaceExactly(source, before, after, expectedCount = 1) {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} occurrence(s), found ${count}:\n${before}`,
    );
  }
  return source.split(before).join(after);
}

async function patch(relativePath, transform) {
  const path = `${ROOT}${relativePath}`;
  const source = await readFile(path, "utf8");
  const updated = transform(source);
  if (updated === source) throw new Error(`${relativePath} was not changed.`);
  await writeFile(path, updated, "utf8");
  console.log(`updated ${relativePath}`);
}

await patch("apps/mobile/src/storage/database.ts", (initial) => {
  let source = initial;
  source = replaceExactly(
    source,
    "assertSettingValue(definition, definition.default, `settings.${name}.default`);",
    "assertSettingValue(\n        definition,\n        definition.default,\n        `settings.${name}.default`,\n        inspection.manifest.sdkVersion,\n      );",
  );
  source = replaceExactly(
    source,
    "assertSettingValue(definition, value, `settings.${name}`);",
    "assertSettingValue(definition, value, `settings.${name}`, inspection.manifest.sdkVersion);",
  );
  source = replaceExactly(
    source,
    "assertSettingValue(definition, value, `settings.${row.name}`);",
    "assertSettingValue(\n      definition,\n      value,\n      `settings.${row.name}`,\n      inspection.manifest.sdkVersion,\n    );",
  );
  source = replaceExactly(
    source,
    "assertRecordInput(definition, data, `records.${collectionName}.${row.id}`);",
    "assertRecordInput(\n        definition,\n        data,\n        `records.${collectionName}.${row.id}`,\n        false,\n        inspection.manifest.sdkVersion,\n      );",
  );
  source = replaceExactly(
    source,
    "assertRecordInput(definition, operation.record, `operations[${index}].record`);",
    "assertRecordInput(\n            definition,\n            operation.record,\n            `operations[${index}].record`,\n            false,\n            inspection.manifest.sdkVersion,\n          );",
  );
  source = replaceExactly(
    source,
    "assertRecordInput(definition, operation.changes, `operations[${index}].changes`, true);",
    "assertRecordInput(\n            definition,\n            operation.changes,\n            `operations[${index}].changes`,\n            true,\n            inspection.manifest.sdkVersion,\n          );",
  );
  source = replaceExactly(
    source,
    "assertRecordInput(definition, merged, `operations[${index}].record`);",
    "assertRecordInput(\n            definition,\n            merged,\n            `operations[${index}].record`,\n            false,\n            inspection.manifest.sdkVersion,\n          );",
  );
  source = replaceExactly(
    source,
    "assertSettingValue(definition, operation.value, `operations[${index}].value`);",
    "assertSettingValue(\n            definition,\n            operation.value,\n            `operations[${index}].value`,\n            inspection.manifest.sdkVersion,\n          );",
  );
  source = replaceExactly(
    source,
    "assertSettingValue(definition, definition.default, `operations[${index}].default`);",
    "assertSettingValue(\n            definition,\n            definition.default,\n            `operations[${index}].default`,\n            inspection.manifest.sdkVersion,\n          );",
  );
  return source;
});

await patch("apps/mobile/src/runtime/sdk-validation.ts", (initial) => {
  let source = initial;
  source = replaceExactly(source, "sdkVersion?: SdkVersion,", "sdkVersion: SdkVersion,", 3);
  source = replaceExactly(source, 'requireSdk12(sdkVersion ?? "1.2", path, "Multi-select settings");', 'requireSdk12(sdkVersion, path, "Multi-select settings");');
  source = replaceExactly(source, 'requireSdk12(sdkVersion ?? "1.2", path, "Date settings");', 'requireSdk12(sdkVersion, path, "Date settings");');
  source = replaceExactly(source, 'requireSdk12(sdkVersion ?? "1.2", path, "Date-time settings");', 'requireSdk12(sdkVersion, path, "Date-time settings");');
  source = replaceExactly(
    source,
    "  const effectiveVersion = resolveFieldVersion(definition, sdkVersion);\n",
    "",
  );
  source = replaceExactly(
    source,
    'requireSdk12(effectiveVersion, path, "Date fields");',
    'requireSdk12(sdkVersion, path, "Date fields");',
  );
  source = replaceExactly(
    source,
    'if (effectiveVersion !== "1.2") {',
    'if (sdkVersion !== "1.2") {',
  );
  source = replaceExactly(
    source,
    '\nfunction resolveFieldVersion(\n  definition: FieldDefinition,\n  explicit: SdkVersion | undefined,\n): SdkVersion {\n  if (explicit !== undefined) return explicit;\n  if (definition.type === "date") return "1.2";\n  return "hostSdkVersion" in definition && definition.hostSdkVersion === "1.2" ? "1.2" : "1.1";\n}\n',
    "\n",
  );
  return source;
});

console.log("SDK 1.2 persistence validation migration complete.");
