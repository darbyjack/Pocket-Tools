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

export const ui = {
  page(definition: Omit<PageNode, "type">): PageNode {
    return { type: "page", ...definition };
  },
  section(definition: Omit<SectionNode, "type">): SectionNode {
    return { type: "section", ...definition };
  },
  metric(definition: Omit<MetricNode, "type">): MetricNode {
    return { type: "metric", ...definition };
  },
  timer(definition: Omit<TimerNode, "type">): TimerNode {
    return { type: "timer", ...definition };
  },
  button(definition: Omit<ButtonNode, "type">): ButtonNode {
    return { type: "button", ...definition };
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
