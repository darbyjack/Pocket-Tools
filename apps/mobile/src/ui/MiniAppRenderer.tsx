import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type {
  ActionControl,
  PageNode,
  SerializableValue,
  SettingDefinition,
  TimerSnapshot,
} from "../model.ts";
import { formatDisplayValue, formatDuration } from "../runtime/display-format.ts";
import { metricValue, settingIsVisible, timerElapsedSeconds } from "../runtime/protocol.ts";
import {
  badgeAccessibilityLabel,
  badgeTone,
  type BadgeTone,
  type DormantRenderableNode,
} from "../runtime/sdk12-badge.ts";
import type { DormantNumberInputNode } from "../runtime/sdk12-number-input-model.ts";
import { ListItemControl } from "./ListItemControl.tsx";
import { SettingControl } from "./SettingControl.tsx";

interface MiniAppRendererProps {
  readonly page: PageNode;
  readonly settings: Readonly<Record<string, SettingDefinition>>;
  readonly settingValues: Readonly<Record<string, SerializableValue>>;
  readonly timers: Readonly<Record<string, TimerSnapshot>>;
  readonly onAction: (action: string, input?: SerializableValue) => Promise<void>;
  readonly onNavigate: (screen: string, input?: SerializableValue) => Promise<void>;
  readonly onSettingChange: (name: string, value: SerializableValue) => Promise<void>;
}

