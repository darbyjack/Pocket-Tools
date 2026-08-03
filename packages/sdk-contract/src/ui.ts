import type { SerializableValue } from "./values.ts";

interface UiNodeBase<TType extends string> {
  readonly type: TType;
}

interface ChildrenNode<TType extends string> extends UiNodeBase<TType> {
  readonly children: readonly UiNode[];
}

export type DisplayFormat = "plain" | "money" | "duration" | "number";

export interface PageNode extends ChildrenNode<"page"> {
  readonly title: string;
}

export interface SectionNode extends ChildrenNode<"section"> {
  readonly title?: string;
}

export interface RowNode extends ChildrenNode<"row"> {}

export interface ColumnNode extends ChildrenNode<"column"> {}

export interface HeadingNode extends UiNodeBase<"heading"> {
  readonly text: string;
  readonly level?: 1 | 2 | 3;
}

export interface TextNode extends UiNodeBase<"text"> {
  readonly text: string;
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

interface SettingInputNode<TType extends string> extends UiNodeBase<TType> {
  readonly setting: string;
  readonly label?: string;
}

export interface TextInputNode extends SettingInputNode<"text-input"> {
  readonly placeholder?: string;
}

export interface NumberInputNode extends SettingInputNode<"number-input"> {}

export interface ToggleNode extends SettingInputNode<"toggle"> {}

export interface SelectInputNode extends SettingInputNode<"select"> {}

export interface ButtonNode extends UiNodeBase<"button"> {
  readonly label: string;
  readonly action: string;
  readonly input?: SerializableValue;
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

export type UiNode =
  | PageNode
  | SectionNode
  | RowNode
  | ColumnNode
  | HeadingNode
  | TextNode
  | MetricNode
  | TimerNode
  | TextInputNode
  | NumberInputNode
  | ToggleNode
  | SelectInputNode
  | ButtonNode
  | NavigationNode
  | EmptyStateNode
  | ListItemNode
  | ListNode
  | SummaryNode;

export const ui = {
  page(definition: Omit<PageNode, "type">): PageNode {
    return { type: "page", ...definition };
  },
  section(definition: Omit<SectionNode, "type">): SectionNode {
    return { type: "section", ...definition };
  },
  row(definition: Omit<RowNode, "type">): RowNode {
    return { type: "row", ...definition };
  },
  column(definition: Omit<ColumnNode, "type">): ColumnNode {
    return { type: "column", ...definition };
  },
  heading(definition: Omit<HeadingNode, "type">): HeadingNode {
    return { type: "heading", ...definition };
  },
  text(definition: Omit<TextNode, "type">): TextNode {
    return { type: "text", ...definition };
  },
  metric(definition: Omit<MetricNode, "type">): MetricNode {
    return { type: "metric", ...definition };
  },
  timer(definition: Omit<TimerNode, "type">): TimerNode {
    return { type: "timer", ...definition };
  },
  textInput(definition: Omit<TextInputNode, "type">): TextInputNode {
    return { type: "text-input", ...definition };
  },
  numberInput(definition: Omit<NumberInputNode, "type">): NumberInputNode {
    return { type: "number-input", ...definition };
  },
  toggle(definition: Omit<ToggleNode, "type">): ToggleNode {
    return { type: "toggle", ...definition };
  },
  select(definition: Omit<SelectInputNode, "type">): SelectInputNode {
    return { type: "select", ...definition };
  },
  button(definition: Omit<ButtonNode, "type">): ButtonNode {
    return { type: "button", ...definition };
  },
  navigation(definition: Omit<NavigationNode, "type">): NavigationNode {
    return { type: "navigation", ...definition };
  },
  emptyState(definition: Omit<EmptyStateNode, "type">): EmptyStateNode {
    return { type: "empty-state", ...definition };
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
} as const;
