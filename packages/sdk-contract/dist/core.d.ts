import type { CollectionDefinition, DataClient } from "./data.js";
import type { SettingDefinition, SettingsClient } from "./settings.js";
import type { TimerClient } from "./timers.js";
import type { PageNode } from "./ui.js";
import type { SerializableValue } from "./values.js";
export declare const SDK_VERSION: "1.1";
export declare const SUPPORTED_SDK_VERSIONS: readonly ["1.0", "1.1"];
export type SdkVersion = (typeof SUPPORTED_SDK_VERSIONS)[number];
export declare function normalizeSdkVersion(value: unknown): SdkVersion | null;
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
    readonly now: () => string;
}
export type ScreenRenderer = (context: MiniAppContext, input: SerializableValue | undefined) => PageNode;
export type ActionHandler = (context: MiniAppContext, input: SerializableValue | undefined) => void;
export interface MiniAppDefinition {
    readonly manifest: MiniAppManifest;
    readonly settings?: Readonly<Record<string, SettingDefinition>>;
    readonly collections?: Readonly<Record<string, CollectionDefinition>>;
    readonly screens: Readonly<Record<string, ScreenRenderer>>;
    readonly actions?: Readonly<Record<string, ActionHandler>>;
}
export declare function defineMiniApp<const TDefinition extends MiniAppDefinition>(definition: TDefinition): TDefinition;
