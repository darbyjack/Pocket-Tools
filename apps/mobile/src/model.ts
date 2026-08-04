import type {
  ActionConfirmation,
  ActionControl,
  ActionIntent,
  CollectionDefinition as PublicCollectionDefinition,
  ColumnNode as PublicColumnNode,
  FieldDefinition as PublicFieldDefinition,
  ListItemNode as PublicListItemNode,
  ListNode as PublicListNode,
  MetricNode,
  MiniAppManifest as PublicMiniAppManifest,
  PageNode as PublicPageNode,
  RowNode as PublicRowNode,
  SectionNode as PublicSectionNode,
  SerializableValue,
  SettingDefinition as PublicSettingDefinition,
  StoredRecord,
  TimerSnapshot,
  UiNode as PublicUiNode,
} from "@pocket-tools/sdk-contract";

export type {
  ActionConfirmation,
  ActionControl,
  ActionIntent,
  MetricNode,
  SerializableValue,
  StoredRecord,
  TimerSnapshot,
} from "@pocket-tools/sdk-contract";

interface DormantSdk12Definition {
  readonly hostSdkVersion?: "1.2";
}

export interface DateSetting extends DormantSdk12Definition {
  readonly type: "date";
  readonly label: string;
  readonly description?: string;
  readonly default: string;
  readonly visibleWhen?: PublicSettingDefinition["visibleWhen"];
  readonly min?: string;
  readonly max?: string;
}

export interface DateTimeSetting extends DormantSdk12Definition {
  readonly type: "datetime";
  readonly label: string;
  readonly description?: string;
  readonly default: string;
  readonly visibleWhen?: PublicSettingDefinition["visibleWhen"];
  readonly min?: string;
  readonly max?: string;
}

export type SettingDefinition = PublicSettingDefinition | DateSetting | DateTimeSetting;

export interface DateField extends DormantSdk12Definition {
  readonly type: "date";
  readonly optional?: boolean;
  readonly min?: string;
  readonly max?: string;
}

export interface DateTimeField extends DormantSdk12Definition {
  readonly type: "datetime";
  readonly optional?: boolean;
  readonly min?: string;
  readonly max?: string;
}

export type FieldDefinition =
  | Exclude<PublicFieldDefinition, { readonly type: "datetime" }>
  | DateField
  | DateTimeField;

export interface CollectionDefinition
  extends Omit<PublicCollectionDefinition, "fields"> {
  readonly fields: Readonly<Record<string, FieldDefinition>>;
}

export interface MiniAppManifest extends Omit<PublicMiniAppManifest, "sdkVersion"> {
  readonly sdkVersion: "1.0" | "1.1" | "1.2";
}

export interface DateInputNode {
  readonly type: "date-input";
  readonly setting: string;
  readonly label?: string;
}

export interface DateTimeInputNode {
  readonly type: "datetime-input";
  readonly setting: string;
  readonly label?: string;
}

export interface ListItemNode extends PublicListItemNode {
  readonly primaryAction?: ActionControl;
}

export interface ListNode extends Omit<PublicListNode, "items"> {
  readonly items: readonly ListItemNode[];
}

type PublicLeafUiNode = Exclude<
  PublicUiNode,
  | PublicPageNode
  | PublicSectionNode
  | PublicRowNode
  | PublicColumnNode
  | PublicListItemNode
  | PublicListNode
>;

export interface PageNode extends Omit<PublicPageNode, "children"> {
  readonly children: readonly UiNode[];
}

export interface SectionNode extends Omit<PublicSectionNode, "children"> {
  readonly children: readonly UiNode[];
}

export interface RowNode extends Omit<PublicRowNode, "children"> {
  readonly children: readonly UiNode[];
}

export interface ColumnNode extends Omit<PublicColumnNode, "children"> {
  readonly children: readonly UiNode[];
}

export type UiNode =
  | PageNode
  | SectionNode
  | RowNode
  | ColumnNode
  | PublicLeafUiNode
  | DateInputNode
  | DateTimeInputNode
  | ListItemNode
  | ListNode;

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

export type RuntimeOperation =
  | InsertOperation
  | UpdateOperation
  | RemoveOperation
  | SettingSetOperation
  | SettingResetOperation
  | TimerStartOperation
  | TimerStopOperation;

export interface FeedbackEffect {
  readonly type: "feedback";
  readonly message: string;
}

export type RuntimeEffect = FeedbackEffect;

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