export function MiniAppRenderer({
  page,
  settings,
  settingValues,
  timers,
  onAction,
  onNavigate,
  onSettingChange,
}: MiniAppRendererProps) {
  const nowMilliseconds = useClock(Object.keys(timers).length > 0);

  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>{page.title}</Text>
      {page.children.map((node, index) => (
        <NodeView
          key={`${node.type}-${index}`}
          node={node as DormantRenderableNode}
          settings={settings}
          settingValues={settingValues}
          timers={timers}
          nowMilliseconds={nowMilliseconds}
          onAction={onAction}
          onNavigate={onNavigate}
          onSettingChange={onSettingChange}
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
  readonly node: DormantRenderableNode;
  readonly settings: Readonly<Record<string, SettingDefinition>>;
  readonly settingValues: Readonly<Record<string, SerializableValue>>;
  readonly timers: Readonly<Record<string, TimerSnapshot>>;
  readonly nowMilliseconds: number;
  readonly onAction: (action: string, input?: SerializableValue) => Promise<void>;
  readonly onNavigate: (screen: string, input?: SerializableValue) => Promise<void>;
  readonly onSettingChange: (name: string, value: SerializableValue) => Promise<void>;
}

function NodeView(props: NodeViewProps) {
  const {
    node,
    settings,
    settingValues,
    timers,
    nowMilliseconds,
    onAction,
    onNavigate,
    onSettingChange,
  } = props;

  const renderChildren = (children: readonly DormantRenderableNode[]) =>
    children.map((child, index) => (
      <NodeView
        key={`${child.type}-${index}`}
        node={child}
        settings={settings}
        settingValues={settingValues}
        timers={timers}
        nowMilliseconds={nowMilliseconds}
        onAction={onAction}
        onNavigate={onNavigate}
        onSettingChange={onSettingChange}
      />
    ));

  const invokeAction = (control: ActionControl) => {
    if (control.disabled === true) return;
    const run = () => void onAction(control.action, control.input);
    if (control.confirmation === undefined) {
      run();
      return;
    }

    Alert.alert(
      control.confirmation.title,
      control.confirmation.message,
      [
        {
          text: control.confirmation.cancelLabel ?? "Cancel",
          style: "cancel",
        },
        {
          text: control.confirmation.confirmLabel ?? "Confirm",
          style: control.intent === "destructive" ? "destructive" : "default",
          onPress: run,
        },
      ],
      { cancelable: true },
    );
  };

  switch (node.type) {
    case "section":
      return (
        <View style={styles.card}>
          {node.title === undefined ? null : <Text style={styles.cardTitle}>{node.title}</Text>}
          {renderChildren(node.children)}
        </View>
      );
    case "row":
      return <View style={styles.row}>{renderChildren(node.children)}</View>;
    case "column":
      return <View style={styles.column}>{renderChildren(node.children)}</View>;
    case "heading":
      return (
        <Text
          accessibilityRole="header"
          style={
            node.level === 1
              ? styles.headingOne
              : node.level === 3
                ? styles.headingThree
                : styles.headingTwo
          }
        >
          {node.text}
        </Text>
      );
    case "text":
      return <Text style={styles.bodyText}>{node.text}</Text>;
    case "badge": {
      const tone = badgeTone(node);
      return (
        <View
          accessible
          accessibilityLabel={badgeAccessibilityLabel(node)}
          accessibilityRole="text"
          style={[styles.badge, badgeContainerStyle(tone)]}
        >
          <Text style={[styles.badgeText, badgeTextStyle(tone)]}>{node.text}</Text>
        </View>
      );
    }
    case "metric": {
      const value = metricValue(node, timers, nowMilliseconds);
      return (
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{node.label}</Text>
          <Text style={styles.metricValue}>{formatDisplayValue(value, node.format)}</Text>
        </View>
      );
    }
    case "timer": {
      const timer = timers[node.timerId];
      const elapsed = timerElapsedSeconds(timer, nowMilliseconds);
      return (
        <Text style={styles.timer}>
          {timer === undefined ? (node.emptyValue ?? formatDuration(0)) : formatDuration(elapsed)}
        </Text>
      );
    }
    case "text-input":
    case "number-input":
    case "toggle":
    case "select":
    case "date-input":
    case "datetime-input":
    case "multi-select": {
      const definition = settings[node.setting];
      if (definition === undefined || !settingIsVisible(definition, settingValues)) {
        return null;
      }
      const numericNode =
        node.type === "number-input" ? (node as DormantNumberInputNode) : undefined;
      return (
        <SettingControl
          name={node.setting}
          definition={definition}
          value={settingValues[node.setting] ?? definition.default}
          {...(node.label === undefined ? {} : { label: node.label })}
          {...(node.type !== "text-input" || node.placeholder === undefined
            ? {}
            : { placeholder: node.placeholder })}
          {...(node.type !== "text-input" || node.multiline === undefined
            ? {}
            : { multiline: node.multiline })}
          {...(node.type !== "text-input" || node.minLines === undefined
            ? {}
            : { minLines: node.minLines })}
          {...(numericNode?.step === undefined ? {} : { step: numericNode.step })}
          {...(numericNode?.decimalPlaces === undefined
            ? {}
            : { decimalPlaces: numericNode.decimalPlaces })}
          onChange={onSettingChange}
        />
      );
    }
    case "button":
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: node.disabled === true }}
          disabled={node.disabled === true}
          onPress={() => invokeAction(node)}
          style={[
            styles.primaryButton,
            node.intent === "destructive" ? styles.destructiveButton : null,
            node.disabled === true ? styles.disabledAction : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>{node.label}</Text>
        </Pressable>
      );
    case "navigation":
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => void onNavigate(node.screen, node.input)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>{node.label}</Text>
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
                  {formatDisplayValue(entry.value, entry.format)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
    case "list":
      return (
        <View style={styles.card}>
          {node.title === undefined ? null : <Text style={styles.cardTitle}>{node.title}</Text>}
          {node.items.length === 0 && node.emptyState !== undefined ? (
            <NodeView {...props} node={node.emptyState} />
          ) : (
            node.items.map((item, index) => (
              <NodeView {...props} key={`${item.title}-${index}`} node={item} />
            ))
          )}
        </View>
      );
    case "list-item":
      return <ListItemControl node={node} onInvokeAction={invokeAction} />;
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

function badgeContainerStyle(tone: BadgeTone) {
  switch (tone) {
    case "info":
      return styles.badgeInfo;
    case "success":
      return styles.badgeSuccess;
    case "warning":
      return styles.badgeWarning;
    case "danger":
      return styles.badgeDanger;
    case "neutral":
      return styles.badgeNeutral;
  }
}

function badgeTextStyle(tone: BadgeTone) {
  switch (tone) {
    case "info":
      return styles.badgeTextInfo;
    case "success":
      return styles.badgeTextSuccess;
    case "warning":
      return styles.badgeTextWarning;
    case "danger":
      return styles.badgeTextDanger;
    case "neutral":
      return styles.badgeTextNeutral;
  }
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
  row: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  column: {
    gap: 12,
  },
  headingOne: {
    color: "#101828",
    fontSize: 28,
    fontWeight: "800",
  },
  headingTwo: {
    color: "#172033",
    fontSize: 20,
    fontWeight: "700",
  },
  headingThree: {
    color: "#344054",
    fontSize: 17,
    fontWeight: "700",
  },
  bodyText: {
    color: "#344054",
    fontSize: 16,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeNeutral: {
    backgroundColor: "#f2f4f7",
    borderColor: "#d0d5dd",
  },
  badgeInfo: {
    backgroundColor: "#eff8ff",
    borderColor: "#b2ddff",
  },
  badgeSuccess: {
    backgroundColor: "#ecfdf3",
    borderColor: "#abefc6",
  },
  badgeWarning: {
    backgroundColor: "#fffaeb",
    borderColor: "#fedf89",
  },
  badgeDanger: {
    backgroundColor: "#fef3f2",
    borderColor: "#fecdca",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  badgeTextNeutral: {
    color: "#344054",
  },
  badgeTextInfo: {
    color: "#175cd3",
  },
  badgeTextSuccess: {
    color: "#067647",
  },
  badgeTextWarning: {
    color: "#b54708",
  },
  badgeTextDanger: {
    color: "#b42318",
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
    flexGrow: 1,
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
  destructiveButton: {
    backgroundColor: "#b42318",
  },
  disabledAction: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#98a2b3",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#344054",
    fontSize: 17,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryEntry: {
    backgroundColor: "#f3f5f8",
    borderRadius: 12,
    flexGrow: 1,
    gap: 4,
    minWidth: 96,
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