import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

await import("./finish-sdk12-activation-part2.mjs");

const path = fileURLToPath(
  new URL("../apps/mobile/src/runtime/sdk-validation.ts", import.meta.url),
);
const source = await readFile(path, "utf8");
const before = "  partial = false,\n  sdkVersion: SdkVersion,\n): void {";
const after = '  partial = false,\n  sdkVersion: SdkVersion = "1.0",\n): void {';
const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(
    `Expected one assertRecordInput SDK-version signature after migration, found ${count}.`,
  );
}
await writeFile(path, source.replace(before, after), "utf8");
console.log("normalized assertRecordInput compatibility signature");
console.log("SDK 1.2 activation Part 2 source migration finished safely.");
