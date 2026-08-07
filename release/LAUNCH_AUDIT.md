# Public Launch History Audit

Phase 10 freezes the repository for public-launch preparation and audits the complete reachable Git history before visibility changes.

Tracking issue: #114

## Launch freeze

The launch freeze begins from:

```text
main: c7861770b1bb6519d0393af9b42d49bb7f281c5d
```

Until public cutover, only disclosure, security, legal, documentation, workflow, or release-blocker fixes should land.

Non-blocking Android smoke remediation is intentionally deferred until public cutover to avoid consuming private-repository GitHub Actions usage.

## Audit scope

The Windows runner refreshes an isolated local `refs/audit/*` namespace directly from GitHub before every scan:

- `refs/heads/*` is mirrored to `refs/audit/heads/*`;
- `refs/tags/*` is mirrored to `refs/audit/tags/*`;
- GitHub `refs/pull/*/head` is mirrored to `refs/audit/pull/*/head`, including closed PRs retained by GitHub.

Only that isolated remote-derived namespace is scanned. Local-only branches, stashes, worktrees, and other workstation refs are deliberately excluded because they do not become public with the repository.

The final audit includes:

- every Git object reachable from the isolated remote-derived refs;
- suspicious historical filenames;
- unusually large historical blobs;
- text blobs containing personal local paths, private-network URLs, database URLs, or credential-like assignments;
- a full redacted Gitleaks scan across the same exact ref set.

The audit output is sensitive review material. It belongs under ignored `release-work/history-audit/` and must not be committed verbatim.

## Pinned secret scanner

Phase 10 pins Gitleaks `8.30.0`.

Gitleaks `8.30.1` is intentionally not used. Before Phase 10 execution, upstream issue #2170 documented a regression where the 8.30.1 release could return a clean exit without detecting canonical secrets. The audit therefore uses the preceding 8.30.0 release and independently verifies scanner behavior before scanning repository history.

The Windows runner verifies both official release digests before extraction:

```text
gitleaks_8.30.0_checksums.txt
SHA-256: 78e53de2429bde6500a6f22793546babe6ae75634a0c250c37e3a07703856a90

gitleaks_8.30.0_windows_x64.zip
SHA-256: 54fe94f644b832dd08e8c3a5915efb3bfa862386d59fb27ca0792cb687a83573
```

Before the history scan, the repository audit assembles a synthetic GitHub-style token only at runtime and streams it into `gitleaks stdin`. The scanner must report a finding with exit code `1`. Exit code `0` is treated as a broken detector and aborts the audit.

No GitHub Actions job is required.

## Run on Windows

Start from the Phase 10 branch with a clean worktree:

```powershell
git fetch origin

git switch agent/phase-10-history-audit

git reset --hard origin/agent/phase-10-history-audit

powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File .\scripts\repository-history-audit.ps1
```

Review these share-safe queues first:

```text
release-work/history-audit/summary.json
release-work/history-audit/gitleaks-review.json
release-work/history-audit/suspicious-paths.json
release-work/history-audit/large-blobs.json
release-work/history-audit/content-review.json
release-work/history-audit/refs.json
release-work/history-audit/SHA256SUMS
```

`gitleaks-review.json` intentionally omits the matched secret, match text, and source line. The raw `gitleaks.json` remains local review material even though Gitleaks is invoked with full redaction. `SHA256SUMS` covers both the raw local evidence and the sanitized review queue.

Do not paste an unredacted secret into an issue, PR, commit, or chat while reviewing a finding.

## Finding review

A finding is not automatically a launch blocker. Review the actual historical object and classify it.

Useful commands:

```powershell
# Find commits that introduced or removed a specific blob within the audited refs.
git log --find-object=<BLOB_SHA> $(git for-each-ref --format="%(refname)" refs/audit) --oneline --decorate

# Inspect a historical path across the audited refs.
git log $(git for-each-ref --format="%(refname)" refs/audit) --full-history -- <PATH>

# Inspect one blob. Do not copy sensitive values into public notes.
git cat-file blob <BLOB_SHA>
```

Classify every reviewed item as one of:

- `remove-history` — actual secret, private data, proprietary content, or non-redistributable material;
- `rotate-and-remove-history` — credential/signing material requiring both rotation and history remediation;
- `accepted-public` — intentional redistributable content safe to expose;
- `generated-but-harmless` — build/generated content that is not sensitive but should be noted;
- `false-positive` — heuristic or scanner match that is not sensitive.

Any real credential must be rotated or revoked even if Git history is rewritten.

## Initial remote ref inventory

At Phase 10 start there were no tags.

Branches present before final cleanup:

| Ref | Initial disposition |
| --- | --- |
| `main` | retain |
| `agent/fix-ci-pnpm-classifier` | merged; delete after audit evidence captures its history |
| `dependabot/github_actions/actions/attest-build-provenance-4.1.1` | retain temporarily; deferred to public cutover |
| `dependabot/github_actions/actions/checkout-7.0.1` | retain temporarily; deferred to public cutover |
| `dependabot/github_actions/actions/download-artifact-8.0.1` | retain temporarily; deferred to public cutover |
| `dependabot/github_actions/actions/upload-artifact-7.0.1` | retain temporarily; deferred to public cutover |
| `dependabot/github_actions/pnpm/action-setup-6.0.10` | retain temporarily; deferred to public cutover |

The final audit must be rerun after any remote ref deletion or history rewrite. The runner deletes and recreates `refs/audit/*` before every run so stale local audit refs cannot survive between snapshots.

## Evidence record

Commit only a reviewed summary, never raw sensitive scan output.

Fill this section after review:

- Audited `main`:
- Audit tooling commit:
- Audit date:
- Git version:
- Node version:
- Gitleaks version:
- Scanner self-test:
- Remote-derived ref count:
- Pull-request ref count:
- Reachable blob count:
- Gitleaks findings reviewed:
- Suspicious historical paths reviewed:
- Large blobs reviewed:
- Content-review findings reviewed:
- Remote branches deleted:
- Remote branches intentionally retained:
- Tags reviewed:
- Credential rotations/revocations:
- History rewrites:
- Final rerun result:

## Merge gate

Phase 10 is complete only when:

- the repository remains private;
- the launch freeze is still in effect;
- the pinned scanner's synthetic-token self-test passes;
- every scanner and heuristic finding is classified;
- every real sensitive finding is remediated;
- every required credential is rotated or revoked;
- stale refs are deleted or explicitly retained with rationale;
- the complete remote-derived audit is rerun after ref/history changes;
- the reviewed evidence summary is committed;
- public visibility and repository settings remain deferred to Phase 11.
