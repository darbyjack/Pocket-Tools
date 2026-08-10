# Release Engineering

This directory documents the repository-owned release pipeline used for official Pocket Tools GitHub Releases. The scripts support the same build, signing, staging, and verification contract locally and in GitHub Actions; local acceptance uses a disposable signing identity, while official releases use the protected production identity documented in [PRODUCTION_SIGNING.md](PRODUCTION_SIGNING.md).

An official Pocket Tools build is not created by these commands alone. Official distribution requires an immutable GitHub Release, the production signing certificate, trusted workflow attestations, and exact-byte draft acceptance.

## Implemented pipeline

The current implementation provides:

- strict stable, alpha, beta, and release-candidate tag parsing;
- agreement between the tag, root package, mobile package, Expo version, Android package, and positive `versionCode`;
- a clean-worktree and exact-HEAD source requirement;
- clean Expo Android prebuilds and isolated single-ABI Gradle builds;
- unsigned-intermediate inspection before centralized signing;
- source-commit and byte-digest binding from unsigned build inspection through signed inspection and final staging;
- disposable PKCS#12 RSA-4096 test-key generation;
- 16 KiB alignment, APK signing, signer verification, and public-certificate extraction;
- AAPT2 and archive inspection of package, version, SDK, ABI, manifest flags, and native libraries;
- deterministic final metadata, SPDX and notice staging, release notes, and acceptance records;
- the exact nine-file release asset contract;
- bytewise filename ordering for `SHA256SUMS`;
- exact asset-set validation with no extra files, missing files, directories, or symbolic links; and
- independent checksum verification against the final staged bytes.

The GitHub draft-release workflow builds all four unsigned ABI artifacts independently, validates their provenance, signs them only in the protected `release` environment, pins the exact production certificate fingerprint, stages the exact public asset set, creates attestations, and prepares a draft release for manual exact-byte acceptance.

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

Generate and independently verify checksums for a complete staging directory:

```powershell
pnpm release:checksums --tag v0.1.0 --directory release-staging\v0.1.0
pnpm release:verify --tag v0.1.0 --directory release-staging\v0.1.0
```

Release identity commands reject a dirty worktree and reject a supplied source commit that differs from `HEAD`.

## Isolated Android builds

Pocket Tools builds an unsigned release intermediate for each ABI, then signs those exact bytes centrally. The Expo config plugin removes only the generated `signingConfig signingConfigs.debug` line from the release build type and fails closed if the generated Gradle shape changes.

Build one ABI:

```powershell
pnpm release:android:build `
  --tag v0.1.0 `
  --abi arm64-v8a
```

Build all four ABIs sequentially:

```powershell
pnpm release:android:build-all --tag v0.1.0
```

The default intermediate directory is:

```text
release-work/intermediate/0.1.0/
```

Each ABI produces an explicitly non-distributable handoff pair:

```text
pocket-tools-v0.1.0-<abi>-unsigned.apk
pocket-tools-v0.1.0-<abi>-unsigned.apk.inspection.json
```

Each build validates synchronized source inputs, runs clean prebuild, verifies release optimization properties, builds only the selected ABI, confirms the APK is unsigned and aligned, verifies required native libraries, writes a deterministic inspection record containing the exact source commit and APK digest, and removes successful generated Android and project-cache output. Failed output remains available for diagnosis.

## Android signing and inspection

The Android commands require a JDK through `JAVA_HOME` or `PATH` and Android SDK Build Tools 36.0.0 through `ANDROID_SDK_ROOT` or `ANDROID_HOME`.

Inspect the resolved toolchain:

```powershell
pnpm release:android:tools
```

For local acceptance only, set both password environment variables through a secure local mechanism. Never commit, print, or persist the values in a tracked file:

```text
ANDROID_RELEASE_KEYSTORE_PASSWORD
ANDROID_RELEASE_KEY_PASSWORD
```

Generate the disposable identity:

```powershell
pnpm release:android:test-key --keystore release-work\test-signing.p12
```

The default alias is `pocket-tools-test-release` and the certificate subject is `CN=Pocket Tools Test Release`. Both are deliberately distinct from the production identity.

Align and sign an intermediate without modifying its input:

```powershell
pnpm release:android:sign `
  --input release-work\intermediate\0.1.0\pocket-tools-v0.1.0-arm64-v8a-unsigned.apk `
  --output release-work\final-input\0.1.0\pocket-tools-v0.1.0-arm64-v8a.apk `
  --keystore release-work\test-signing.p12 `
  --alias pocket-tools-test-release
```

