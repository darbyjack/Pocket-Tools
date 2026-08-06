# Support

Pocket Tools is maintained on a best-effort basis. There is no guaranteed response time, resolution time, or service-level agreement.

## Supported application version

The latest stable Pocket Tools release is the supported host version. Before `v1.0.0`, help for the current public prerelease is best effort.

Users may be asked to update to the latest supported release before troubleshooting continues.

Official releases are distributed as ABI-specific APKs through GitHub Releases. Android devices and ABIs outside the published support matrix receive best-effort help only.

## Compatibility commitments

Current host releases continue to honor the documented compatibility boundaries for:

- released mini-app SDK 1.0, 1.1, and 1.2 scripts;
- supported database migrations;
- supported portable and complete-host backup formats;
- the canonical Android application identity and release-signing lineage.

Compatibility does not extend to unpublished internal APIs, modified APKs, unofficial builds, or behavior that a third-party mini-app implements outside the public SDK contract.

## Where to ask

Use GitHub Discussions for:

- setup and usage questions;
- mini-app authoring help;
- ideas that have not been accepted as project work;
- community examples and general conversation.

Use a GitHub Issue form only for reproducible or actionable work:

- confirmed bugs;
- accepted feature work;
- SDK proposals;
- documentation defects;
- scoped maintenance tasks.

Do not use public support channels for vulnerabilities. Follow [SECURITY.md](SECURITY.md).

## What to include

A useful support request normally includes:

- Pocket Tools version and APK ABI;
- Android version and device model;
- whether the installation is official and unmodified;
- the affected mini-app and SDK version;
- exact reproduction steps;
- expected and actual behavior;
- relevant logs with secrets and personal data removed.

## Project boundaries

Pocket Tools does not promise support for:

- modified, re-signed, or unofficial APKs;
- Play Store or other app-store distribution;
- iOS, desktop, or web hosts;
- arbitrary native extensions or unpublished SDK behavior;
- remote mini-app marketplaces, accounts, cloud sync, or remote push;
- third-party mini-app correctness outside the public SDK contract.
