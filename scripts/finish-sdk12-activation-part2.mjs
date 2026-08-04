import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function replaceExactly(source, before, after, expectedCount = 1) {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} occurrence(s), found ${count}:\n${before}`);
  }
  return source.split(before).join(after);
}

function replacePatternExactly(source, pattern, replacement, expectedCount = 1) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} pattern occurrence(s), found ${matches.length}: ${pattern}`,
    );
  }
  return source.replace(pattern, replacement);
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
  source = replaceExactly(
    source,
    'requireSdk12(sdkVersion ?? "1.2", path, "Multi-select settings");',
    'requireSdk12(sdkVersion, path, "Multi-select settings");',
  );
  source = replaceExactly(
    source,
    'requireSdk12(sdkVersion ?? "1.2", path, "Date settings");',
    'requireSdk12(sdkVersion, path, "Date settings");',
  );
  source = replaceExactly(
    source,
    'requireSdk12(sdkVersion ?? "1.2", path, "Date-time settings");',
    'requireSdk12(sdkVersion, path, "Date-time settings");',
  );
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
  source = replaceExactly(source, 'if (effectiveVersion !== "1.2") {', 'if (sdkVersion !== "1.2") {');
  source = replaceExactly(
    source,
    '\nfunction resolveFieldVersion(\n  definition: FieldDefinition,\n  explicit: SdkVersion | undefined,\n): SdkVersion {\n  if (explicit !== undefined) return explicit;\n  if (definition.type === "date") return "1.2";\n  return "hostSdkVersion" in definition && definition.hostSdkVersion === "1.2" ? "1.2" : "1.1";\n}\n',
    "\n",
  );
  return source;
});

await patch("docs/SDK_1_2_CONTRACT.md", (initial) => {
  let source = initial;
  source = replacePatternExactly(
    source,
    /## Status\n\n[\s\S]*?\n## Design principles/gu,
    `## Status

This is the released public SDK 1.2 contract. Pocket Tools advertises SDK 1.2 only as the complete surface defined here; partial or implicit capability expansion remains prohibited.

- \`SDK_VERSION\` is \`"1.2"\`.
- \`SUPPORTED_SDK_VERSIONS\` is \`"1.0"\`, \`"1.1"\`, and \`"1.2"\`.
- A manifest may declare \`sdkVersion: "1.2"\` and use the complete documented surface.
- Generated declarations, local authoring, embedded QuickJS, Android parsing, persistence, rendering, effects, notifications, backup/restore, and lifecycle paths implement the same contract.

SDK 1.0 and 1.1 behavior remains frozen. A script must continue to declare the lowest SDK version whose features it uses. Internal files or compatibility aliases created during staged implementation do not create additional public API.

## Design principles`,
  );
  source = replaceExactly(source, "The final activation slice must:", "The public release uses:");
  source = replaceExactly(
    source,
    "The implementation must apply version checks at all relevant boundaries:",
    "The host applies version checks at all relevant boundaries:",
  );
  source = replaceExactly(
    source,
    "Notification schedules change portable state. The implementation must create explicit backup format version 2 for both:",
    "Notification schedules change portable state. SDK 1.2 uses explicit backup format version 2 for both:",
  );
  source = replaceExactly(
    source,
    "Following the project's pre-release no-compatibility rule, the version-2 restore path is not required to accept version-1 documents. The implementation PR must update export, restore, validation, documentation, malformed-input tests, and device acceptance together. No reader may silently infer missing notification state.",
    "Following the project's pre-release no-compatibility rule, the version-2 restore path is not required to accept version-1 documents. Export, restore, validation, documentation, malformed-input tests, and device acceptance use version 2 together. No reader may silently infer missing notification state.",
  );
  source = replaceExactly(
    source,
    "Implementation must preserve existing error codes and add stable categories for SDK 1.2 failures:",
    "The host preserves existing error codes and defines these stable categories for SDK 1.2 failures:",
  );
  source = replaceExactly(source, "# Implementation order", "# Delivery history");
  source = replaceExactly(
    source,
    'Each implementation slice must keep `sdkVersion: "1.2"` disabled until the final activation slice. A slice may add internal models and tests, but it must not expose an API that an agent can use before the complete advertised contract exists.',
    'These capabilities were delivered in focused internal slices and activated together as the complete SDK 1.2 release. Internal compatibility aliases and historical test names do not expose any capability beyond this contract.',
  );
  return source;
});

const publicStatus = `## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- \`SDK_VERSION\` is \`"1.2"\`.
- Supported manifest versions are \`"1.0"\`, \`"1.1"\`, and \`"1.2"\`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain \`sdk12\` or \`dormant\` compatibility wording. Those names do not gate or expand the public API.

## `;

const featureDocuments = [
  "docs/SDK_1_2_ANDROID_NOTIFICATIONS.md",
  "docs/SDK_1_2_BADGES.md",
  "docs/SDK_1_2_DATE_DATA.md",
  "docs/SDK_1_2_EVERYDAY_QUERIES.md",
  "docs/SDK_1_2_FEEDBACK.md",
  "docs/SDK_1_2_ICONS.md",
  "docs/SDK_1_2_MULTILINE_TEXT_INPUT.md",
  "docs/SDK_1_2_MULTI_SELECT.md",
  "docs/SDK_1_2_NOTIFICATION_REGISTRY.md",
  "docs/SDK_1_2_NUMERIC_INPUT_HINTS.md",
  "docs/SDK_1_2_OUTPUT.md",
  "docs/SDK_1_2_PROGRESS.md",
  "docs/SDK_1_2_SETTING_WRITES.md",
  "docs/SDK_1_2_TAPPABLE_LIST_ROWS.md",
];

for (const document of featureDocuments) {
  await patch(document, (source) =>
    replacePatternExactly(source, /## Status\n\n[\s\S]*?\n## /gu, publicStatus),
  );
}

await patch("docs/SDK_OVERVIEW.md", (source) =>
  replaceExactly(
    source,
    'Scheduled date, daily, and weekly notifications may request `standard` or `exact` delivery. Exact delivery is best-effort and may fall back according to Android capability and permission state.',
    'Scheduled date, daily, and weekly notifications may request `standard` or `exact` delivery. Exact reminders are never silently downgraded: an action requiring unavailable exact access fails before persistence, while an exact reminder restored from backup remains blocked until access is granted.',
  ),
);

await patch("docs/AGENT_AUTHORING.md", (source) =>
  replaceExactly(
    source,
    '- `exact` is best-effort and may fall back depending on Android capability and permission state.',
    '- `exact` is never silently downgraded. Scheduling an exact reminder without exact-alarm access fails before persistence; an exact reminder restored from backup remains blocked until access is granted.',
  ),
);

await patch("README.md", (source) =>
  replaceExactly(
    source,
    "- Android notification permission, channels, exact-delivery fallback, startup recovery, restore reconciliation, removal cleanup, and tap routing",
    "- Android notification permission, channels, exact-access blocking/recovery, startup recovery, restore reconciliation, removal cleanup, and tap routing",
  ),
);

await patch("apps/mobile/README.md", (source) =>
  replaceExactly(
    source,
    "- Notification scheduling, exact-delivery fallback, registry reconciliation, and tap routing",
    "- Notification scheduling, exact-access blocking/recovery, registry reconciliation, and tap routing",
  ),
);

console.log("SDK 1.2 activation Part 2 migration complete.");
