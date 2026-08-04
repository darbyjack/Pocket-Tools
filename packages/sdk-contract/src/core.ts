import type { CollectionDefinition, DataClient } from "./data.ts";
import type { FeedbackClient, NotificationClient, OutputClient } from "./runtime.ts";
import type { SettingDefinition, SettingsClient } from "./settings.ts";
import type { TimerClient } from "./timers.ts";
import type { PageNode } from "./ui.ts";
import type { SerializableValue } from "./values.ts";

export const SDK_VERSION = "1.2" as const;
export const SUPPORTED_SDK_VERSIONS = ["1.0", "1.1", SDK_VERSION] as const;
export type SdkVersion = (typeof SUPPORTED_SDK_VERSIONS)[number];

export function normalizeSdkVersion(value: unknown): SdkVersion | null {
  if (value === 1) return "1.0";
  return typeof value === "string" && SUPPORTED_SDK_VERSIONS.includes(value as SdkVersion)
    ? (value as SdkVersion)
    : null;
}

export interface MiniAppManifest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sdkVersion: SdkVersion;
}

export interface MiniAppContext {
  readonly settings: SettingsClient;
  readonly data: DataClient;
  readonly timers: TimerClient;
  readonly notifications: NotificationClient;
  readonly output: OutputClient;
  readonly feedback: FeedbackClient;
  readonly now: () => string;
}

export type ScreenRenderer = (
  context: MiniAppContext,
  input: SerializableValue | undefined,
) => PageNode;

export type ActionHandler = (context: MiniAppContext, input: SerializableValue | undefined) => void;

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
