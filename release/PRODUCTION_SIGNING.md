# Production Signing Identity

Pocket Tools official GitHub Release APKs are signed with one dedicated long-lived Android signing identity. This public record exists so users and release tooling can verify that an APK belongs to the official Pocket Tools update lineage.

## Certificate identity

- Subject: `CN=Pocket Tools Release`
- Key algorithm: RSA, 4096 bits
- Signature algorithm: SHA-256 with RSA
- Keystore alias: `pocket-tools-release`
- Certificate created: 2026-08-10
- Certificate valid until: 2059-06-18
- SHA-256 certificate fingerprint:

```text
09:51:4F:5A:92:13:F5:FA:C4:2F:23:B7:AB:04:67:0E:40:5A:42:51:1A:09:E6:27:3E:84:20:5B:47:CE:B3:D4
```

The certificate fingerprint is public verification information. The private key, PKCS#12 keystore, passwords, Base64 keystore transport value, and private backup checksums are not public release material and must never be committed or attached to an issue, pull request, workflow log, or release.

## Update continuity

Every official Pocket Tools APK must use the Android application ID `com.darbyjack.pockettools` and an Android-accepted continuation of this signing identity. A build signed by a debug, disposable test, or unrelated certificate is not an official Pocket Tools release even if its source otherwise matches the repository.

Before publication, the release pipeline verifies every ABI-specific APK against this certificate identity and publishes the public certificate with the release assets. Users should independently compare the certificate digest printed by Android Build Tools with the fingerprint above and with the value recorded in the release metadata.

## Custody boundary

The production keystore is stored only through protected maintainer custody and the GitHub `release` environment. Pull-request and ordinary CI jobs must not receive production signing secrets. GitHub-hosted signing decodes the keystore only beneath `$RUNNER_TEMP`, uses masked credentials, and removes temporary signing material in unconditional cleanup.

Production key loss or compromise is a release-blocking security event. Follow the project security policy and signing-custody procedure rather than generating an unrelated replacement key and continuing publication.
