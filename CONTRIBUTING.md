# Contributing

Read [AGENTS.md](AGENTS.md) and the [documentation index](docs/README.md) before making changes.

## Development flow

1. Start from the latest `main`.
2. Create an `agent/<description>` branch.
3. Keep the change limited to one coherent working slice.
4. Update implementation, validation, declarations, examples, and documentation together when the public SDK changes.
5. Run the required checks.
6. Open a pull request describing behavior, compatibility impact, documentation changes, and validation results.

No GitHub Actions workflows are enabled. Do not add one as an incidental part of another change.

## Required repository checks

```bash
pnpm sync:mini-apps:check
pnpm sdk:declarations:check
pnpm format
pnpm check
```

`pnpm format` may rewrite files. Review the resulting diff, then rerun `pnpm check`.

Android or native-runtime changes also require the build and connected-test procedure in [`apps/mobile/README.md`](apps/mobile/README.md).

## Public SDK changes

The released public source of truth is:

- [`packages/sdk-contract/src/`](packages/sdk-contract/src/)
- generated declarations in [`packages/sdk-contract/dist/`](packages/sdk-contract/dist/)
- the executable QuickJS SDK and runner
- host protocol, validation, renderer, storage, and native services
- [`docs/SDK_1_2_CONTRACT.md`](docs/SDK_1_2_CONTRACT.md)
- [`docs/AGENT_AUTHORING.md`](docs/AGENT_AUTHORING.md)
- canonical fixtures and examples

A contract change must update every affected layer in the same pull request. Do not invent APIs for possible future use or expose a partial capability. Preserve SDK 1.0 and 1.1 behavior unless an explicit versioned decision says otherwise.

Every value crossing the script/host boundary must remain finite and serializable according to `SerializableValue`.

## Architecture rules

- Mini-app behavior belongs in ordinary script source, not a privileged host branch.
- Bundled examples and pasted tools must use the same installed-source path.
- Scripts never receive native objects, database handles, storage namespaces, or ambient device authority.
- Host mutations remain validated and transactional.
- Remove obsolete documentation and paths instead of preserving competing sources of truth.
