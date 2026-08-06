export const siteUrl = "https://darbyjack.github.io";
export const siteBase = "/Pocket-Tools";
export const repositoryUrl = "https://github.com/darbyjack/Pocket-Tools";
export const repositoryEditBase = `${repositoryUrl}/edit/main`;

export const groups = [
  { id: "start", label: "Start", order: 10 },
  { id: "authoring", label: "Author mini-apps", order: 20 },
  { id: "sdk", label: "SDK", order: 30 },
  { id: "host", label: "Host behavior", order: 40 },
  { id: "development", label: "Development", order: 50 },
  { id: "project", label: "Project", order: 60 },
];

export const pages = [
  {
    source: "README.md",
    slug: "",
    title: "Pocket Tools",
    description:
      "An Android-first host for secure, offline JavaScript mini-apps with native UI and host-owned data.",
    group: "start",
    order: 10,
    output: "index.mdx",
    template: "splash",
    landing: true,
  },
  {
    source: "docs/INSTALLATION.md",
    slug: "install",
    title: "Install Pocket Tools",
    description:
      "Choose the correct Android APK, verify it, install it, and preserve your local data when updating.",
    group: "start",
    order: 20,
  },
  {
    source: "docs/RELEASE_VERIFICATION.md",
    slug: "install/verify",
    title: "Verify a release",
    description:
      "Verify Pocket Tools checksums, package identity, supported ABI, and signing certificate before installation.",
    group: "start",
    order: 30,
  },
  {
    source: "docs/README.md",
    slug: "documentation",
    title: "Documentation map",
    description:
      "Find canonical documentation for users, mini-app authors, contributors, SDK consumers, and maintainers.",
    group: "start",
    order: 40,
  },
  {
    source: "docs/AGENT_AUTHORING.md",
    slug: "authoring",
    title: "Authoring guide",
    description:
      "Build, validate, preview, and install a Pocket Tools mini-app against the released SDK 1.2 contract.",
    group: "authoring",
    order: 10,
  },
  {
    source: "docs/AGENT_PROMPT.md",
    slug: "authoring/agent-prompt",
    title: "Canonical agent prompt",
    description:
      "Delegate creation of one Pocket Tools mini-app while preserving the released SDK and security boundaries.",
    group: "authoring",
    order: 20,
  },
  {
    source: "docs/AUTHORING_ERRORS.md",
    slug: "authoring/errors",
    title: "Validation and error reference",
    description:
      "Understand stable authoring, validation, QuickJS, and Android error names.",
    group: "authoring",
    order: 30,
  },
  {
    source: null,
    generator: "examples",
    slug: "authoring/examples",
    title: "Examples and fixtures",
    description:
      "Review executable compatibility examples and the canonical SDK 1.2 authoring fixtures.",
    group: "authoring",
    order: 40,
  },
  {
    source: "docs/SDK_OVERVIEW.md",
    slug: "sdk",
    title: "SDK overview and compatibility",
    description:
      "Understand the supported SDK versions, capability model, and compatibility boundaries.",
    group: "sdk",
    order: 10,
  },
  {
    source: null,
    generator: "sdk-landing",
    slug: "sdk/1.2",
    title: "SDK 1.2",
    description:
      "Navigate the current released Pocket Tools SDK contract and focused capability references.",
    group: "sdk",
    order: 20,
  },
  {
    source: "docs/SDK_1_2_CONTRACT.md",
    slug: "sdk/1.2/contract",
    title: "SDK 1.2 contract",
    description:
      "The complete normative Pocket Tools SDK 1.2 contract and compatibility boundary.",
    group: "sdk",
    order: 30,
  },
  {
    source: "docs/SDK_1_2_DATA_AND_SETTINGS.md",
    slug: "sdk/1.2/data-and-settings",
    title: "Data and settings",
    description:
      "Use settings, collection records, dates, multi-select values, queries, and aggregates.",
    group: "sdk",
    order: 40,
  },
  {
    source: "docs/SDK_1_2_UI_AND_OUTPUT.md",
    slug: "sdk/1.2/ui-and-output",
    title: "UI and output",
    description:
      "Return host-rendered native controls, rows, badges, progress, feedback, copy, and share output.",
    group: "sdk",
    order: 50,
  },
  {
    source: "docs/SDK_1_2_NOTIFICATIONS.md",
    slug: "sdk/1.2/notifications",
    title: "Notifications",
    description:
      "Declare tool-scoped notification intent while Android owns permission, scheduling, and delivery.",
    group: "sdk",
    order: 60,
  },
  {
    source: null,
    generator: "sdk-reference",
    slug: "sdk/reference/declarations",
    title: "Generated declaration reference",
    description:
      "Read the released TypeScript declarations with their canonical source paths and content hashes.",
    group: "sdk",
    order: 70,
  },
  {
    source: "docs/SECURITY_MODEL.md",
    slug: "sdk/security-boundaries",
    title: "SDK security boundaries",
    description:
      "Understand sandbox limits, host authority, validation boundaries, and deliberate exclusions.",
    group: "sdk",
    order: 80,
  },
  {
    source: "docs/ARCHITECTURE.md",
    slug: "architecture",
    title: "Architecture",
    description:
      "Follow the trusted execution path across source validation, QuickJS, native UI, storage, and Android services.",
    group: "host",
    order: 10,
  },
  {
    source: "docs/INSTALLED_MINI_APPS.md",
    slug: "host/installed-mini-apps",
    title: "Installed mini-app lifecycle",
    description:
      "Understand preview, installation, updates, rollback, duplication, export, and removal.",
    group: "host",
    order: 20,
  },
  {
    source: null,
    generator: "backups-landing",
    slug: "backups",
    title: "Backups and restore",
    description:
      "Choose between portable one-tool backups and complete-host backups.",
    group: "host",
    order: 30,
  },
  {
    source: "docs/PORTABLE_BACKUPS.md",
    slug: "backups/portable",
    title: "Portable tool backups",
    description:
      "Export and restore one tool with its portable settings, records, timers, and notification intent.",
    group: "host",
    order: 40,
  },
  {
    source: "docs/HOST_BACKUPS.md",
    slug: "backups/complete-host",
    title: "Complete-host backups",
    description:
      "Back up and atomically restore all user-owned Pocket Tools state.",
    group: "host",
    order: 50,
  },
  {
    source: "docs/LIFECYCLE_DIAGNOSTICS.md",
    slug: "host/diagnostics",
    title: "Diagnostics and recovery",
    description:
      "Run repeatable namespace, notification, timer, process-death, and recovery checks.",
    group: "host",
    order: 60,
  },
  {
    source: "CONTRIBUTING.md",
    slug: "development/contributing",
    title: "Contributing",
    description:
      "Prepare focused changes, preserve compatibility, provide provenance, and run the required checks.",
    group: "development",
    order: 10,
  },
  {
    source: "apps/mobile/README.md",
    slug: "development/android",
    title: "Android development",
    description:
      "Set up Expo SDK 57, build ABI-specific APKs, and run connected Android validation.",
    group: "development",
    order: 20,
  },
  {
    source: "docs/ORDINARY_SCRIPT_ACCEPTANCE.md",
    slug: "development/releases",
    title: "Release and acceptance procedure",
    description:
      "Run repository, Android, compatibility, accessibility, and ordinary-tool release acceptance.",
    group: "development",
    order: 30,
  },
  {
    source: "docs/RELEASE_ACCEPTANCE_CHECKLIST.md",
    slug: "development/release-checklist",
    title: "Draft release acceptance checklist",
    description:
      "Apply the exact-byte device, emulator, notification, accessibility, and blocker review checklist.",
    group: "development",
    order: 40,
  },
  {
    source: "CHANGELOG.md",
    slug: "project/changelog",
    title: "Changelog",
    description: "Review user-visible Pocket Tools changes by release.",
    group: "project",
    order: 10,
  },
  {
    source: "PRIVACY.md",
    slug: "project/privacy",
    title: "Privacy",
    description:
      "Understand Pocket Tools' offline-first data handling and deliberate absence of telemetry and cloud accounts.",
    group: "project",
    order: 20,
  },
  {
    source: "SECURITY.md",
    slug: "project/security",
    title: "Security",
    description:
      "Review supported security reporting channels and disclosure expectations.",
    group: "project",
    order: 30,
  },
  {
    source: "SUPPORT.md",
    slug: "project/support",
    title: "Support",
    description:
      "Find the supported release boundary and the right place to ask for help.",
    group: "project",
    order: 40,
  },
  {
    source: "GOVERNANCE.md",
    slug: "project/governance",
    title: "Governance",
    description:
      "Understand maintainership, decisions, conflicts, releases, succession, and emergency changes.",
    group: "project",
    order: 50,
  },
  {
    source: "CODE_OF_CONDUCT.md",
    slug: "project/code-of-conduct",
    title: "Code of conduct",
    description:
      "Review the community behavior and enforcement expectations for Pocket Tools spaces.",
    group: "project",
    order: 60,
  },
  {
    source: "LICENSE",
    slug: "project/license",
    title: "Apache License 2.0",
    description:
      "Read the license governing Pocket Tools first-party source, documentation, examples, and project assets.",
    group: "project",
    order: 70,
    extractTitle: false,
  },
  {
    source: "THIRD_PARTY_NOTICES.md",
    slug: "project/third-party-notices",
    title: "Third-party notices",
    description:
      "Review required attributions and license texts for redistributed third-party components and assets.",
    group: "project",
    order: 80,
  },
  {
    source: "docs/LICENSING.md",
    slug: "project/licensing",
    title: "Licensing operations",
    description:
      "Maintain dependency inventories, reviewed overrides, legal notices, provenance, and the SPDX SBOM.",
    group: "project",
    order: 90,
  },
  {
    source: "ASSET_PROVENANCE.md",
    slug: "project/asset-provenance",
    title: "Asset provenance",
    description:
      "Review the origin and redistribution authorization for first-party and generated assets.",
    group: "project",
    order: 100,
  },
];

export const sourceLinkRoutes = {
  examples: "authoring/examples",
  "examples/": "authoring/examples",
  "docs/fixtures": "authoring/examples",
  "docs/fixtures/": "authoring/examples",
  "packages/sdk-contract/dist": "sdk/reference/declarations",
  "packages/sdk-contract/dist/": "sdk/reference/declarations",
  "packages/sdk-contract/src": "sdk/reference/declarations",
  "packages/sdk-contract/src/": "sdk/reference/declarations",
};

export const sourceLinkExternal = {
  "AGENTS.md": `${repositoryUrl}/blob/main/AGENTS.md`,
};

export function sitePath(slug = "") {
  const normalized = slug.replace(/^\/+|\/+$/g, "");
  return normalized ? `${siteBase}/${normalized}/` : `${siteBase}/`;
}

export function routeForSource(source) {
  return pages.find((page) => page.source === source)?.slug;
}

export function sidebarItems() {
  return [...groups]
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      label: group.label,
      items: pages
        .filter((page) => page.group === group.id)
        .sort((left, right) => left.order - right.order)
        .map((page) =>
          page.slug === ""
            ? { label: "Overview", link: "/" }
            : { label: page.title, slug: page.slug },
        ),
    }));
}
