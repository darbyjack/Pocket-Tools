# Contributing

## Development flow

1. Choose an unblocked issue from the Pocket Tools wayfinder map.
2. Claim it before beginning work.
3. Create an `agent/<description>` branch from `main`.
4. Keep the change limited to that issue's acceptance criteria.
5. Run `pnpm check`.
6. Open a pull request linking the issue.

Do not add host-only shortcuts for behavior that belongs in the public mini-app SDK. The Bathroom Pay reference app must remain a normal script rather than a privileged built-in feature.

## Contract changes

Changes to `packages/sdk-contract` require:

- An explicit compatibility assessment
- Updated validation tests
- Updated documentation and examples
- A new SDK major version for breaking behavior

Every value crossing the script/host boundary must remain serializable according to `SerializableValue`.
