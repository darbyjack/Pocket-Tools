# Verify a Pocket Tools Release

Verify release assets before installing them. The APK, checksum list, release metadata, and public signing information must all come from the same GitHub Release.

The stable production signing identity is recorded in [Production Signing Identity](../release/PRODUCTION_SIGNING.md). The expected SHA-256 certificate fingerprint for official Pocket Tools APKs is:

```text
09:51:4F:5A:92:13:F5:FA:C4:2F:23:B7:AB:04:67:0E:40:5A:42:51:1A:09:E6:27:3E:84:20:5B:47:CE:B3:D4
```

## Preserve the downloaded bytes

Do not rebuild, align, sign, rename, or modify an APK before verification. Acceptance and publication apply to the exact bytes attached to the release.

Record:

- the release tag
- the APK file name
- the selected ABI
- the source commit recorded by the release metadata
- the expected SHA-256 digest
- the expected application ID and version
- the expected signing-certificate SHA-256 fingerprint

## Verify the SHA-256 checksum

On Windows PowerShell:

```powershell
Get-FileHash .\Pocket-Tools-<version>-<abi>.apk -Algorithm SHA256
Get-Content .\SHA256SUMS
```

The computed digest must exactly match the line for that APK in `SHA256SUMS`. A mismatch means the file is not the accepted release asset. Delete it and download it again from the official release.

When the release includes a repository verification command, run it as an additional check. It does not replace comparing the exact digest.

## Verify the Android package and version

Use Android SDK Build Tools from the supported toolchain:

```powershell
apkanalyzer manifest application-id .\Pocket-Tools-<version>-<abi>.apk
apkanalyzer manifest version-name .\Pocket-Tools-<version>-<abi>.apk
apkanalyzer manifest version-code .\Pocket-Tools-<version>-<abi>.apk
```

The application ID must be:

```text
com.darbyjack.pockettools
```

The version name and version code must agree with the release metadata.

## Verify the signing certificate

Locate `apksigner` in the Android SDK Build Tools directory and print the APK certificate:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat" `
  verify `
  --verbose `
  --print-certs `
  .\Pocket-Tools-<version>-<abi>.apk
```

The certificate SHA-256 digest must exactly equal:

```text
09:51:4F:5A:92:13:F5:FA:C4:2F:23:B7:AB:04:67:0E:40:5A:42:51:1A:09:E6:27:3E:84:20:5B:47:CE:B3:D4
```

It must also agree with the fingerprint in the release metadata and the public certificate attached to that release. A checksum match alone does not authorize a certificate mismatch.

Development, debug, disposable test, and production release certificates are different identities. Do not treat an APK signed with a debug or local test certificate as an official production release.

## Verify the packaged ABI and native libraries

List native library entries:

```powershell
jar tf .\Pocket-Tools-<version>-<abi>.apk |
  Select-String '^lib/'
```

Every native library path must use the APK's advertised ABI directory. The APK must contain:

- `libpocketquickjs.so`
- `libc++_shared.so`

Reject an APK that contains an unexpected ABI, omits a required library, or mixes native libraries from multiple ABI directories when the release contract identifies it as a single-ABI asset.

## Verify the release set

The release metadata and checksum list should account for every published asset and no undeclared extra files. Check that:

- the APK name matches its ABI
- the source commit and application version agree
- the SPDX SBOM and notices identify the same release
- the checksum list covers the exact APK
- the signing fingerprint agrees with the certificate printed by `apksigner` and the stable production signing record
- known limitations are disclosed in the release notes

## Install only after every check passes

Continue to [installation](INSTALLATION.md) only after the downloaded bytes, checksum, package identity, version, ABI, native libraries, and signing certificate all agree.

A failed or inconclusive check is not a pass. Ask for help through the [support policy](../SUPPORT.md) without attaching private data, backups, signing material, or unreleased vulnerability details.
