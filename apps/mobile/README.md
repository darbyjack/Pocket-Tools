# Pocket Tools Mobile

Pocket Tools Mobile is an Expo SDK 57 Android development build with custom QuickJS-NG and notification native modules. It cannot run in Expo Go.

The host is mini-app agnostic. Bundled reference scripts are seeded into SQLite once; bundled and pasted tools then use the same installed-source runtime, storage, renderer, lifecycle, output, and notification path.

## Requirements

- Node.js 24.16 or newer
- pnpm 11.17.0 through Corepack
- Android Studio and an Expo SDK 57-compatible Android SDK
- Android NDK 26 or newer
- a connected `arm64-v8a` Android device for the configured build target

## Run the development build

From the repository root:

```bash
corepack enable
pnpm install
pnpm android
```

`pnpm android` synchronizes `examples/*.miniapp.js`, generates Android native files as needed, builds the custom native modules, installs the debug app, and starts Metro.

Ordinary mini-app development does not require adding a bundled example or rebuilding the host. Author against the public declarations, validate locally, and paste the source through **Add tool**.

## Repository validation

```bash
pnpm sync:mini-apps:check
pnpm sdk:declarations:check
pnpm format
pnpm check
```

No GitHub Actions workflows are enabled. Run these checks manually before pull-request readiness.

## Regenerate Android

After native module, Expo configuration, or Gradle-property changes:

```bash
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
```

On Windows PowerShell:

```powershell
Set-Location C:\Users\Glare\Documents\Projects\Pocket-Tools
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
Set-Location .\apps\mobile\android
```

Close Android Studio, Gradle daemons, Explorer windows, terminals, or other processes holding `apps/mobile/android` when clean prebuild reports `EBUSY`.

## Build APKs

From `apps/mobile/android`:

```powershell
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
```

Outputs:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Install an APK on the connected device:

```powershell
adb install -r .\app\build\outputs\apk\release\app-release.apk
```

Use the debug path instead when installing the debug artifact.

The release APK is not a distribution-ready artifact until the intended private signing configuration is applied.

## ARM64 target

The Expo config plugin writes:

```properties
reactNativeArchitectures=arm64-v8a
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
```

Debug and release builds omit ARMv7 and x86/x86_64 native binaries. Release builds additionally use R8 and resource shrinking.

Confirm device support:

```powershell
adb shell getprop ro.product.cpu.abilist
```

The result must include `arm64-v8a`.

Confirm packaged native libraries:

```powershell
jar tf .\app\build\outputs\apk\release\app-release.apk |
  Select-String '^lib/'
```

Every native library path should begin with `lib/arm64-v8a/`.

## Connected Android tests

With a device connected:

```bash
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

On PowerShell use `.\gradlew.bat`.

Connected validation covers SDK-version compatibility, sandbox limits, module isolation, runtime protocol, UI and operation validation, transactional storage, notification scheduling and recovery, declaration/runtime parity, and native integration.

## Ordinary tool workflow

1. Choose **Add tool**.
2. Paste an SDK 1.0, 1.1, or 1.2 JavaScript module.
3. Choose **Check**.
4. Choose **Preview**.
5. Exercise representative state, actions, output, and notifications.
6. Choose **Install tool**.

Editing uses an isolated clone of retained ordinary state. Candidate notification operations remain preview-only. Source changes only after isolated first render and the retained-state render gate succeed.

Open an installed tool and choose **Manage** for edit, rollback, duplicate, export, backup, notification settings, and removal. Open **Settings** for complete backup/restore, global notification status, and diagnostics.

See:

- [Installed Mini-App Lifecycle](../../docs/INSTALLED_MINI_APPS.md)
- [SDK 1.2 Notifications](../../docs/SDK_1_2_NOTIFICATIONS.md)
- [Release and Ordinary Tool Acceptance](../../docs/ORDINARY_SCRIPT_ACCEPTANCE.md)

## Diagnostics

Open **Settings → Advanced → Diagnostics**.

Run the isolation/recovery suite and the two-launch force-stop timer procedure. For the process-death boundary:

```bash
adb shell am force-stop com.darbyjack.pockettools
adb shell pidof com.darbyjack.pockettools
```

The second command must print no PID before reopening Pocket Tools.

See [Lifecycle and Namespace Diagnostics](../../docs/LIFECYCLE_DIAGNOSTICS.md).

## Reset development data

After an intentional pre-release host schema change, clear local development data:

```bash
adb shell pm clear com.darbyjack.pockettools
```

This is a development command, not part of mini-app update, rollback, backup, or restore behavior.
