# Draft Release Acceptance Checklist

Use this checklist against the exact signed APK assets downloaded from the draft GitHub Release. Do not test workspace copies and do not rebuild between acceptance and publication.

## Release identity

- [ ] Record release tag and application version.
- [ ] Record source commit SHA and Android `versionCode`.
- [ ] Verify the production certificate fingerprint.
- [ ] Verify every APK against `SHA256SUMS`.
- [ ] Confirm the machine-readable release-gate report identifies the same tag, commit, and assets.

## Automated gate

The release-gate report must contain only `PASS`, `FAIL`, and `NOT_TRIGGERED` outcomes. `NOT_TRIGGERED` is valid only for an explicitly conditional check. An inconclusive result is not a pass.

- [ ] Repository checks pass.
- [ ] SDK 1.0, 1.1, and 1.2 acceptance fixtures pass.
- [ ] Database migration fixtures pass.
- [ ] Portable and complete-host backup compatibility suites pass.
- [ ] APK package, version, SDK, ABI, native-library, signature, checksum, SBOM, and notice checks pass.
- [ ] The final report has `releaseReady: true` and contains no critical or high blockers.

## Exact-byte Android acceptance

### ARM64 physical device

- [ ] Download the ARM64 APK from the draft release.
- [ ] Verify checksum and signature before installation.
- [ ] Install as a clean install and complete startup.
- [ ] Upgrade over the previous accepted public build without clearing data.
- [ ] Exercise Tip Splitter, Bathroom Pay, and SDK 1.2 Acceptance.
- [ ] Verify settings, records, timers, output, notifications, update rollback, backup export, and backup restore.
- [ ] Force-stop and relaunch while a timer and desired notification are active.
- [ ] Capture relevant `adb logcat` output and attach it as evidence.

### Emulator and secondary ABIs

- [ ] Run API 24 x86_64 clean-install and upgrade acceptance.
- [ ] Run current supported x86_64 emulator acceptance.
- [ ] Qualify x86 native loading when the release gate requires it.
- [ ] Qualify ARMv7 native loading when the release gate requires it.
- [ ] Confirm each APK contains exactly its advertised ABI plus `libpocketquickjs.so` and `libc++_shared.so`.

## Notifications and lifecycle

- [ ] Test notification permission granted and denied states.
- [ ] Test exact-alarm access granted and denied states.
- [ ] Verify scheduled, canceled, blocked, and failed reconciliation states.
- [ ] Open the correct tool and screen from a delivered notification.
- [ ] Verify desired notification state survives force-stop, upgrade, and backup restore.

## Accessibility and presentation

- [ ] Complete primary flows with TalkBack.
- [ ] Verify focus order and control semantics.
- [ ] Verify 200% font scaling without clipped required controls.
- [ ] Verify supported light/dark appearance behavior.
- [ ] Verify error and feedback notices remain understandable without color alone.

## Blocker review

- **Critical:** data loss, migration corruption, signature or artifact identity failure, sandbox escape, unsupported SDK execution, or inability to install/start a required release asset.
- **High:** broken required user flow, backup restore failure, notification lifecycle failure, required ABI failure, or accessibility failure that prevents completing a mandatory flow.

- [ ] No open critical release blocker exists.
- [ ] No open high release blocker exists.
- [ ] Every conditional check explains why it was `NOT_TRIGGERED`.
- [ ] Evidence links are present for all manual checks.

## Publication decision

- [ ] The accepted files are byte-for-byte identical to the draft release assets.
- [ ] Release notes identify known limitations without weakening compatibility promises.
- [ ] A maintainer records the final go/no-go decision.
- [ ] Publish the existing draft without replacing or rebuilding any accepted asset.
