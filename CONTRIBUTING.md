# Contributing

Read [AGENTS.md](AGENTS.md), the [documentation index](docs/README.md), and the policies linked below before making changes.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Choose the correct route

- Use GitHub Discussions for questions, authoring help, unaccepted ideas, examples, and general conversation.
- Use the matching issue form for reproducible bugs, accepted feature work, SDK proposals, or documentation defects.
- Report vulnerabilities privately through [SECURITY.md](SECURITY.md).
- Read [SUPPORT.md](SUPPORT.md) before requesting troubleshooting help.

## Contribution license

Pocket Tools is licensed under the [Apache License 2.0](LICENSE).

Unless explicitly stated otherwise, a contribution intentionally submitted for inclusion in this repository is provided under Apache-2.0 under the normal inbound-equals-outbound model. No contributor license agreement or Developer Certificate of Origin sign-off is required initially.

Do not submit code, assets, data, or text that you do not have permission to contribute.

## Asset and copied-material provenance

New images, fonts, sounds, sample data, copied snippets, generated media, and other non-original material must include enough provenance to verify redistribution rights.

Update [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), dependency inventories, and the SPDX SBOM when the change affects them. Follow [docs/LICENSING.md](docs/LICENSING.md).

## Development flow

1. Start from the latest `main`.
2. Create an `agent/<description>` branch.
3. Keep the change limited to one coherent working slice.
4. Link the implementation to an accepted issue.
5. Update implementation, validation, declarations, examples, generated files, and documentation together.
6. Run the required checks.
7. Open a pull request using the repository template.
8. Keep the pull request in draft while required evidence is knowingly missing.

GitHub Actions and repository-hosted public rules are enabled only during their approved roadmap phases. Do not add or enable them incidentally.

## Required repository checks

```bash
pnpm install --frozen-lockfile
pnpm format
pnpm check
git diff --exit-code
```

`pnpm format` may rewrite files. Review the resulting diff, then rerun `pnpm check`.

Android or native-runtime changes also require the build, package-inspection, connected-test, and device/emulator procedures in [`apps/mobile/README.md`](apps/mobile/README.md) and [`docs/RELEASE_ACCEPTANCE_CHECKLIST.md`](docs/RELEASE_ACCEPTANCE_CHECKLIST.md).

Never commit generated `apps/mobile/android/`, APK/AAB files, databases, backups, signing material, secrets, or local Android configuration.

## Pull-request expectations

A pull request must explain:

- the linked issue and exact scope;
- observable behavior and user impact;
- SDK, database, backup, and application compatibility impact;
- security, privacy, Android-permission, and native-code impact;
- documentation changes;
- exact checks and results;
- Android/native evidence when applicable;
- generated-file, notice, inventory, and SBOM synchronization when affected.

Screenshots are useful when they materially improve review of a UI change; they are not required for unrelated work.

## Public SDK changes

The released public source of truth is:

- [`packages/sdk-contract/src/`](packages/sdk-contract/src/)
- generated declarations in [`packages/sdk-contract/dist/`](packages/sdk-contract/dist/)
- the executable QuickJS SDK and runner
- host protocol, validation, renderer, storage, and native services
- [`docs/SDK_1_2_CONTRACT.md`](docs/SDK_1_2_CONTRACT.md)
- [`docs/AGENT_AUTHORING.md`](docs/AGENT_AUTHORING.md)
- canonical fixtures and examples

A contract change must update every affected layer in the same pull request. Do not invent APIs for possible future use or expose a partial capability.

Preserve released SDK 1.0, 1.1, and 1.2 behavior unless an explicit versioned decision says otherwise. Public application, database, backup, signing, and documented behavior boundaries also require an explicit compatibility decision before they are broken.

Every value crossing the script/host boundary must remain finite and serializable according to `SerializableValue`.

## Architecture rules

- Mini-app behavior belongs in ordinary script source, not a privileged host branch.
- Bundled examples and pasted tools must use the same installed-source path.
- Scripts never receive native objects, database handles, storage namespaces, arbitrary networking, or ambient device authority.
- Host mutations remain validated and transactional.
- Security-sensitive details are reported privately, not placed in public issues or pull requests.
- Remove obsolete unreleased implementation paths instead of preserving competing sources of truth.

## Governance

Pocket Tools is maintainer-led. Read [GOVERNANCE.md](GOVERNANCE.md) for decision, maintainer, merge, release, conflict, inactivity, and succession responsibilities.

Submitting a contribution does not guarantee acceptance, a timeline, or maintainer status.
