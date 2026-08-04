import type { SerializableValue } from "./values.js";
export interface UiNodeBase<TType extends string> {
    readonly type: TType;
}
interface ChildrenNode<TType extends string> extends UiNodeBase<TType> {
    readonly children: readonly UiNode[];
}
export type DisplayFormat = "plain" | "money" | "duration" | "number";
export type ActionIntent = "default" | "destructive";
export type UiIconName = "add" | "edit" | "delete" | "check" | "calendar" | "clock" | "copy" | "share" | "search" | "settings" | "warning" | "info" | "money" | "list" | "refresh";
export interface ActionConfirmation {
    readonly title: string;
    readonly message?: string;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
}
export interface ActionControl {
    readonly label: string;
    readonly action: string;
    readonly input?: SerializableValue;
    readonly intent?: ActionIntent;
    readonly disabled?: boolean;
    readonly confirmation?: ActionConfirmation;
    readonly icon?: UiIconName;
}
export interface PageNode extends ChildrenNode<"page"> {
    readonly title: string;
}
export interface SectionNode extends ChildrenNode<"section"> {
    readonly title?: string;
}
export interface RowNode extends ChildrenNode<"row"> {
}
export interface ColumnNode extends ChildrenNode<"column"> {
}
export interface HeadingNode extends UiNodeBase<"heading"> {
    readonly text: string;
    readonly level?: 1 | 2 | 3;
}
export interface TextNode extends UiNodeBase<"text"> {
    readonly text: string;
}
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
export interface BadgeNode extends UiNodeBase<"badge"> {
    readonly text: string;
    readonly tone?: BadgeTone;
}
export type ProgressFormat = "number" | "percent";
export interface ProgressNode extends UiNodeBase<"progress"> {
    readonly label?: string;
    readonly value: number;
    readonly min?: number;
    readonly max?: number;
    readonly format?: ProgressFormat;
}
export interface MetricNode extends UiNodeBase<"metric"> {
    readonly label: string;
    readonly value: string | number;
    readonly format?: DisplayFormat;
    readonly liveTimer?: {
        readonly timerId: string;
        readonly ratePerHour: number;
    };
}
export interface TimerNode extends UiNodeBase<"timer"> {
    readonly timerId: string;
    readonly emptyValue?: string;
}
export interface SettingInputNode<TType extends string> extends UiNodeBase<TType> {
    readonly setting: string;
    readonly label?: string;
}
export interface TextInputNode extends SettingInputNode<"text-input"> {
    readonly placeholder?: string;
    readonly multiline?: boolean;
    readonly minLines?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
}
export type NumberInputDecimalPlaces = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export interface NumberInputNode extends SettingInputNode<"number-input"> {
    readonly step?: number;
    readonly decimalPlaces?: NumberInputDecimalPlaces;
}
export interface ToggleNode extends SettingInputNode<"toggle"> {
}
export interface SelectInputNode extends SettingInputNode<"select"> {
}
export interface DateInputNode extends SettingInputNode<"date-input"> {
}
export interface DateTimeInputNode extends SettingInputNode<"datetime-input"> {
}
export interface MultiSelectInputNode extends SettingInputNode<"multi-select"> {
}
export interface ButtonNode extends UiNodeBase<"button">, ActionControl {
}
export interface NavigationNode extends UiNodeBase<"navigation"> {
    readonly label: string;
    readonly screen: string;
    readonly input?: SerializableValue;
}
export interface EmptyStateNode extends UiNodeBase<"empty-state"> {
    readonly title: string;
    readonly description?: string;
}
export interface ListItemNode extends UiNodeBase<"list-item"> {
    readonly title: string;
    readonly subtitle?: string;
    readonly trailing?: string;
    readonly leadingIcon?: UiIconName;
    readonly primaryAction?: ActionControl;
    readonly actions?: readonly ActionControl[];
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
        readonly format?: DisplayFormat;
    }[];
}
export type UiNode = PageNode | SectionNode | RowNode | ColumnNode | HeadingNode | TextNode | BadgeNode | ProgressNode | MetricNode | TimerNode | TextInputNode | NumberInputNode | ToggleNode | SelectInputNode | DateInputNode | DateTimeInputNode | MultiSelectInputNode | ButtonNode | NavigationNode | EmptyStateNode | ListItemNode | ListNode | SummaryNode;
export declare const ui: {
    readonly action: (definition: ActionControl) => ActionControl;
    readonly page: (definition: Omit<PageNode, "type">) => PageNode;
    readonly section: (definition: Omit<SectionNode, "type">) => SectionNode;
    readonly row: (definition: Omit<RowNode, "type">) => RowNode;
    readonly column: (definition: Omit<ColumnNode, "type">) => ColumnNode;
    readonly heading: (definition: Omit<HeadingNode, "type">) => HeadingNode;
    readonly text: (definition: Omit<TextNode, "type">) => TextNode;
    readonly badge: (definition: Omit<BadgeNode, "type">) => BadgeNode;
    readonly progress: (definition: Omit<ProgressNode, "type">) => ProgressNode;
    readonly metric: (definition: Omit<MetricNode, "type">) => MetricNode;
    readonly timer: (definition: Omit<TimerNode, "type">) => TimerNode;
    readonly textInput: (definition: Omit<TextInputNode, "type">) => TextInputNode;
    readonly numberInput: (definition: Omit<NumberInputNode, "type">) => NumberInputNode;
    readonly toggle: (definition: Omit<ToggleNode, "type">) => ToggleNode;
    readonly select: (definition: Omit<SelectInputNode, "type">) => SelectInputNode;
    readonly dateInput: (definition: Omit<DateInputNode, "type">) => DateInputNode;
    readonly datetimeInput: (definition: Omit<DateTimeInputNode, "type">) => DateTimeInputNode;
    readonly multiSelect: (definition: Omit<MultiSelectInputNode, "type">) => MultiSelectInputNode;
    readonly button: (definition: Omit<ButtonNode, "type">) => ButtonNode;
    readonly navigation: (definition: Omit<NavigationNode, "type">) => NavigationNode;
    readonly emptyState: (definition: Omit<EmptyStateNode, "type">) => EmptyStateNode;
    readonly listItem: (definition: Omit<ListItemNode, "type">) => ListItemNode;
    readonly list: (definition: Omit<ListNode, "type">) => ListNode;
    readonly summary: (definition: Omit<SummaryNode, "type">) => SummaryNode;
};
export {};
