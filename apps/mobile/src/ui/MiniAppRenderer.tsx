import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type {
  PageNode,
  TimerSnapshot,
  UiNode,
} from "../model";
import { metricValue, timerElapsedSeconds } from "../runtime/protocol";

interface MiniAppRendererProps {
  readonly page: PageNode;
  readonly timers: Readonly<Record<string, TimerSnapshot>>;
  readonly onAction: (action: string) => Promise<void>;
}

export function MiniAppRenderer({
  page,
  timers,
  onAction,
}: MiniAppRendererProps) {
  const nowMilliseconds = useClock(Object.keys(timers).length > 0);

  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>{page.title}</Text>
      {page.children.map((node, index) => (
        <NodeView
          key={`${node.type}-${index}`}
          node={node}
          timers={timers}
          nowMilliseconds={nowMilliseconds}
          onAction={onAction}
        />
      ))}
    </View>
  );
}

function useClock(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [active]);
  return now;
}

interface NodeViewProps {
  readonly node: UiNode;
  readonly timers: Readonly<Record<string, TimerSnapshot>>;
  readonly nowMilliseconds: number;
  readonly onAction: (action: string) => Promise<void>;
}

function NodeView({
  node,
  timers,
  nowMilliseconds,
  onAction,
}: NodeViewProps) {
  switch (node.type) {
    case "section":
      return (
        <View style={styles.card}>
          {node.title === undefined ? null : (
            <Text style={styles.cardTitle}>{node.title}</Text>
          )}
          {node.children.map((child, index) => (
            <NodeView
              key={`${child.type}-${index}`}
              node={child}
              timers={timers}
              nowMilliseconds={nowMilliseconds}
              onAction={onAction}
            />
          ))}
        </View>
      );
    case "metric": {
      const value = metricValue(node, timers, nowMilliseconds);
      return (
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{node.label}</Text>
          <Text style={styles.metricValue}>{formatValue(value, node.format)}</Text>
        </View>
      );
    }
    case "timer": {
      const timer = timers[node.timerId];
      const elapsed = timerElapsedSeconds(timer, nowMilliseconds);
      return (
        <Text style={styles.timer}>
          {timer === undefined
            ? (node.emptyValue ?? formatDuration(0))
            : formatDuration(elapsed)}
        </Text>
      );
    }
    case "button":
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => void onAction(node.action)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{node.label}</Text>
        </Pressable>
      );
    case "summary":
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{node.title}</Text>
          <View style={styles.summaryRow}>
            {node.values.map((entry) => (
              <View key={entry.label} style={styles.summaryEntry}>
                <Text style={styles.summaryLabel}>{entry.label}</Text>
                <Text style={styles.summaryValue}>
                  {formatValue(entry.value, entry.format)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
    case "list":
      return (
        <View style={styles.card}>
          {node.title === undefined ? null : (
            <Text style={styles.cardTitle}>{node.title}</Text>
          )}
          {node.items.length === 0 && node.emptyState !== undefined ? (
            <NodeView
              node={node.emptyState}
              timers={timers}
              nowMilliseconds={nowMilliseconds}
              onAction={onAction}
            />
          ) : (
            node.items.map((item, index) => (
              <NodeView
                key={`${item.title}-${index}`}
                node={item}
                timers={timers}
                nowMilliseconds={nowMilliseconds}
                onAction={onAction}
              />
            ))
          )}
        </View>
      );
    case "list-item":
      return (
        <View style={styles.listItem}>
          <View style={styles.listCopy}>
            <Text style={styles.listTitle}>{formatDate(node.title)}</Text>
            {node.subtitle === undefined ? null : (
              <Text style={styles.listSubtitle}>{node.subtitle}</Text>
            )}
          </View>
          {node.trailing === undefined ? null : (
            <Text style={styles.listTrailing}>{node.trailing}</Text>
          )}
        </View>
      );
    case "empty-state":
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{node.title}</Text>
          {node.description === undefined ? null : (
            <Text style={styles.emptyDescription}>{node.description}</Text>
          )}
        </View>
      );
    case "page":
      return null;
  }
}

function formatValue(
  value: string | number,
  format: "plain" | "money" | "duration" | "number" | undefined,
): string {
  if (format === "money") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(value));
  }
  if (format === "duration") return formatDuration(Number(value));
  if (format === "number") return new Intl.NumberFormat().format(Number(value));
  return String(value);
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remaining = totalSeconds % 60;
  return [hours, minutes, remaining]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const styles = StyleSheet.create({
  page: {
    gap: 16,
  },
  pageTitle: {
    color: "#101828",
    fontSize: 30,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    gap: 14,
    padding: 18,
  },
  cardTitle: {
    color: "#172033",
    fontSize: 18,
    fontWeight: "700",
  },
  timer: {
    color: "#101828",
    fontSize: 38,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
  },
  metric: {
    alignItems: "center",
    gap: 4,
  },
  metricLabel: {
    color: "#667085",
    fontSize: 14,
    fontWeight: "600",
  },
  metricValue: {
    color: "#172033",
    fontSize: 26,
    fontWeight: "800",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#172033",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryEntry: {
    backgroundColor: "#f3f5f8",
    borderRadius: 12,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  summaryLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryValue: {
    color: "#172033",
    fontSize: 16,
    fontWeight: "700",
  },
  listItem: {
    alignItems: "center",
    borderTopColor: "#eaecf0",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
  },
  listCopy: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    color: "#172033",
    fontSize: 15,
    fontWeight: "600",
  },
  listSubtitle: {
    color: "#667085",
    fontSize: 13,
  },
  listTrailing: {
    color: "#172033",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    gap: 5,
    paddingVertical: 16,
  },
  emptyTitle: {
    color: "#344054",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyDescription: {
    color: "#667085",
    fontSize: 14,
    textAlign: "center",
  },
});
