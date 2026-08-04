export const PROGRESS_FORMATS = ["number", "percent"] as const;

export type ProgressFormat = (typeof PROGRESS_FORMATS)[number];

export interface DormantProgressNode {
  readonly type: "progress";
  readonly label?: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly format?: ProgressFormat;
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export function progressMinimum(node: DormantProgressNode): number {
  return node.min ?? 0;
}

export function progressMaximum(node: DormantProgressNode): number {
  return node.max ?? 100;
}

export function progressClampedValue(node: DormantProgressNode): number {
  return Math.min(progressMaximum(node), Math.max(progressMinimum(node), node.value));
}

export function progressFraction(node: DormantProgressNode): number {
  const minimum = progressMinimum(node);
  return (progressClampedValue(node) - minimum) / (progressMaximum(node) - minimum);
}

export function progressVisualText(node: DormantProgressNode): string {
  if (node.format === "percent") {
    return `${PERCENT_FORMATTER.format(progressFraction(node) * 100)}%`;
  }
  return NUMBER_FORMATTER.format(progressClampedValue(node));
}

export function progressAccessibilityText(node: DormantProgressNode): string {
  const originalValue = NUMBER_FORMATTER.format(node.value);
  const minimum = NUMBER_FORMATTER.format(progressMinimum(node));
  const maximum = NUMBER_FORMATTER.format(progressMaximum(node));
  const percent = PERCENT_FORMATTER.format(progressFraction(node) * 100);
  return `${originalValue}; range ${minimum} to ${maximum}; ${percent}% complete`;
}
