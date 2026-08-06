# Licensing, Notices, and SBOM Operations

Pocket Tools is licensed under the Apache License 2.0. Publication and release preparation are blocked whenever a project asset or production dependency has unresolved provenance, licensing, attribution, notice, source-offer, font, or binary-redistribution obligations.

## Canonical files

| File | Purpose |
| --- | --- |
| `LICENSE` | Complete Apache License 2.0 text for first-party project work. |
| `ASSET_PROVENANCE.md` | Origin and redistribution basis for project-owned images, fonts, sounds, sample data, and other non-code assets. |
| `THIRD_PARTY_NOTICES.md` | Maintained full notices for embedded or bundled components whose notices must accompany source or APK distribution. |
| `licenses/policy.json` | Approved SPDX identifiers, aliases, forbidden patterns, and review-required patterns. |
| `licenses/overrides.json` | Package-specific conclusions recorded after manual review. |
| `licenses/pnpm-production.json` | Deterministic inventory of the locked production JavaScript dependency graph. |
| `licenses/android-production.json` | Deterministic inventory of the resolved Android `releaseRuntimeClasspath` Maven graph. |
| `licenses/pocket-tools.spdx.json` | Deterministic SPDX 2.3 JSON document generated from the reviewed inventories. |
| `apps/mobile/src/generated/legal-notices.ts` | Generated mobile bundle content derived from `LICENSE` and `THIRD_PARTY_NOTICES.md`. |

Generated inventories are evidence. They do not replace full license or notice text when an upstream license requires preservation.

## Standard local workflow

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm legal:notices:write
pnpm licenses:pnpm:write
```

Generate the ignored Android project before resolving the Android production graph:

```bash
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
pnpm licenses:android:write
```

Then generate and verify the SPDX document:

```bash
pnpm licenses:check
pnpm sbom:write
pnpm sbom:check
pnpm format
pnpm check
```

Do not commit `apps/mobile/android/`. Commit only reviewed canonical files and deterministic generated outputs under `licenses/` and `apps/mobile/src/generated/`.

## Android toolchain

The Android inventory task resolves the app's `releaseRuntimeClasspath` through Gradle and reads Maven POM license metadata. Use the same JDK and Android toolchain required for the application build. On the maintained Windows development environment, use JDK 17.

The inventory command intentionally fails when the native project has not been generated. A failure to resolve or parse a POM is an unresolved licensing result, not an ignorable warning.

## Reviewing unresolved packages

Never guess a package license from its name, ecosystem, or common reputation. Review the exact resolved version using authoritative upstream materials such as its packaged license file, source repository tag, Maven POM, npm package metadata, or published project license.

A package-specific conclusion belongs in `licenses/overrides.json` and must include:

- the exact key in the form `npm:<name>@<version>` or `maven:<group>:<module>@<version>`;
- `declaredLicense` when the generated declaration requires correction or normalization;
- `concludedLicense` when the reviewed distribution conclusion differs from the declaration;
- a concise `reason` describing the authoritative evidence;
- an optional `notice` when a maintained notice or attribution is required.

Example:

```json
{
  "schemaVersion": 1,
  "packages": {
    "maven:example.group:example-module@1.2.3": {
      "declaredLicense": "MIT OR BSD-3-Clause",
      "concludedLicense": "MIT OR BSD-3-Clause",
      "reason": "Reviewed the license files published with the resolved 1.2.3 source tag.",
      "notice": "Preserve the upstream copyright and permission notices."
    }
  }
}
```

Overrides are reviewed evidence, not an allowlist escape hatch. Copyleft, source-available, custom, attribution-heavy, or unclear terms remain publication blockers until their obligations and compatibility are resolved explicitly.

## Determinism

The inventory tools remove machine-specific paths, deduplicate package identities, and sort entries by ecosystem, package, and version. `pnpm licenses:check` compares the committed pnpm inventory against the currently locked graph and validates the committed Android inventory against policy.

SPDX generation uses `SOURCE_DATE_EPOCH` for the creation timestamp. When it is unset, the generator uses Unix epoch zero so repeated generation from identical inputs produces identical bytes.

```bash
SOURCE_DATE_EPOCH=0 pnpm sbom:write
SOURCE_DATE_EPOCH=0 pnpm sbom:check
```

Release tooling may set `SOURCE_DATE_EPOCH` to a reviewed source timestamp, but generation and verification must use the same value.

## Asset contributions

Every newly introduced image, icon, font, sound, sample dataset, copied document, or substantial copied snippet must update `ASSET_PROVENANCE.md` or an applicable third-party notice before merge. Unknown origin or unclear redistribution rights block the contribution.

## APK access

The mobile application exposes the generated Apache-2.0 text and maintained third-party notices through **Settings → Open-source licenses**. The bundled content must remain synchronized with the canonical root files through:

```bash
pnpm legal:notices:check
```
