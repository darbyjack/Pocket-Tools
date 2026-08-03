import type {
  CollectionDefinition,
  MetricNode,
  MiniAppManifest,
  PageNode,
  SerializableValue,
  SettingDefinition,
  StoredRecord,
  TimerSnapshot,
  UiNode,
} from "@pocket-tools/sdk-contract";

export type {
  CollectionDefinition,
  MetricNode,
  PageNode,
  SerializableValue,
  SettingDefinition,
  StoredRecord,
  TimerSnapshot,
  UiNode,
} from "@pocket-tools/sdk-contract";

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
  readonly action?: string;
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

export interface TimerStartOperation {
  readonly type: "timer-start";
  readonly timerId: string;
  readonly startedAt: string;
}

export interface TimerStopOperation {
  readonly type: "timer-stop";
  readonly timerId: string;
}

export type RuntimeOperation =
  | InsertOperation
  | UpdateOperation
  | RemoveOperation
  | TimerStartOperation
  | TimerStopOperation;

export interface RuntimeValue {
  readonly inspection?: MiniAppInspection;
  readonly page?: PageNode;
  readonly operations: readonly RuntimeOperation[];
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
