# Release Engineering

This directory documents the repository-owned release pipeline introduced in Phase 8. The scripts are designed to run locally before GitHub Actions or the production signing identity exists.

An official Pocket Tools build is not created by these commands alone. Official distribution requires a published immutable GitHub Release, the production signing certificate, trusted workflow attestations, and exact-byte draft acceptance. Phase 8 proves the local build and verification contract with a disposable test identity only.

## Current foundation

The first Phase 8 slice implements:

- strict stable, alpha, beta, and release-candidate tag parsing;
- agreement between the tag, root package, mobile package, Expo version, Android package, and positive `versionCode`;
- a clean-worktree and exact-HEAD source requirement;
- the exact nine-file release asset contract;
- deterministic release-plan JSON;
- bytewise filename ordering for `SHA256SUMS`;
- exact asset-set validation with no extra files, missing files, directories, or symbolic links;
- checksum verification against the final staged bytes;
- negative tests for invalid versions, asset-set drift, and post-checksum mutation.

Later Phase 8 slices add isolated four-ABI prebuild/build orchestration, APK inspection, disposable-key signing, certificate validation, metadata finalization, legal-artifact staging, and complete local end-to-end verification.

## Commands

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
- Never pass real passwords on a command line that may be recorded in shell history.
- Use `release-work/` and `release-staging/` only for local disposable output; both are ignored.
- Generated Android projects and APKs remain untracked.
- The production key and stable public certificate are created in their later approved phases, not during this implementation slice.
