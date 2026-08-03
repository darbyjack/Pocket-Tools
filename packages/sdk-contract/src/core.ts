import type { CollectionDefinition, DataClient } from "./data.ts";
import type { FileClient } from "./files.ts";
import type { PermissionDeclaration } from "./permissions.ts";
import type { SettingDefinition, SettingsClient } from "./settings.ts";
import type { TimerClient } from "./timers.ts";
import type { PageNode } from "./ui.ts";
import type { SerializableValue } from "./values.ts";

export const SDK_VERSION = 1 as const;

export const DEFAULT_RUNTIME_LIMITS = {
  memoryBytes: 32 * 1024 * 1024,
  absoluteMemoryBytes: 64 * 1024 * 1024,
  stackBytes: 512 * 1024,
  invocationMilliseconds: 250,
  sourceBytes: 512 * 1024,
  resultBytes: 1024 * 1024,
  logEntriesPerInvocation: 100,
  uiTreeDepth: 32,
  uiNodeCount: 1_000,
} as const;

export interface MiniAppManifest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sdkVersion: typeof SDK_VERSION;
  readonly version: number;
  readonly permissions?: readonly PermissionDeclaration[];
}

export interface MiniAppContext {
  readonly settings: SettingsClient;
  readonly data: DataClient;
  readonly files: FileClient;
  readonly timers: TimerClient;
  readonly now: () => string;
  readonly screenParams: SerializableValue;
}

export type ScreenRenderer = (context: MiniAppContext) => PageNode;

export type ActionHandler = (
  context: MiniAppContext,
  payload: SerializableValue,
) => SerializableValue | void | Promise<SerializableValue | void>;

export interface MigrationContext {
  readonly data: DataClient;
  readonly settings: SettingsClient;
  readonly fromVersion: number;
  readonly toVersion: number;
}

export type MigrationHandler = (context: MigrationContext) => void;

export interface MiniAppTestContext {
  readonly render: (screen: string, params?: SerializableValue) => PageNode;
  readonly invoke: (action: string, payload?: SerializableValue) => Promise<SerializableValue | void>;
  readonly setSetting: (name: string, value: SerializableValue) => void;
  readonly advanceTime: (seconds: number) => void;
}

export interface MiniAppEmbeddedTest {
  readonly name: string;
  readonly run: (context: MiniAppTestContext) => void | Promise<void>;
}

export interface MiniAppDefinition {
  readonly manifest: MiniAppManifest;
  readonly settings?: Readonly<Record<string, SettingDefinition>>;
  readonly collections?: Readonly<Record<string, CollectionDefinition>>;
  readonly screens: Readonly<Record<string, ScreenRenderer>>;
  readonly actions?: Readonly<Record<string, ActionHandler>>;
  readonly migrations?: Readonly<Record<number, MigrationHandler>>;
  readonly tests?: readonly MiniAppEmbeddedTest[];
}

export function defineMiniApp<const TDefinition extends MiniAppDefinition>(
  definition: TDefinition,
): TDefinition {
  return definition;
}
