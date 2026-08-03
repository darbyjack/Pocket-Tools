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

## Run the sandbox instrumentation suite

No GitHub Actions workflow is enabled. With an Android emulator or device connected:

```bash
pnpm install
pnpm check
pnpm sync:mini-apps
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest
```

The instrumentation tests exercise timeout interruption, memory pressure, module restrictions, ambient-global isolation, runtime isolation, bridge validation, promise jobs, captured-log limits, result limits, and recovery after a failed script.

## Verify installed-script isolation

On an emulator or device:

1. Open an installed script and create recognizable settings, records, and timer state.
2. Edit it and enter preview.
3. Change all three kinds of state in preview, then cancel.
4. Reopen the installed script and confirm its state is unchanged.
5. Preview a valid update, install it, and confirm the existing state remains.
6. Roll back and confirm only source changes.
7. Remove the app while keeping data, reinstall the same manifest ID, and confirm recovery.
8. Remove the app and data, reinstall it, and confirm a clean namespace.

## Verify process recovery

Using any installed script with a durable timer:

1. Start the timer.
2. Force-stop Pocket Tools from Android settings or `adb shell am force-stop com.darbyjack.pockettools`.
3. Reopen Pocket Tools.
4. Confirm the timer includes the elapsed time while the process was stopped.
5. Stop the timer and confirm the script's resulting record and summaries remain after another relaunch.

Bathroom Pay is currently the reference script used for this test.

## Reset development data

The project intentionally has no compatibility migrations during pre-release development. Clear the application data after an intentional schema change:

```bash
adb shell pm clear com.darbyjack.pockettools
```
