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

1. Choose **Add tool** from Pocket Tools.
2. Paste one SDK 1.0 or 1.1 JavaScript module.
3. Choose **Check**.
4. Choose **Preview**.
5. Choose **Install tool** after the preview is ready.

Editing an installed tool clones its settings, records, and timers into preview storage. Preview actions never write to the installed namespace. The source is updated only after preview succeeds, and the previous active source becomes the last-known-good rollback source.

Open a tool and choose **Manage** for edit, duplicate, script export, backup, rollback, and removal. Open **Settings** for complete backup, restore, and developer diagnostics.

See [`docs/INSTALLED_MINI_APPS.md`](../../docs/INSTALLED_MINI_APPS.md) for the complete lifecycle.

## Galaxy S24 Ultra build target

Pocket Tools is intentionally configured for the Samsung Galaxy S24 Ultra's 64-bit ARM runtime:

```properties
reactNativeArchitectures=arm64-v8a
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
```

The Expo config plugin writes these values into the generated `android/gradle.properties` on every prebuild. Both debug and release builds omit ARMv7 and x86/x86_64 native binaries. Release builds additionally run R8 and remove unused Android resources.

Consequences:

- Native build work and APK size are reduced.
- The APK remains suitable for the Galaxy S24 Ultra and other `arm64-v8a` Android devices.
- The APK will not install on x86 Android emulators or 32-bit ARM devices.
- This configuration does not replace the final private signing setup.

After changing or pulling the build configuration, regenerate Android before building:

```powershell
Set-Location C:\Users\Glare\Documents\Projects\Pocket-Tools

pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
Set-Location .\apps\mobile\android

.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
```

APK outputs:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Confirm the connected phone supports the selected ABI:

```powershell
adb shell getprop ro.product.cpu.abilist
```

The output must include `arm64-v8a`. Confirm the APK contains no other native ABI directories:

```powershell
jar tf .\app\build\outputs\apk\release\app-release.apk |
  Select-String '^lib/'
```

Every listed native library path should begin with `lib/arm64-v8a/`.

## Build and native instrumentation

No GitHub Actions workflow is enabled. With an Android device connected:

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

Open **Settings**, then choose **Diagnostics**.

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
