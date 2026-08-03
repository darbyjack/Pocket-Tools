# Pocket Tools Mobile

This is an Expo SDK 57 Android development build. It cannot run in Expo Go because `@pocket-tools/quickjs-runtime` contains Android C++ and Kotlin code.

The mobile host is mini-app agnostic. Bundled reference scripts are installed into SQLite once on first launch. Pasted and bundled scripts then run through the same installed-source QuickJS, storage, timer, and renderer path.

## Run

From the repository root:

```bash
corepack enable
pnpm install
pnpm android
```

`pnpm android` discovers every `examples/*.miniapp.js` file, regenerates the one-time seed catalog, generates `apps/mobile/android`, downloads the pinned QuickJS-NG source during CMake configuration, compiles the native module, installs the debug application, and starts Metro.

Adding another example mini app is not part of the current MVP plan. The existing scripts are sufficient references; new utilities should be pasted and installed through the Android editor.

## Installed script workflow

1. Choose **Add script** in the library.
2. Paste one SDK v1 JavaScript module.
3. Choose **Validate** to inspect it through the embedded runtime.
4. Choose **Preview** to render it against a disposable namespace.
5. Install after the exact current source passes its first render.

Editing an installed app clones its settings, records, and timers into preview storage. Preview actions never write to the installed namespace. The source is updated only after preview succeeds, and the previous active source becomes the last-known-good rollback source.

The library supports open, edit, duplicate, export through the Android share sheet, and removal with either retained or deleted app data.

See [`docs/INSTALLED_MINI_APPS.md`](../../docs/INSTALLED_MINI_APPS.md) for the complete lifecycle.

## Build and native instrumentation

No GitHub Actions workflow is enabled. With an Android emulator or device connected:

```bash
pnpm install
pnpm check
pnpm sync:mini-apps
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest
```

The native instrumentation tests exercise timeout interruption, memory pressure, module restrictions, ambient-global isolation, runtime isolation, bridge validation, promise jobs, captured-log limits, result limits, and recovery after a failed script.

## Run lifecycle and namespace diagnostics

Open **Host diagnostics** from the mini-app library.

The immediate suite uses two temporary installed scripts with the same setting, collection, and timer names to prove:

- Per-manifest setting isolation
- Per-manifest record isolation
- Per-manifest timer isolation
- No persistence from a failed invocation
- A valid invocation works immediately after a failure
- Remove-with-retained-data restores state after reinstall
- Remove-with-data clears the entire namespace

The force-stop test prepares a temporary installed script and timer, saves a checkpoint, and resumes after relaunch. Use:

```bash
adb shell am force-stop com.darbyjack.pockettools
adb shell pidof com.darbyjack.pockettools
```

The second command must print no PID before reopening Pocket Tools. The resumed diagnostic then checks the persisted start timestamp, reconstructed elapsed time, and normal timer stop behavior.

Temporary diagnostic installations use a reserved manifest prefix, are hidden from the normal library, and are cleaned after each run. Startup removes abandoned diagnostics while preserving an active force-stop checkpoint.

See [`docs/LIFECYCLE_DIAGNOSTICS.md`](../../docs/LIFECYCLE_DIAGNOSTICS.md) for the exact procedure and evidence boundary.

## Reset development data

The project intentionally has no compatibility migrations during pre-release development. Clear the application data after an intentional schema change:

```bash
adb shell pm clear com.darbyjack.pockettools
```
