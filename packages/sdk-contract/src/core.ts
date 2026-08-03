import type { CollectionDefinition, DataClient } from "./data.ts";
import type { SettingDefinition, SettingsClient } from "./settings.ts";
import type { TimerClient } from "./timers.ts";
import type { PageNode } from "./ui.ts";
import type { SerializableValue } from "./values.ts";

export const SDK_VERSION = 1 as const;

export interface MiniAppManifest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sdkVersion: typeof SDK_VERSION;
}

export interface MiniAppContext {
  readonly settings: SettingsClient;
  readonly data: DataClient;
  readonly timers: TimerClient;
  readonly now: () => string;
}

export type ScreenRenderer = (
  context: MiniAppContext,
  input: SerializableValue | undefined,
) => PageNode;

export type ActionHandler = (
  context: MiniAppContext,
  input: SerializableValue | undefined,
) => void;

export interface MiniAppDefinition {
  readonly manifest: MiniAppManifest;
  readonly settings?: Readonly<Record<string, SettingDefinition>>;
  readonly collections?: Readonly<Record<string, CollectionDefinition>>;
  readonly screens: Readonly<Record<string, ScreenRenderer>>;
  readonly actions?: Readonly<Record<string, ActionHandler>>;
}

export function defineMiniApp<const TDefinition extends MiniAppDefinition>(
  definition: TDefinition,
): TDefinition {
  return definition;
}
