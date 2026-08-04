import type { UiNode } from "../model.ts";
import type { DormantProgressNode } from "./sdk12-progress.ts";

export const BADGE_TONES = ["neutral", "info", "success", "warning", "danger"] as const;

export type BadgeTone = (typeof BADGE_TONES)[number];

export interface DormantBadgeNode {
  readonly type: "badge";
  readonly text: string;
  readonly tone?: BadgeTone;
}

export type DormantRenderableNode = UiNode | DormantBadgeNode | DormantProgressNode;

export function badgeTone(node: DormantBadgeNode): BadgeTone {
  return node.tone ?? "neutral";
}

export function badgeAccessibilityLabel(node: DormantBadgeNode): string {
  const tone = badgeTone(node);
  return tone === "neutral" ? node.text : `${tone} status: ${node.text}`;
}
