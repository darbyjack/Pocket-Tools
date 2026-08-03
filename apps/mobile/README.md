# Pocket Tools Mobile

This is an Expo SDK 57 Android development build. It cannot run in Expo Go because `@pocket-tools/quickjs-runtime` contains Android C++ and Kotlin code.

## Run

From the repository root:

```bash
corepack enable
pnpm install
pnpm android
```

The first run generates `apps/mobile/android`, downloads the pinned QuickJS-NG 0.15.1 source during CMake configuration, compiles the native module, installs the debug application, and starts Metro.

## Verify process recovery

1. Start a Bathroom Pay trip.
2. Force-stop Pocket Tools from Android settings or `adb shell am force-stop com.darbyjack.pockettools`.
3. Reopen Pocket Tools.
4. Confirm the timer and gross earnings equivalent include the elapsed time while the process was stopped.
5. End the trip and confirm it appears in Recent trips and Today totals.

## Reset development data

The project intentionally has no compatibility migrations during pre-release development. Clear the application data after an intentional schema change:

```bash
adb shell pm clear com.darbyjack.pockettools
```
