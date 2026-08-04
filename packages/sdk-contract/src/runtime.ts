import type { MiniAppManifest } from "./core.ts";
import type { CollectionDefinition, StoredRecord } from "./data.ts";
import type { SettingDefinition } from "./settings.ts";
import type { TimerSnapshot } from "./timers.ts";
import type { PageNode } from "./ui.ts";
import type { SerializableValue } from "./values.ts";

export interface FeedbackClient {
  show(message: string): void;
}

export interface OutputClient {
  copy(text: string): void;
  share(request: { readonly title?: string; readonly text: string }): void;
}

export interface NotificationOpenTarget {
  readonly screen: string;
  readonly input?: SerializableValue;
}

export type NotificationDelivery = "standard" | "exact";

export type NotificationTrigger =
  | { readonly type: "immediate" }
  | {
      readonly type: "date";
      readonly at: string;
      readonly delivery?: NotificationDelivery;
    }
  | {
      readonly type: "daily";
      readonly hour: number;
      readonly minute: number;
      readonly delivery?: NotificationDelivery;
    }
  | {
      readonly type: "weekly";
      readonly weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      readonly hour: number;
      readonly minute: number;
      readonly delivery?: NotificationDelivery;
    };

export interface NotificationRequest {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly trigger: NotificationTrigger;
  readonly open?: NotificationOpenTarget;
}

export interface NotificationClient {
  schedule(request: NotificationRequest): void;
  cancel(id: string): void;
  cancelAll(): void;
}

export interface MiniAppInspection {
  readonly manifest: MiniAppManifest;
  readonly settings: Readonly<Record<string, SettingDefinition>>;
  readonly collections: Readonly<Record<string, CollectionDefinition>>;
  readonly screens: readonly string[];
  readonly actions: readonly string[];
}

export interface RuntimeSnapshot {
  readonly mode: "inspect" | "render" | "action";
  readonly screen?: string;
  readonly screenInput?: SerializableValue;
  readonly action?: string;
  readonly actionInput?: SerializableValue;
  readonly now: string;
  readonly settings: Readonly<Record<string, SerializableValue>>;
  readonly records: Readonly<Record<string, readonly StoredRecord[]>>;
  readonly timers: Readonly<Record<string, TimerSnapshot>>;
}

export interface InsertOperation {
  readonly type: "insert";
  readonly collection: string;
  readonly record: Readonly<Record<string, SerializableValue>>;
}

export interface UpdateOperation {
  readonly type: "update";
  readonly collection: string;
  readonly id: string;
  readonly changes: Readonly<Record<string, SerializableValue>>;
}

export interface RemoveOperation {
  readonly type: "remove";
  readonly collection: string;
  readonly id: string;
}

export interface SettingSetOperation {
  readonly type: "setting-set";
  readonly setting: string;
  readonly value: SerializableValue;
}

export interface SettingResetOperation {
  readonly type: "setting-reset";
  readonly setting: string;
}

export interface TimerStartOperation {
  readonly type: "timer-start";
  readonly timerId: string;
  readonly startedAt: string;
}

export interface TimerStopOperation {
  readonly type: "timer-stop";
  readonly timerId: string;
}

export interface NotificationScheduleOperation {
  readonly type: "notification-schedule";
  readonly request: NotificationRequest;
}

export interface NotificationCancelOperation {
  readonly type: "notification-cancel";
  readonly notificationId: string;
}

export interface NotificationCancelAllOperation {
  readonly type: "notification-cancel-all";
}

export type RuntimeOperation =
  | InsertOperation
  | UpdateOperation
  | RemoveOperation
  | SettingSetOperation
  | SettingResetOperation
  | TimerStartOperation
  | TimerStopOperation
  | NotificationScheduleOperation
  | NotificationCancelOperation
  | NotificationCancelAllOperation;

export interface FeedbackEffect {
  readonly type: "feedback";
  readonly message: string;
}

export interface CopyEffect {
  readonly type: "copy";
  readonly text: string;
}

export interface ShareEffect {
  readonly type: "share";
  readonly title?: string;
  readonly text: string;
}

export type OutputEffect = CopyEffect | ShareEffect;
export type RuntimeEffect = FeedbackEffect | OutputEffect;

export interface RuntimeValue {
  readonly inspection?: MiniAppInspection;
  readonly page?: PageNode;
  readonly operations: readonly RuntimeOperation[];
  readonly effects?: readonly RuntimeEffect[];
}

export type RuntimeLogLevel = "log" | "info" | "warn" | "error";

export interface RuntimeLogEntry {
  readonly level: RuntimeLogLevel;
  readonly message: string;
}

interface RuntimeEnvelope {
  readonly logs: readonly RuntimeLogEntry[];
  readonly logsTruncated: boolean;
}

export interface RuntimeSuccess extends RuntimeEnvelope {
  readonly ok: true;
  readonly value: RuntimeValue;
}

export interface RuntimeFailure extends RuntimeEnvelope {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly stack?: string;
  };
}

export type RuntimeResponse = RuntimeSuccess | RuntimeFailure;
