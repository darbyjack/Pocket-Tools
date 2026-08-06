# Governance

Pocket Tools uses a maintainer-led governance model. This document describes the current operating model honestly; it does not claim a foundation, steering committee, or voting system that does not exist.

## Lead maintainer

`darbyjack` is the initial lead maintainer and final decision-maker.

The lead maintainer is responsible for:

- setting and prioritizing the roadmap;
- reviewing and merging changes;
- protecting compatibility and security boundaries;
- maintaining release and signing integrity;
- coordinating vulnerability response;
- keeping public policy and documentation accurate;
- appointing or removing maintainers when needed.

## Project decisions

Architecture, public SDK, compatibility, security, release, and governance decisions should be recorded in public issues, pull requests, or architecture decision records rather than private messages.

The lead maintainer may make the final decision after considering technical evidence, user impact, compatibility obligations, security risk, maintenance cost, and contributor feedback.

Not every proposal will be accepted. Silence, discussion, or a draft implementation does not create a project commitment.

## Contributors

Anyone may contribute under [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

Contributors do not gain merge, release, or roadmap authority solely by submitting changes. Attribution and authorship are respected independently of project authority.

## Adding maintainers

A maintainer may be invited after demonstrating:

- sustained constructive contributions;
- sound security and compatibility judgment;
- reliable, respectful review behavior;
- care for documentation and user impact;
- willingness to accept the responsibilities in this document.

There is no fixed contribution count or automatic promotion threshold.

A new maintainer must explicitly accept the role. Their scope may be limited to particular areas before broader authority is granted.

## Maintainer responsibilities

Maintainers are expected to:

- follow the same review, evidence, security, and conduct standards applied to contributors;
- disclose material conflicts of interest;
- protect private vulnerability and signing information;
- preserve released compatibility promises;
- document decisions and emergency actions;
- avoid using project authority for personal disputes or undisclosed commercial interests.

When another qualified maintainer is available, a maintainer with a material conflict should recuse from the affected decision or request independent review.

## Inactivity, removal, and succession

A maintainer may step down at any time.

Maintainer access may be reduced or removed for prolonged inactivity, repeated failure to meet responsibilities, security risk, abuse of authority, or serious Code of Conduct violations. The reason should be documented publicly unless privacy or security requires a limited record.

If the lead maintainer plans to leave, they should identify a qualified successor and transfer repository, release, signing, and security responsibilities through a documented process. If no successor is available, the project may enter maintenance-only or archived status rather than imply unsupported continuity.

## Merge and release authority

Changes normally enter `main` through a pull request with required evidence and resolved discussion.

The repository is intended to use squash-only merging and automatic branch deletion after public-cutover settings are applied. While only one maintainer is active, an approving review is not required because self-approval would not provide independent oversight. Once another active maintainer exists, repository rules may require approval and code-owner review.

Official releases require the documented release and acceptance gates. Maintainer status alone does not permit bypassing signature, checksum, SBOM, compatibility, or exact-asset acceptance requirements.

## Emergencies and bypasses

Bypass is reserved for urgent security remediation, repository recovery, or broken required infrastructure. It is not an ordinary convenience.

Where repository rules permit bypass, the change should still use a pull request so an audit trail remains. The reason must be documented, skipped checks must run as soon as practical, and the change must receive retrospective review.

Force pushes to `main` and reuse or movement of published release tags are prohibited.

## Changes to governance

Governance changes require a public issue and pull request. The lead maintainer makes the final decision under the current model.

If the project later gains enough independent maintainers to need a committee or voting process, that structure must be proposed and documented before it is claimed.
