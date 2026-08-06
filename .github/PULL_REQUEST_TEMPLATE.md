## Linked issue and scope

Closes #

Describe the bounded change and anything intentionally left out.

## Behavior and user impact

Describe observable behavior changes and who is affected.

## Compatibility

- Application/version impact:
- Mini-app SDK impact:
- Database-schema impact:
- Portable-backup impact:
- Complete-host-backup impact:

## Security and permissions

Describe changes to authority boundaries, validation, storage, notifications, Android permissions, native code, dependencies, or release integrity. Write `None` when not applicable.

## Documentation

List documentation changed or explain why no documentation update is needed.

## Validation

List the exact commands, device/emulator checks, and results.

```text
pnpm format
pnpm check
```

## Android or native evidence

Include ABI/package inspection, connected tests, device/emulator results, or logcat evidence when applicable. Write `Not applicable` otherwise.

## UI evidence

Add screenshots only when they materially help review a UI change.

## Final checklist

- [ ] The pull request is limited to one coherent scope.
- [ ] Public SDK, database, backup, and release compatibility impacts are documented.
- [ ] Security and permission impacts are documented.
- [ ] Required documentation is updated.
- [ ] Generated declarations, bundled examples, legal notices, inventories, and SBOM files are synchronized when affected.
- [ ] `pnpm format` was run and its diff was reviewed.
- [ ] `pnpm check` passes.
- [ ] No generated Android tree, APK/AAB, database, backup, signing material, secret, or local configuration is committed.
- [ ] Required evidence is present before marking the pull request ready for review.