Before signing, the command requires a clean worktree, loads the adjacent unsigned inspection record, verifies the exact input bytes and digest, and rejects a source commit that differs from the current `HEAD`.

Inspect the signed APK and use the exact deterministic inspection filename expected by staging:

```powershell
pnpm release:android:inspect `
  --tag v0.1.0 `
  --abi arm64-v8a `
  --apk release-work\final-input\0.1.0\pocket-tools-v0.1.0-arm64-v8a.apk `
  --certificate-subject "CN=Pocket Tools Test Release" `
  --output release-work\final-input\0.1.0\pocket-tools-v0.1.0-arm64-v8a.apk.inspection.json
```

The default unsigned inspection is resolved from the tag and ABI beneath `release-work/intermediate/`. Pass `--source-inspection <path>` only when deliberately using a non-default intermediate directory. The signed inspection inherits the validated build tag and source commit rather than deriving provenance from the later staging step.

Extract the public certificate once from any verified APK:

```powershell
pnpm release:android:certificate `
  --apk release-work\final-input\0.1.0\pocket-tools-v0.1.0-arm64-v8a.apk `
  --output release-work\final-input\0.1.0\pocket-tools-release-certificate.pem
```

Commands fail rather than overwrite an existing keystore, signed APK, inspection report, or certificate.

## Production signing

The production certificate metadata and public SHA-256 fingerprint are maintained in [PRODUCTION_SIGNING.md](PRODUCTION_SIGNING.md). The production PKCS#12 keystore and credentials are never stored in Git.

GitHub-hosted production signing is isolated to the protected `release` environment. The workflow decodes the keystore only beneath `$RUNNER_TEMP`, passes credentials through masked environment values, validates every signed APK against both the expected certificate subject and exact production SHA-256 fingerprint, and deletes temporary signing material in an unconditional cleanup step.

Do not copy production secrets into repository-level secrets, workflow files, command-line literals, logs, issues, pull requests, or release assets.

## Clean-room release staging

The staging input directory must contain exactly nine regular, non-symbolic files:

```text
pocket-tools-v0.1.0-armeabi-v7a.apk
pocket-tools-v0.1.0-armeabi-v7a.apk.inspection.json
pocket-tools-v0.1.0-arm64-v8a.apk
pocket-tools-v0.1.0-arm64-v8a.apk.inspection.json
pocket-tools-v0.1.0-x86.apk
pocket-tools-v0.1.0-x86.apk.inspection.json
pocket-tools-v0.1.0-x86_64.apk
pocket-tools-v0.1.0-x86_64.apk.inspection.json
pocket-tools-release-certificate.pem
```

Stage the exact public asset set and generate separate publication materials:

```powershell
pnpm release:stage `
  --tag v0.1.0 `
  --input release-work\final-input\0.1.0 `
  --output release-staging\v0.1.0 `
  --publication release-work\publication\0.1.0
```

The command:

1. requires clean committed source matching the tag;
2. rejects missing, extra, non-regular, symbolic, or overlapping input/output directories;
3. requires every signed inspection to name the exact current source commit and release tag;
4. compares every signed inspection to the exact APK bytes;
5. requires all APKs to share one non-debug certificate and one Build Tools version;
6. binds the APK signer fingerprint to the supplied public certificate;
7. validates the canonical SPDX 2.3 SBOM and third-party notices;
8. writes deterministic release metadata and copies the four exact APKs;
9. writes `SHA256SUMS` last and independently re-verifies all nine release assets; and
10. writes draft release notes and an acceptance record outside the release asset directory.

A failed staging attempt may leave a partial ignored directory for diagnosis. Remove it deliberately before retrying. The generated release notes contain a required known-limitations review marker; edit the publication copy before creating a draft release, never the staged assets.

## Required public asset set

For `vX.Y.Z[-suffix]`, the clean staging directory contains exactly:

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

`SHA256SUMS` records every other asset in lowercase SHA-256, with a two-space separator and bytewise filename ordering. No release asset may be modified after its digest is recorded.

## Security boundaries

- Never place a production keystore or signing credential in this repository.
- Never pass real passwords as literal command arguments or store them in shell scripts.
- Use `release-work/` and `release-staging/` only for local disposable output; both are ignored.
- Delete disposable test keystores and password environment variables after acceptance.
- Generated Android projects and APKs remain untracked.
- Keep the public production certificate identity documented and verify it independently; keep all private signing material outside Git.
