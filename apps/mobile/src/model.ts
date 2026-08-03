export type SerializablePrimitive = string | number | boolean | null;
export type SerializableValue =
  | SerializablePrimitive
  | readonly SerializableValue[]
  | { readonly [key: string]: SerializableValue };

export interface VisibilityRule {
  readonly setting: string;
  readonly equals: SerializablePrimitive;
}

export interface NumberSettingDefinition {
  readonly type: "number";
  readonly label: string;
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly visibleWhen?: VisibilityRule;
}

export interface MoneySettingDefinition {
  readonly type: "money";
  readonly label: string;
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
  readonly visibleWhen?: VisibilityRule;
}

export interface SelectSettingDefinition {
  readonly type: "select";
  readonly label: string;
  readonly default: SerializablePrimitive;
  readonly options: readonly {
    readonly label: string;
    readonly value: SerializablePrimitive;
  }[];
  readonly visibleWhen?: VisibilityRule;
}

export type SettingDefinition =
  | NumberSettingDefinition
  | MoneySettingDefinition
  | SelectSettingDefinition;

export interface MiniAppManifest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sdkVersion: number;
}

export interface MiniAppInspection {
  readonly manifest: MiniAppManifest;
  readonly settings: Readonly<Record<string, SettingDefinition>>;
  readonly collections: Readonly<Record<string, unknown>>;
}

export interface TimerSnapshot {
  readonly id: string;
  readonly startedAt: string;
  readonly elapsedSeconds: number;
}

export interface StoredRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly [key: string]: SerializableValue;
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
  | TimerStartOperation
  | TimerStopOperation;

interface UiNodeBase<TType extends string> {
  readonly type: TType;
}

export interface PageNode extends UiNodeBase<"page"> {
  readonly title: string;
  readonly children: readonly UiNode[];
}

export interface SectionNode extends UiNodeBase<"section"> {
  readonly title?: string;
  readonly children: readonly UiNode[];
}

export interface MetricNode extends UiNodeBase<"metric"> {
  readonly label: string;
  readonly value: string | number;
  readonly format?: "plain" | "money" | "duration" | "number";
  readonly liveTimer?: {
    readonly timerId: string;
    readonly ratePerHour: number;
  };
}

export interface TimerNode extends UiNodeBase<"timer"> {
  readonly timerId: string;
  readonly emptyValue?: string;
}

export interface ButtonNode extends UiNodeBase<"button"> {
  readonly label: string;
  readonly action: string;
}

export interface EmptyStateNode extends UiNodeBase<"empty-state"> {
  readonly title: string;
  readonly description?: string;
}

export interface ListItemNode extends UiNodeBase<"list-item"> {
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: string;
}

export interface ListNode extends UiNodeBase<"list"> {
  readonly title?: string;
  readonly items: readonly ListItemNode[];
  readonly emptyState?: EmptyStateNode;
}

export interface SummaryNode extends UiNodeBase<"summary"> {
  readonly title: string;
  readonly values: readonly {
    readonly label: string;
    readonly value: string | number;
    readonly format?: "plain" | "money" | "duration" | "number";
  }[];
}

export type UiNode =
  | PageNode
  | SectionNode
  | MetricNode
  | TimerNode
  | ButtonNode
  | EmptyStateNode
  | ListItemNode
  | ListNode
  | SummaryNode;

export interface RuntimeValue {
  readonly inspection?: MiniAppInspection;
  readonly page?: PageNode;
  readonly operations: readonly RuntimeOperation[];
}

export interface RuntimeSuccess {
  readonly ok: true;
  readonly value: RuntimeValue;
}

export interface RuntimeFailure {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly stack?: string;
  };
}

export type RuntimeResponse = RuntimeSuccess | RuntimeFailure;
