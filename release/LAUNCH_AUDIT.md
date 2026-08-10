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

The final audit includes only refs that GitHub can expose publicly:

- every current remote branch mirrored under `refs/audit/heads/*`;
- every current tag mirrored under `refs/audit/tags/*`;
- GitHub pull-request heads mirrored under `refs/audit/pull/*/head`, including closed PRs;
- every Git object reachable from those isolated refs;
- suspicious historical filenames;
- unusually large historical blobs;
- text blobs containing personal local paths, private-network URLs, database URLs, or credential-like assignments;
- a full redacted Gitleaks Git-history scan restricted to the isolated audit refs.

Local-only branches, stashes, reflogs, and workstation-only refs are intentionally excluded because they do not become public with the GitHub repository.

The audit output is sensitive review material. It belongs under ignored `release-work/history-audit/` and must not be committed verbatim.

## Pinned secret scanner

Phase 10 pins Gitleaks `8.30.0`.

Gitleaks `8.30.1` is intentionally not used because upstream issue #2170 documented a regression where that release could return a clean exit without detecting canonical secrets.

The Windows runner verifies the official Gitleaks `8.30.0` release checksum manifest and the Windows x64 archive before extraction.

Before the history scan, the repository audit assembles a synthetic GitHub-style token only at runtime and streams it into `gitleaks stdin`. The token body intentionally avoids Gitleaks' built-in global stopwords. The scanner must report a finding with exit code `1`. Exit code `0` is treated as a broken detector and aborts the audit.

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

The runner deletes stale `refs/audit/*` refs, then fetches fresh GitHub branch heads, tags, and pull-request heads into that isolated namespace before scanning.

Review:

```text
release-work/history-audit/summary.json
release-work/history-audit/gitleaks-review.json
release-work/history-audit/suspicious-paths.json
release-work/history-audit/large-blobs.json
release-work/history-audit/content-review.json
release-work/history-audit/refs.json
release-work/history-audit/SHA256SUMS
```

Do not share `gitleaks.json`; it is the raw redacted scanner report. `gitleaks-review.json` contains only the rule, path, commit, and line metadata needed for collaborative review.

## Finding review

A finding is not automatically a launch blocker. Review the actual historical object and classify it.

Useful commands:

```powershell
# Find commits that introduced or removed a specific blob.
git log --all --find-object=<BLOB_SHA> --oneline --decorate

# Inspect a historical path without checking it out.
git log --all --full-history -- <PATH>

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

| Ref                                                               | Initial disposition                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| `main`                                                            | retain                                                   |
| `agent/fix-ci-pnpm-classifier`                                    | merged; delete after audit evidence captures its history |
| `dependabot/github_actions/actions/attest-build-provenance-4.1.1` | retain temporarily; deferred to public cutover           |
| `dependabot/github_actions/actions/checkout-7.0.1`                | retain temporarily; deferred to public cutover           |
| `dependabot/github_actions/actions/download-artifact-8.0.1`       | retain temporarily; deferred to public cutover           |
| `dependabot/github_actions/actions/upload-artifact-7.0.1`         | retain temporarily; deferred to public cutover           |
| `dependabot/github_actions/pnpm/action-setup-6.0.10`              | retain temporarily; deferred to public cutover           |

The final audit must be rerun after any ref deletion or history rewrite.

## Evidence record

Commit only a reviewed summary, never raw sensitive scan output.

Fill this section after review:

- Audited `origin/main`:
- Audit tooling commit:
- Audit date:
- Git version:
- Node version:
- Gitleaks version:
- Scanner self-test:
- Ref count:
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
- the complete audit is rerun after ref/history changes;
- the reviewed evidence summary is committed;
- public visibility and repository settings remain deferred to Phase 11.
