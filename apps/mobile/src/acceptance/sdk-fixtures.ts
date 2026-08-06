export const SDK_ACCEPTANCE_FIXTURE_SCHEMA_VERSION = 1;

export const SDK_ACCEPTANCE_CAPABILITIES = [
  "install",
  "update",
  "rollback",
  "quickjs",
  "settings",
  "records",
  "timers",
  "output",
  "ui",
  "notifications",
] as const;

export type SdkAcceptanceCapability = (typeof SDK_ACCEPTANCE_CAPABILITIES)[number];
export type PublicSdkVersion = "1.0" | "1.1" | "1.2";

export interface SdkAcceptanceFixture {
  readonly id: string;
  readonly name: string;
  readonly sourcePath: string;
  readonly sdkVersion: PublicSdkVersion;
  readonly mandatory: boolean;
  readonly capabilities: readonly SdkAcceptanceCapability[];
  readonly minimumSettings: number;
  readonly minimumCollections: number;
  readonly minimumScreens: number;
  readonly minimumActions: number;
}

export const SDK_ACCEPTANCE_FIXTURES: readonly SdkAcceptanceFixture[] = [
  {
    id: "tip-splitter",
    name: "Tip Splitter",
    sourcePath: "examples/tip-splitter.miniapp.js",
    sdkVersion: "1.0",
    mandatory: true,
    capabilities: ["install", "update", "rollback", "quickjs", "settings", "output", "ui"],
    minimumSettings: 3,
    minimumCollections: 0,
    minimumScreens: 1,
    minimumActions: 0,
  },
  {
    id: "bathroom-pay",
    name: "Bathroom Pay",
    sourcePath: "examples/bathroom-pay.miniapp.js",
    sdkVersion: "1.1",
    mandatory: true,
    capabilities: [
      "install",
      "update",
      "rollback",
      "quickjs",
      "settings",
      "records",
      "timers",
      "output",
      "ui",
    ],
    minimumSettings: 5,
    minimumCollections: 1,
    minimumScreens: 1,
    minimumActions: 1,
  },
  {
    id: "sdk12-acceptance",
    name: "SDK 1.2 Acceptance",
    sourcePath: "docs/fixtures/sdk12-agent-proof.miniapp.js",
    sdkVersion: "1.2",
    mandatory: true,
    capabilities: [
      "install",
      "update",
      "rollback",
      "quickjs",
      "settings",
      "records",
      "timers",
      "output",
      "ui",
      "notifications",
    ],
    minimumSettings: 5,
    minimumCollections: 1,
    minimumScreens: 1,
    minimumActions: 1,
  },
];

export function validateSdkAcceptanceFixtureCatalog(
  fixtures: readonly SdkAcceptanceFixture[] = SDK_ACCEPTANCE_FIXTURES,
): void {
  const ids = new Set<string>();
  const versions = new Set<PublicSdkVersion>();
  const capabilities = new Set<SdkAcceptanceCapability>();

  for (const fixture of fixtures) {
    if (ids.has(fixture.id)) {
      throw new Error(`ACCEPTANCE_FIXTURE_INVALID: duplicate fixture ID ${fixture.id}.`);
    }
    ids.add(fixture.id);
    versions.add(fixture.sdkVersion);

    if (!fixture.sourcePath.endsWith(".miniapp.js")) {
      throw new Error(
        `ACCEPTANCE_FIXTURE_INVALID: ${fixture.id} must reference a .miniapp.js source file.`,
      );
    }
    if (!fixture.mandatory) {
      throw new Error(`ACCEPTANCE_FIXTURE_INVALID: ${fixture.id} must be release-mandatory.`);
    }

    for (const capability of fixture.capabilities) capabilities.add(capability);
  }

  for (const version of ["1.0", "1.1", "1.2"] as const) {
    if (!versions.has(version)) {
      throw new Error(`ACCEPTANCE_FIXTURE_INVALID: SDK ${version} has no fixture.`);
    }
  }
  for (const capability of SDK_ACCEPTANCE_CAPABILITIES) {
    if (!capabilities.has(capability)) {
      throw new Error(
        `ACCEPTANCE_FIXTURE_INVALID: capability ${capability} has no fixture coverage.`,
      );
    }
  }
}
