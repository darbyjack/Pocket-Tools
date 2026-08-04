import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ActionControl, ListItemNode } from "../model.ts";
import { formatDateTime } from "../runtime/display-format.ts";
import { invokeIsolatedListAction } from "./list-row-action.ts";
import { colors, radii, spacing } from "./theme.ts";

interface ListItemControlProps {
  readonly node: ListItemNode;
  readonly onInvokeAction: (control: ActionControl) => void;
}

export function ListItemControl({ node, onInvokeAction }: ListItemControlProps) {
  const primaryAction = node.primaryAction;
  const summary = (
    <View
      style={[
        styles.listItemSummary,
        primaryAction?.disabled === true ? styles.disabledSummary : null,
      ]}
    >
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{formatDateTime(node.title)}</Text>
        {node.subtitle === undefined ? null : (
          <Text style={styles.listSubtitle}>{node.subtitle}</Text>
        )}
      </View>
      {node.trailing === undefined ? null : (
        <Text style={styles.listTrailing}>{node.trailing}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.listItem}>
      {primaryAction === undefined ? (
        summary
      ) : (
        <Pressable
          accessibilityLabel={primaryAction.label}
          accessibilityRole="button"
          accessibilityState={{ disabled: primaryAction.disabled === true }}
          disabled={primaryAction.disabled === true}
          onPress={() => onInvokeAction(primaryAction)}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed ? styles.primaryActionPressed : null,
          ]}
        >
          {summary}
        </Pressable>
      )}
      {node.actions === undefined ? null : (
        <View style={styles.listActions}>
          {node.actions.map((action, index) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: action.disabled === true }}
              disabled={action.disabled === true}
              key={`${action.action}-${index}`}
              onPress={(event) => invokeIsolatedListAction(event, () => onInvokeAction(action))}
              style={[
                styles.listAction,
                action.intent === "destructive" ? styles.destructiveListAction : null,
                action.disabled === true ? styles.disabledAction : null,
              ]}
            >
              <Text
                style={[
                  styles.listActionText,
                  action.intent === "destructive" ? styles.destructiveListActionText : null,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listItem: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.item,
    paddingTop: spacing.item,
  },
  primaryAction: {
    borderRadius: radii.button,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  primaryActionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  listItemSummary: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.item,
  },
  disabledSummary: {
    opacity: 0.45,
  },
  listCopy: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  listSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  listTrailing: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  listActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  listAction: {
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  destructiveListAction: {
    borderColor: colors.dangerBorder,
  },
  disabledAction: {
    opacity: 0.45,
  },
  listActionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  destructiveListActionText: {
    color: colors.danger,
  },
});
