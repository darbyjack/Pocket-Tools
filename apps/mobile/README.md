# Pocket Tools Mobile

This is an Expo SDK 57 Android development build. It cannot run in Expo Go because `@pocket-tools/quickjs-runtime` contains Android C++ and Kotlin code.

The mobile host is mini-app agnostic. It loads source strings from the generated bundled-script data catalog and sends the selected script through the same generic QuickJS, storage, timer, and renderer path.

## Run

From the repository root:

```bash
corepack enable
pnpm install
pnpm android
```

`pnpm android` discovers every `examples/*.miniapp.js` file, regenerates the bundled JSON catalog, generates `apps/mobile/android`, downloads the pinned QuickJS-NG 0.15.1 source during CMake configuration, compiles the native module, installs the debug application, and starts Metro.

Adding another example mini app requires only another `.miniapp.js` file. It must not require a new hook, screen, renderer branch, or storage service.

## Verify process recovery

Using any script with a durable timer:

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
