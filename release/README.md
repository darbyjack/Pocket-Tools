# Release Engineering

This directory documents the repository-owned release pipeline introduced in Phase 8. The scripts are designed to run locally before GitHub Actions or the production signing identity exists.

An official Pocket Tools build is not created by these commands alone. Official distribution requires a published immutable GitHub Release, the production signing certificate, trusted workflow attestations, and exact-byte draft acceptance. Phase 8 proves the local build and verification contract with a disposable test identity only.

## Implemented foundation

The current Phase 8 implementation provides:

- strict stable, alpha, beta, and release-candidate tag parsing;
- agreement between the tag, root package, mobile package, Expo version, Android package, and positive `versionCode`;
- a clean-worktree and exact-HEAD source requirement;
- the exact nine-file release asset contract;
- deterministic release-plan JSON;
- bytewise filename ordering for `SHA256SUMS`;
- exact asset-set validation with no extra files, missing files, directories, or symbolic links;
- checksum verification against the final staged bytes;
- pinned Android SDK Build Tools 36.0.0 discovery through `ANDROID_SDK_ROOT` or `ANDROID_HOME`;
- AAPT2 inspection of package, version, SDK, manifest flags, and declared native ABIs;
- archive inspection for exactly one ABI plus `libpocketquickjs.so` and `libc++_shared.so`;
- 16 KiB native-library zip-alignment verification;
- clean Expo Android prebuild before every ABI build;
- removal of Expo's generated debug signing configuration from the release build type;
- isolated single-ABI Gradle builds without a global `gradlew clean`;
- deterministic unsigned-intermediate APK names and inspection reports;
- rejection of already-signed, debug, test-only, multi-ABI, misaligned, or incomplete intermediates;
- disposable PKCS#12 RSA-4096 test-key generation;
- central alignment and APK signing with passwords supplied only through environment variables;
- exact one-signer verification, Android debug-certificate rejection, fingerprint/subject checks, and public-certificate extraction;
- negative tests for invalid versions, asset-set drift, post-checksum mutation, generated signing drift, build configuration drift, debug builds, multi-ABI APKs, missing native libraries, and certificate drift.

Later Phase 8 slices add deterministic final metadata, legal-artifact staging, release-note/checklist generation, and complete local end-to-end verification.

## Release identity commands

Validate the current committed source against a release tag:

```powershell
pnpm release:validate --tag v0.1.0
```

Print a deterministic plan or write it beneath an ignored local work directory:

```powershell
pnpm release:plan --tag v0.1.0
pnpm release:plan --tag v0.1.0 --output release-work\v0.1.0-plan.json
```

Once a staging directory contains every required asset except `SHA256SUMS`, generate checksums:

```powershell
pnpm release:checksums --tag v0.1.0 --directory release-staging\v0.1.0
```

Verify the exact final asset set and every recorded digest:

```powershell
pnpm release:verify --tag v0.1.0 --directory release-staging\v0.1.0
```

All commands resolve paths from the repository root. Release identity commands reject a dirty worktree and reject a supplied source commit that differs from `HEAD`.

## Isolated Android builds

Pocket Tools generates an unsigned release intermediate for each ABI, then signs those exact bytes centrally. The Expo config plugin `with-unsigned-release-build.cjs` removes only the generated `signingConfig signingConfigs.debug` line from the release build type and fails closed when the generated Gradle shape changes.

Build one ABI from a clean prebuild:

```powershell
pnpm release:android:build `
  --tag v0.1.0 `
  --abi arm64-v8a
```

Build all four ABIs sequentially, using a clean prebuild and isolated Gradle project cache for each:

```powershell
pnpm release:android:build-all --tag v0.1.0
```

The default output directory is:

```text
release-work/intermediate/0.1.0/
```

Each ABI produces an explicitly non-distributable handoff pair:

```text
pocket-tools-v0.1.0-<abi>-unsigned.apk
pocket-tools-v0.1.0-<abi>-unsigned.apk.inspection.json
```

The build commands:

