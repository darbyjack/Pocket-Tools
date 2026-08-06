# Asset Provenance

Every non-code asset added to Pocket Tools must have a recorded origin and redistribution basis before merge. This includes images, icons, fonts, sounds, sample data, copied documentation, and substantial copied snippets.

Project-authored assets are distributed under the Apache License 2.0 to the extent protectable rights exist. Third-party assets remain under their original licenses and must also appear in `THIRD_PARTY_NOTICES.md` when notice or attribution is required.

## Current first-party assets

| Path | Kind | Origin and authorization | Distribution terms |
| --- | --- | --- | --- |
| `apps/mobile/assets/icon.png` | Application icon | Generated for the Pocket Tools maintainer through OpenAI/ChatGPT. The maintainer confirms that it was created for this project and authorizes redistribution in the source repository and release APKs. | Project-owned AI-generated output; distributed under Apache-2.0 to the extent protectable rights exist. No claim is made that the output is unique or exclusively copyrightable in every jurisdiction. |
| Host UI layouts, colors, and source-created visual elements | First-party interface assets | Authored specifically for this repository by project contributors. | Apache-2.0. |
| Notification vector resources created by the project | First-party Android resources | Authored specifically for this repository by project contributors. | Apache-2.0. |
| Generated SDK declarations and synchronized bundled mini-app data | Generated project content | Deterministically generated from project-authored source definitions and examples. | Apache-2.0. |

## Required record for new assets

A contribution that introduces or replaces an asset must document:

1. the repository path;
2. the asset type and purpose;
3. the creator or upstream source;
4. whether it was authored, commissioned, generated, or copied;
5. the license or redistribution authorization;
6. any attribution, notice, font, model, or source-offer obligation;
7. whether the asset is packaged in the APK, source archive, documentation, or release artifacts.

Do not merge an asset with unknown provenance, unclear redistribution rights, or an unresolved attribution obligation. Generated inventories are supporting evidence; they do not replace a specific provenance record for project assets.
