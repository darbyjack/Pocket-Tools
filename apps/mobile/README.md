# Pocket Tools Mobile

This is an Expo SDK 57 Android development build. It cannot run in Expo Go because Pocket Tools contains custom Android QuickJS and notification modules.

The mobile host is mini-app agnostic. Bundled reference scripts are installed into SQLite once on first launch. Pasted and bundled scripts then run through the same installed-source QuickJS, storage, timer, notification, effect, and renderer path.

## Run

From the repository root:

```bash
corepack enable
pnpm install
pnpm android
```

`pnpm android` discovers every `examples/*.miniapp.js` file, regenerates the one-time seed catalog, generates `apps/mobile/android`, downloads the pinned QuickJS-NG source during CMake configuration, compiles the native modules, installs the debug application, and starts Metro.

Adding another bundled example is not required for ordinary mini-app development. New utilities should be authored against the public SDK declarations and pasted through the Android editor.

## Installed script workflow

1. Choose **Add tool** from Pocket Tools.
2. Paste one SDK 1.0, 1.1, or 1.2 JavaScript module.
3. Choose **Check**.
4. Choose **Preview**.
5. Exercise representative settings, actions, output, and notifications in preview.
6. Choose **Install tool** after the preview is ready.

Editing an installed tool clones its settings, records, and timers into preview storage. Preview actions never write to the installed namespace or retain installed notification registrations. The source is updated only after preview succeeds, and the previous active source becomes the last-known-good rollback source.

Open a tool and choose **Manage** for edit, duplicate, script export, backup, rollback, notification settings, and removal. Open **Settings** for complete backup, restore, global notification settings, and developer diagnostics.

See [`docs/INSTALLED_MINI_APPS.md`](../../docs/INSTALLED_MINI_APPS.md) for the complete lifecycle and [`docs/SDK_1_2_ANDROID_NOTIFICATIONS.md`](../../docs/SDK_1_2_ANDROID_NOTIFICATIONS.md) for Android delivery behavior.

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

After changing or pulling native build configuration, regenerate Android before building:

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
pnpm sdk:declarations
pnpm sync:mini-apps
pnpm format
pnpm check
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

The complete validation covers:

- SDK 1.0, 1.1, and 1.2 contract compatibility
- Timeout interruption, memory pressure, stack and result limits
- Module restrictions and ambient-global isolation
- Runtime and storage namespace isolation
- UI, operation, effect, notification, and bridge validation
- Transactional setting/record behavior and recovery after failure
- Notification scheduling, exact-delivery fallback, registry reconciliation, and tap routing
- Declaration, authoring-runtime, and embedded Android wrapper parity

## Final SDK 1.2 physical acceptance

On the Galaxy S24 Ultra, validate the normal public workflow with a representative SDK 1.2 tool:

1. Validate and inspect the source locally.
2. Paste, check, preview, and install it.
3. Exercise date/date-time and multi-select settings, setting writes, records, queries, aggregates, tappable rows, badges, progress, fixed icons, feedback, copy/share, and notifications.
4. Confirm transaction rollback after an intentionally invalid action.
5. Update the source and roll it back.
6. Duplicate and export it.
7. Back it up, remove it, and restore it.
8. Force-stop and reopen the app; verify data, timers, notification registry, and tap routing recover.
9. Verify TalkBack and large-font behavior for representative controls.

With the Galaxy Watch4 Classic paired, confirm a normal Pocket Tools phone notification mirrors according to Galaxy Wearable settings. Pocket Tools does not expose a watch API and cannot force or inspect mirroring.

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

The project intentionally has no general compatibility migration framework during pre-release host development. Clear application data after an intentional host schema change:

```bash
adb shell pm clear com.darbyjack.pockettools
```

This command is for development only and is not part of SDK 1.2 tool update, rollback, backup, or restore behavior.
