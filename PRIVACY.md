# Privacy

_Last updated: August 6, 2026_

Pocket Tools is an offline-first Android application. The application is designed to keep tool data on the device and does not include telemetry, analytics, automatic crash upload, remote usage tracking, accounts, cloud synchronization, or an automatic update service.

## Data stored by the application

Pocket Tools may store the following data locally in application-managed storage:

- installed mini-app source and metadata;
- mini-app settings, records, and timers;
- desired local-notification schedules and related host state;
- application preferences and compatibility metadata.

This data is used only to provide the application's local features.

## Notifications and device permissions

Pocket Tools can request Android notification and exact-alarm access when a user enables a tool feature that needs local scheduling. Notification content and schedules are managed on the device. Pocket Tools does not provide remote push notifications.

Permission choices are controlled through Android settings. Denying a permission may limit the related feature without preventing unrelated tools from working.

## Backups, clipboard, and sharing

Backup export, copy, and share actions occur only when a user requests them.

- Exported backups may contain installed tool source and the local values represented by the selected backup format.
- Copied text is placed on the Android clipboard.
- Shared text or backup files are handed to the application selected by the user.

Once data leaves Pocket Tools through an export, clipboard, or share action, it is governed by the destination chosen by the user. Pocket Tools cannot delete or control copies held outside its application storage.

## Network activity and updates

Pocket Tools does not automatically check for, download, or install updates. Official updates are obtained manually from GitHub Releases.

Mini-apps running inside Pocket Tools do not receive arbitrary network access through the public SDK. A future feature that changes the application's data collection or network behavior requires an explicit public policy update before release.

## Deletion and retention

Users can remove individual tool data through supported application controls. Uninstalling Pocket Tools removes its application-managed data according to Android behavior.

Files exported or copied outside the application remain until the user deletes them from their destination.

## GitHub and project communication

When a user interacts with the Pocket Tools repository, GitHub Discussions, Issues, pull requests, or security reporting, GitHub processes account and request information under GitHub's own terms and privacy practices. The Pocket Tools application does not receive that information automatically.

## Changes to this policy

Material privacy changes will be documented in the repository and release notes before the affected release is published.

Questions about this policy belong in GitHub Discussions. Security-sensitive reports must follow [SECURITY.md](SECURITY.md).
