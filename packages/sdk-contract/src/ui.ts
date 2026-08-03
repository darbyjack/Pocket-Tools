import type { SerializableValue } from "./values.ts";

interface UiNodeBase<TType extends string> {
  readonly type: TType;
  readonly key?: string;
}

export interface PageNode extends UiNodeBase<"page"> {
  readonly title: string;
  readonly children: readonly UiNode[];
}

export interface SectionNode extends UiNodeBase<"section"> {
  readonly title?: string;
  readonly children: readonly UiNode[];
}

export interface StackNode extends UiNodeBase<"row" | "column"> {
  readonly gap?: "none" | "small" | "medium" | "large";
  readonly children: readonly UiNode[];
}

export interface TextNode extends UiNodeBase<"text" | "heading"> {
  readonly value: string;
}

export interface MetricNode extends UiNodeBase<"metric"> {
  readonly label: string;
  readonly value: string | number;
  readonly format?: "plain" | "money" | "duration" | "number";
  readonly supportingText?: string;
}

export interface BadgeNode extends UiNodeBase<"badge"> {
  readonly label: string;
}

export interface TimerNode extends UiNodeBase<"timer"> {
  readonly timerId: string;
  readonly emptyValue?: string;
}

export interface EmptyStateNode extends UiNodeBase<"empty-state"> {
  readonly title: string;
  readonly description?: string;
}

export interface DividerNode extends UiNodeBase<"divider"> {}

export interface SpacerNode extends UiNodeBase<"spacer"> {
  readonly size?: "small" | "medium" | "large";
}

interface InputNodeBase<TType extends string> extends UiNodeBase<TType> {
  readonly name: string;
  readonly label: string;
  readonly required?: boolean;
  readonly helperText?: string;
}

export interface TextInputNode extends InputNodeBase<"text-input" | "text-area"> {
  readonly defaultValue?: string;
  readonly placeholder?: string;
}

export interface NumberInputNode extends InputNodeBase<"number-input" | "money-input"> {
  readonly defaultValue?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface SelectInputNode extends InputNodeBase<"select"> {
  readonly defaultValue?: SerializableValue;
  readonly options: readonly {
    readonly label: string;
    readonly value: SerializableValue;
  }[];
}

export interface ToggleNode extends InputNodeBase<"toggle"> {
  readonly defaultValue?: boolean;
}

export interface DateTimeInputNode
  extends InputNodeBase<"date-input" | "time-input" | "datetime-input"> {
  readonly defaultValue?: string;
}

export interface ButtonNode extends UiNodeBase<"button"> {
  readonly label: string;
  readonly action: string;
  readonly payload?: SerializableValue;
  readonly variant?: "primary" | "secondary" | "danger";
  readonly confirm?: {
    readonly title: string;
    readonly message: string;
    readonly confirmLabel?: string;
  };
}

export interface LinkNode extends UiNodeBase<"link"> {
  readonly label: string;
  readonly screen: string;
  readonly params?: SerializableValue;
}

export interface FormNode extends UiNodeBase<"form"> {
  readonly action: string;
  readonly submitLabel: string;
  readonly children: readonly UiInputNode[];
}

export interface ListItemNode extends UiNodeBase<"list-item"> {
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: string;
  readonly action?: string;
  readonly payload?: SerializableValue;
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

export interface TableNode extends UiNodeBase<"table"> {
  readonly columns: readonly {
    readonly key: string;
    readonly label: string;
  }[];
  readonly rows: readonly Readonly<Record<string, SerializableValue>>[];
}

export type UiInputNode =
  | TextInputNode
  | NumberInputNode
  | SelectInputNode
  | ToggleNode
  | DateTimeInputNode;

export type UiNode =
  | PageNode
  | SectionNode
  | StackNode
  | TextNode
  | MetricNode
  | BadgeNode
  | TimerNode
  | EmptyStateNode
  | DividerNode
  | SpacerNode
  | UiInputNode
  | ButtonNode
  | LinkNode
  | FormNode
  | ListItemNode
  | ListNode
  | SummaryNode
  | TableNode;

export const ui = {
  page(definition: Omit<PageNode, "type">): PageNode {
    return { type: "page", ...definition };
  },
  section(definition: Omit<SectionNode, "type">): SectionNode {
    return { type: "section", ...definition };
  },
  row(definition: Omit<StackNode, "type">): StackNode {
    return { type: "row", ...definition };
  },
  column(definition: Omit<StackNode, "type">): StackNode {
    return { type: "column", ...definition };
  },
  text(definition: Omit<TextNode, "type">): TextNode {
    return { type: "text", ...definition };
  },
  heading(definition: Omit<TextNode, "type">): TextNode {
    return { type: "heading", ...definition };
  },
  metric(definition: Omit<MetricNode, "type">): MetricNode {
    return { type: "metric", ...definition };
  },
  badge(definition: Omit<BadgeNode, "type">): BadgeNode {
    return { type: "badge", ...definition };
  },
  timer(definition: Omit<TimerNode, "type">): TimerNode {
    return { type: "timer", ...definition };
  },
  emptyState(definition: Omit<EmptyStateNode, "type">): EmptyStateNode {
    return { type: "empty-state", ...definition };
  },
  divider(definition: Omit<DividerNode, "type"> = {}): DividerNode {
    return { type: "divider", ...definition };
  },
  spacer(definition: Omit<SpacerNode, "type"> = {}): SpacerNode {
    return { type: "spacer", ...definition };
  },
  textInput(definition: Omit<TextInputNode, "type">): TextInputNode {
    return { type: "text-input", ...definition };
  },
  textArea(definition: Omit<TextInputNode, "type">): TextInputNode {
    return { type: "text-area", ...definition };
  },
  numberInput(definition: Omit<NumberInputNode, "type">): NumberInputNode {
    return { type: "number-input", ...definition };
  },
  moneyInput(definition: Omit<NumberInputNode, "type">): NumberInputNode {
    return { type: "money-input", ...definition };
  },
  select(definition: Omit<SelectInputNode, "type">): SelectInputNode {
    return { type: "select", ...definition };
  },
  toggle(definition: Omit<ToggleNode, "type">): ToggleNode {
    return { type: "toggle", ...definition };
  },
  dateInput(definition: Omit<DateTimeInputNode, "type">): DateTimeInputNode {
    return { type: "date-input", ...definition };
  },
  timeInput(definition: Omit<DateTimeInputNode, "type">): DateTimeInputNode {
    return { type: "time-input", ...definition };
  },
  dateTimeInput(definition: Omit<DateTimeInputNode, "type">): DateTimeInputNode {
    return { type: "datetime-input", ...definition };
  },
  button(definition: Omit<ButtonNode, "type">): ButtonNode {
    return { type: "button", ...definition };
  },
  link(definition: Omit<LinkNode, "type">): LinkNode {
    return { type: "link", ...definition };
  },
  form(definition: Omit<FormNode, "type">): FormNode {
    return { type: "form", ...definition };
  },
  listItem(definition: Omit<ListItemNode, "type">): ListItemNode {
    return { type: "list-item", ...definition };
  },
  list(definition: Omit<ListNode, "type">): ListNode {
    return { type: "list", ...definition };
  },
  summary(definition: Omit<SummaryNode, "type">): SummaryNode {
    return { type: "summary", ...definition };
  },
  table(definition: Omit<TableNode, "type">): TableNode {
    return { type: "table", ...definition };
  },
} as const;
