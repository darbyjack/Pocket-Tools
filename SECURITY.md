# Security Policy

## Supported versions

Pocket Tools provides security fixes for the latest stable application release.

Before the first stable `v1.0.0` release, the current published prerelease may receive best-effort security fixes. Older releases and unofficial builds are not generally supported unless a security advisory says otherwise.

Supported public SDK and backup compatibility are defined separately from the host application's security-support window. See [SUPPORT.md](SUPPORT.md) and the documented compatibility policy.

## Report a vulnerability privately

Do not open a public issue, discussion, or pull request for a suspected vulnerability.

After the repository becomes public, use GitHub's **Security → Report a vulnerability** flow:

https://github.com/darbyjack/Pocket-Tools/security/advisories/new

Include, when available:

- the affected Pocket Tools version and APK ABI;
- the source commit, release tag, or download asset;
- device and Android version;
- a clear description of the impact;
- reproduction steps or a proof of concept;
- whether the issue is already public;
- any suggested mitigation.

Avoid including unrelated personal data, secrets, or destructive test results.

## Response process

The maintainer will try to acknowledge a complete report within 7 calendar days. This is a best-effort target, not a response-time or resolution SLA.

Reports are triaged privately. Depending on the issue, the project may:

- request additional reproduction details;
- use a private security-advisory fork to prepare a fix;
- coordinate a disclosure date;
- publish a mitigation or corrected release;
- credit the reporter when requested and appropriate;
- request a CVE when severity and affected distribution justify one.

A public advisory is normally published after a fix or practical mitigation is available.

## Scope

Security reports may cover:

- the Pocket Tools Android host;
- the QuickJS runtime and script/host isolation boundary;
- public SDK validation or authority boundaries;
- database migrations and backup restoration;
- local notifications and deep-link routing;
- official release scripts, signatures, checksums, SBOMs, and APK integrity;
- repository automation that could affect official source or release artifacts.

Ordinary bugs, support questions, and feature requests should use the routes in [SUPPORT.md](SUPPORT.md).

## No bug bounty

Pocket Tools does not operate a bug-bounty program and does not promise payment or other compensation. Responsible reports are still appreciated.
