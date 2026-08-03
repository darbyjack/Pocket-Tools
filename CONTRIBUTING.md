# Contributing

Read [AGENTS.md](AGENTS.md) before making changes.

## Development flow

1. Choose an unblocked issue from the Pocket Tools wayfinder map.
2. Claim it before beginning work.
3. Create an `agent/<description>` branch from `main`.
4. Keep the change limited to the smallest working slice described by the issue.
5. Run `pnpm check`.
6. Open a pull request linking the issue.

Do not add host-only shortcuts for behavior that belongs in the public mini-app SDK. Bathroom Pay must remain a normal script rather than a privileged built-in feature.

## Contract changes

Changes to `packages/sdk-contract` require:

- A concrete requirement from the working slice being implemented
- Updated validation tests
- Updated documentation and examples
- Removal of obsolete APIs rather than compatibility shims, fallbacks, deprecations, or migrations

Do not add an API because it may be useful later. Add it when a working mini app needs it.

Every value crossing the script/host boundary must remain serializable according to `SerializableValue`.
