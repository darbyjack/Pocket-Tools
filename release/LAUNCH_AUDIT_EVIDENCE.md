# Phase 10 Launch Audit Evidence

This file records the reviewed, share-safe evidence for the Pocket Tools public-launch history audit. Raw scanner output remains local under ignored `release-work/history-audit/` and must not be committed.

Tracking issue: #114

## First complete audit pass

- Audited Phase 10 head: `e03f7135f7b4440bc5940f351fec697b05a9e30a`
- Audited `main`: `c7861770b1bb6519d0393af9b42d49bb7f281c5d`
- Audit generated: `2026-08-07T13:14:52.589Z`
- Git: `2.54.0.windows.1`
- Node.js: `v24.18.0`
- Gitleaks: `8.30.0`
- Scanner self-test: passed; repository scan completed
- Remote-derived refs: 56
- Current branch refs: 7
- Pull-request refs: 49
- Tag refs: 0
- Reachable Git objects: 6,536
- Reachable blobs: 1,279
- Gitleaks findings: 0
- Suspicious-path findings: 99
- Large-blob findings: 1
- Content-review findings: 16

The audit scope was isolated to GitHub-derived `refs/audit/*` branch, tag, and pull-request refs. Local-only branches, stashes, reflogs, and workstation-only refs were not part of the public-exposure audit.

## Reviewed findings

### Secret scan

**Classification: clean**

Gitleaks reported zero repository-history findings after its runtime self-test succeeded. No credential rotation, revocation, or secret-driven history rewrite is required from this pass.

### Suspicious historical paths

**99 findings — classification: `false-positive` / `accepted-public`**

Every suspicious-path finding is legitimate checked-in Android native-module source under:

- `modules/pocket-quickjs/android/**`
- `modules/pocket-notifications/android/**`

These directories contain maintained Kotlin, C++, CMake, manifest, resource, and Android instrumentation-test source. They are not generated Expo application projects or build output and are required source for the public repository.

The audit heuristic is intentionally conservative and matched the `android` path segment too broadly. No removal or history rewrite is required.

### Large historical blobs

**1 finding — classification: `accepted-public`**

- Blob: `3a1cce6d1b5caf388dc65c2b8a772f7a7f58c595`
- Size: 1,386,799 bytes
- Path: `apps/docs/public/icon.png`

The blob is the current documentation icon asset and is intentionally part of the public documentation site. It is not an archive, application package, database, dump, or private binary. No remediation is required.

### Credential-assignment heuristic

**11 findings — classification: `false-positive`**

The findings occur only in:

- historical/current `.github/workflows/release-draft.yml` versions;
- `scripts/workflow-policy.test.mjs` versions;
- `scripts/repository-history-audit-review.test.mjs`.

The release workflow contains GitHub expression references to protected release secret names and the built-in GitHub token, not credential values. Workflow policy tests assert that secret names stay inside the protected signing job. The audit-review test uses explicit dummy text to verify sanitization. Gitleaks reported no secret values in these blobs.

No credential rotation or history rewrite is required.

### Historical Windows developer path

**5 findings — classification: `accepted-public` historical metadata**

Five historical versions of `apps/mobile/README.md` contained the same absolute Windows checkout path under the local developer user profile.

The path does not contain a credential, key, token, private network location, customer/user data, or otherwise sensitive value. Current documentation already uses repository-relative commands and no longer contains the absolute path.

The historical path is harmless developer metadata. Rewriting repository history solely to remove it would be disproportionate and is not required by the Phase 10 remediation policy.

## Ref disposition

The first audit snapshot contained these current branch refs:

- `main` — retain.
- `agent/phase-10-history-audit` — retain until Phase 10 merges.
- `dependabot/github_actions/actions/attest-build-provenance-4.1.1` — intentionally retain/defer until public cutover.
- `dependabot/github_actions/actions/checkout-7.0.1` — intentionally retain/defer until public cutover.
- `dependabot/github_actions/actions/download-artifact-8.0.1` — intentionally retain/defer until public cutover.
- `dependabot/github_actions/actions/upload-artifact-7.0.1` — intentionally retain/defer until public cutover.
- `dependabot/github_actions/pnpm/action-setup-6.0.10` — intentionally retain/defer until public cutover.

The previously merged Phase 9 hotfix branch was already absent from the remote snapshot. No stale branch needs deletion before the final Phase 10 audit.

There were no tags.

## Remediation decision

The reviewed first pass found:

- no real secret or credential exposure;
- no private keys, signing material, databases, backups, dumps, APK/AAB packages, or non-redistributable historical artifacts requiring removal;
- no credential rotation or revocation requirement;
- no history-rewrite requirement;
- no stale current remote branch requiring deletion before cutover.

The five Dependabot branches are intentionally retained as deferred workflow-maintenance work. Android smoke and Actions dependency remediation remain deferred until public cutover to avoid private-repository Actions usage.

## Final rerun requirement

This evidence file changes the Phase 10 branch after the first audit snapshot. Therefore the complete local audit must be rerun from the final Phase 10 branch head before the phase can merge.

The final rerun must confirm that no new blocking finding was introduced and record its final head, timestamp, tool versions, ref/object/blob counts, and finding counts here before Phase 10 is marked complete.
