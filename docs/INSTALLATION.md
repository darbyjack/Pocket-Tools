# Install Pocket Tools

Pocket Tools is distributed as Android APK files through GitHub Releases. It is not distributed through Google Play. During private development, release assets may not be publicly available; contributors can build and install the app by following the [Android development guide](../apps/mobile/README.md).

## Requirements

- Android 7.0 / API 24 or newer
- enough free storage for the APK and local tool data
- an APK matching one of the device's supported ABIs
- permission to install an app from the chosen file manager, browser, or Android Debug Bridge

Pocket Tools keeps installed tools, settings, records, timers, backups, and notification intent on the device. Review the [privacy policy](../PRIVACY.md) before installation.

## Choose the correct APK

Pocket Tools release builds support four Android ABIs:

| ABI | Typical target |
| --- | --- |
| `arm64-v8a` | Most current Android phones and tablets |
| `armeabi-v7a` | Older 32-bit ARM devices |
| `x86_64` | Most current Android emulators and uncommon Intel devices |
| `x86` | Legacy 32-bit Android emulators |

On a connected device, list the supported ABIs with:

```powershell
adb shell getprop ro.product.cpu.abilist
```

Choose the first Pocket Tools release ABI that appears in the device's list. Do not install an APK for a different ABI merely because its file is smaller.

## Download the release

1. Open the project's GitHub Releases page.
2. Select the intended release tag.
3. Read the release notes, supported Android version, compatibility notes, and known issues.
4. Download the APK for the correct ABI.
5. Download the accompanying checksum and release metadata files.
6. [Verify the downloaded release](RELEASE_VERIFICATION.md) before installation.

Keep the APK, checksum file, and release metadata from the same release. Do not mix assets from different tags.

## Install on the device

To install through Android, open the verified APK and approve installation from the selected source when prompted.

To install through Android Debug Bridge:

```powershell
adb install .\Pocket-Tools-<version>-<abi>.apk
```

The final release file names are defined by the release metadata. Use the exact downloaded name rather than renaming assets before verification.

## Update an existing installation

Create a complete-host backup before a significant update. Then install the newer verified APK over the existing application:

```powershell
adb install -r .\Pocket-Tools-<version>-<abi>.apk
```

An accepted update must preserve the package identity, signing lineage, database compatibility, installed tools, settings, records, timers, and backup compatibility promised by that release.

If Android reports a signature mismatch, do not uninstall the existing app to force the update. Recheck that the APK came from the official release and matches the documented signing certificate.

## Uninstall

Uninstalling Pocket Tools removes the application and its device-local application data. Export any portable tool backups and a complete-host backup that you may need before uninstalling.

```powershell
adb uninstall com.darbyjack.pockettools
```

A backup file stored outside the app's private storage is not automatically deleted with the application, but it should still be copied to a safe location before removal.

## Troubleshooting

Use the [support policy](../SUPPORT.md) to choose the correct public support route. Report suspected vulnerabilities privately according to the [security policy](../SECURITY.md). Do not publish signing, sandbox, or data-exposure details in a public issue before maintainers have assessed them.
