# AGENTS.md

- Do not preserve obsolete, unreleased implementation paths merely for internal compatibility. Remove superseded internal code and documentation rather than adding speculative aliases, fallbacks, or compatibility layers.
- Preserve every released public compatibility boundary: supported mini-app SDK contracts, user-owned SQLite data, published backup formats, the Android application identity and signing lineage, and documented stable behavior. Changes to those boundaries require explicit versioning, migrations, fixtures, tests, and release documentation.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