1. validate the exact clean release source and synchronized generated inputs;
2. run Expo prebuild with `--clean --no-install`;
3. verify the generated four-ABI, minification, and shrinking properties;
4. run `:app:assembleRelease` with one `reactNativeArchitectures` value and `--no-daemon`;
5. avoid global `gradlew clean` and use a per-version/per-ABI Gradle project cache;
6. verify the APK is unsigned, non-debuggable, non-`testOnly`, 16 KiB aligned, and contains exactly the selected ABI plus both required native libraries;
7. copy the exact intermediate and write a deterministic SHA-256 inspection record; and
8. remove successful generated Android and project-cache output while preserving failed output for diagnosis.

A build refuses to overwrite an existing intermediate or inspection report. Delete the affected ignored output deliberately before repeating a build.

## Android release tools

The Android commands require a JDK through `JAVA_HOME` or `PATH` and Android SDK Build Tools 36.0.0 through `ANDROID_SDK_ROOT` or `ANDROID_HOME`. A deliberate later toolchain change may pass `--build-tools <version>` explicitly.

Inspect the resolved toolchain without changing files:

```powershell
pnpm release:android:tools
```

For local acceptance only, set both password environment variables through a secure local mechanism. Never commit, print, paste into an issue, or place these values in a tracked file:

```text
ANDROID_RELEASE_KEYSTORE_PASSWORD
ANDROID_RELEASE_KEY_PASSWORD
```

Generate the disposable test identity. The default alias is `pocket-tools-test-release` and the certificate subject is `CN=Pocket Tools Test Release`, deliberately distinct from the future production identity:

```powershell
pnpm release:android:test-key --keystore release-work\test-signing.p12
```

Keep the current shell open while using this disposable key. If the password environment values are lost, delete the test keystore and generate a new disposable identity rather than persisting the passwords in a plaintext file.

Align and sign one unsigned/intermediate APK without modifying the input. The command uses 16 KiB native-library alignment, disables the separate v4 `.idsig` output, and verifies the resulting Android signature:

```powershell
pnpm release:android:sign `
  --input release-work\intermediate\0.1.0\pocket-tools-v0.1.0-arm64-v8a-unsigned.apk `
  --output release-work\pocket-tools-v0.1.0-arm64-v8a.apk `
  --keystore release-work\test-signing.p12 `
  --alias pocket-tools-test-release
```

Inspect one final APK. Add `--certificate-fingerprint <lowercase-sha256>` once the expected signer fingerprint is known. During disposable-key acceptance, the explicit test subject prevents accidentally accepting an Android debug certificate or an unrelated key:

```powershell
pnpm release:android:inspect `
  --tag v0.1.0 `
  --abi arm64-v8a `
  --apk release-work\pocket-tools-v0.1.0-arm64-v8a.apk `
  --certificate-subject "CN=Pocket Tools Test Release" `
  --output release-work\arm64-v8a-inspection.json
```

Extract only the public signing certificate from a verified final APK:

```powershell
pnpm release:android:certificate `
  --apk release-work\pocket-tools-v0.1.0-arm64-v8a.apk `
  --output release-work\pocket-tools-test-certificate.pem
```

The signer password values are passed to `keytool` and `apksigner` by environment-variable reference, not as literal command arguments. Commands fail rather than overwrite an existing keystore, signed APK, certificate, or inspection output.

## Required asset set

For `vX.Y.Z[-suffix]`, the clean staging directory must contain exactly:

```text
pocket-tools-vX.Y.Z[-suffix]-armeabi-v7a.apk
pocket-tools-vX.Y.Z[-suffix]-arm64-v8a.apk
pocket-tools-vX.Y.Z[-suffix]-x86.apk
pocket-tools-vX.Y.Z[-suffix]-x86_64.apk
pocket-tools-vX.Y.Z[-suffix]-release.json
pocket-tools-vX.Y.Z[-suffix].spdx.json
pocket-tools-vX.Y.Z[-suffix]-third-party-notices.txt
pocket-tools-release-certificate.pem
SHA256SUMS
```

`SHA256SUMS` records every other asset in lowercase SHA-256, two-space separator format, sorted by bytewise filename order. No asset may be modified after its digest is recorded.

## Security boundaries

- Never place a production keystore or signing credential in this repository.
- Never pass real passwords as literal command arguments or store them in shell scripts.
- Use `release-work/` and `release-staging/` only for local disposable output; both are ignored.
- Delete disposable test keystores and password environment variables after acceptance.
- Generated Android projects and APKs remain untracked.
- The production key and stable public certificate are created in their later approved phases, not during Phase 8.
