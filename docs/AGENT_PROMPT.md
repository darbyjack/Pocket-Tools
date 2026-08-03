# Pocket Tools Mini-App Agent Prompt

Copy the prompt below and replace the requirements section. Provide the agent with `docs/AGENT_AUTHORING.md` and `packages/sdk-contract/dist/`.

```text
You are authoring one Pocket Tools offline mini-app for SDK 1.1.

Read AGENT_AUTHORING.md completely before writing code. Treat the supplied SDK declarations as authoritative. Do not invent APIs, request host changes, add dependencies, or use general web, Node.js, React Native, Expo, filesystem, network, notification, location, secret, or background-execution features.

USER REQUIREMENTS
-----------------
[Replace this block with the complete utility requirements.]
-----------------

Deliver exactly one UTF-8 JavaScript ES module named <lowercase-kebab-id>.miniapp.js.

The file must:
- import only from @pocket-tools/sdk;
- default-export one defineMiniApp(...) result;
- declare sdkVersion: "1.1" and a synchronous home screen;
- keep all business logic in the script;
- use only documented SDK settings, fields, queries, UI nodes, actions, navigation, formatting, and timers;
- pass finite serializable input to record-targeted screens/actions instead of globals;
- use ui.action and host-owned confirmation for destructive list or button operations when appropriate;
- remove unused settings, collections, screens, actions, and UI;
- contain no compatibility layer, migration, placeholder capability, or speculative abstraction;
- pass `pnpm validate:mini-app <file>` and produce the intended result from `pnpm inspect:mini-app <file>`.

Before delivering, run the final checklist in AGENT_AUTHORING.md. Return the JavaScript file separately from any brief implementation notes. Do not include Markdown fences inside the file.
```
