import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ActionControl, ListItemNode } from "../model.ts";
import { formatDateTime } from "../runtime/display-format.ts";
import { invokeIsolatedListAction } from "./list-row-action.ts";

interface ListItemControlProps {
  readonly node: ListItemNode;
  readonly onInvokeAction: (control: ActionControl) => void;
}

export function ListItemControl({ node, onInvokeAction }: ListItemControlProps) {
  const summary = (
    <View
      style={[
        styles.listItemSummary,
        node.primaryAction?.disabled === true ? styles.disabledSummary : null,
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
      {node.primaryAction === undefined ? (
        summary
      ) : (
        <Pressable
          accessibilityLabel={node.primaryAction.label}
          accessibilityRole="button"
          accessibilityState={{ disabled: node.primaryAction.disabled === true }}
          disabled={node.primaryAction.disabled === true}
          onPress={() => onInvokeAction(node.primaryAction!)}
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
              onPress={(event) =>
                invokeIsolatedListAction(event, () => onInvokeAction(action))
              }
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
    borderTopColor: "#eaecf0",
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 12,
  },
  primaryAction: {
    borderRadius: 10,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  primaryActionPressed: {
    backgroundColor: "#f3f5f8",
  },
  listItemSummary: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  disabledSummary: {
    opacity: 0.45,
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
  listActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  listAction: {
    borderColor: "#98a2b3",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  destructiveListAction: {
    borderColor: "#d92d20",
  },
  disabledAction: {
    opacity: 0.45,
  },
  listActionText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  destructiveListActionText: {
    color: "#b42318",
  },
});
