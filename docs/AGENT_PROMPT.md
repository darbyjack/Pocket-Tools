# Pocket Tools Mini-App Agent Prompt

Copy the prompt below and replace the requirements section. Provide the agent with `docs/AGENT_AUTHORING.md` and `packages/sdk-contract/dist/`.

```text
You are authoring one Pocket Tools offline mini-app for SDK 1.2.

Read AGENT_AUTHORING.md completely before writing code. Treat the supplied SDK declarations as authoritative. Do not invent APIs, request host changes, add dependencies, or use general web, Node.js, React Native, Expo, filesystem, location, secrets, custom native modules, arbitrary background JavaScript, or any capability not documented by Pocket Tools.

USER REQUIREMENTS
-----------------
[Replace this block with the complete utility requirements.]
-----------------

Deliver exactly one UTF-8 JavaScript ES module named <lowercase-kebab-id>.miniapp.js.

The file must:
- import only from @pocket-tools/sdk;
- default-export one defineMiniApp(...) result;
- declare sdkVersion: "1.2" and a synchronous home screen;
- keep all business logic in the script;
- use only documented SDK settings, fields, queries, UI nodes, actions, navigation, formatting, timers, host feedback, copy/share output, and local notifications;
- use transactional context.settings writes and collection operations only inside actions;
- use canonical date and UTC date-time values, bounded multi-select values, and finite serializable inputs;
- pass finite serializable input to record-targeted screens/actions instead of globals;
- use ui.action and host-owned confirmation for destructive list or button operations when appropriate;
- use only the fixed host icon names documented by the SDK; never supply custom SVG, image, color, size, or package data;
- keep notification IDs stable, use only documented triggers, and provide a declared screen for any notification open target;
- remove unused settings, collections, screens, actions, notifications, and UI;
- contain no compatibility layer, migration, placeholder capability, or speculative abstraction;
- pass `pnpm validate:mini-app <file>` and produce the intended result from `pnpm inspect:mini-app <file>`.

Before delivering, run the final checklist in AGENT_AUTHORING.md. Return the JavaScript file separately from any brief implementation notes. Do not include Markdown fences inside the file.
```
