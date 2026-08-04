import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ActionControl, ListItemNode } from "../model.ts";
import { formatDateTime } from "../runtime/display-format.ts";
import type {
  DormantIconActionControl,
  DormantIconListItemNode,
} from "../runtime/sdk12-icons.ts";
import { HostIcon } from "./HostIcon.tsx";
import { invokeIsolatedListAction } from "./list-row-action.ts";
import { colors, radii, spacing } from "./theme.ts";

interface ListItemControlProps {
  readonly node: ListItemNode;
  readonly onInvokeAction: (control: ActionControl) => void;
}

export function ListItemControl({ node, onInvokeAction }: ListItemControlProps) {
  const iconNode = node as DormantIconListItemNode;
  const primaryAction = iconNode.primaryAction;
  const summary = (
    <View
      style={[
        styles.listItemSummary,
        primaryAction?.disabled === true ? styles.disabledSummary : null,
      ]}
    >
      {iconNode.leadingIcon === undefined ? null : (
        <View style={styles.leadingIcon}>
          <HostIcon name={iconNode.leadingIcon} tone="muted" />
        </View>
      )}
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{formatDateTime(iconNode.title)}</Text>
        {iconNode.subtitle === undefined ? null : (
          <Text style={styles.listSubtitle}>{iconNode.subtitle}</Text>
        )}
      </View>
      {iconNode.trailing === undefined ? null : (
        <Text style={styles.listTrailing}>{iconNode.trailing}</Text>
      )}
      {primaryAction?.icon === undefined ? null : (
        <HostIcon name={primaryAction.icon} tone="muted" />
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
      {iconNode.actions === undefined ? null : (
        <View style={styles.listActions}>
          {iconNode.actions.map((action, index) => (
            <ListActionButton
              action={action}
              index={index}
              key={`${action.action}-${index}`}
              onInvokeAction={onInvokeAction}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ListActionButton({
  action,
  index,
  onInvokeAction,
}: {
  readonly action: DormantIconActionControl;
  readonly index: number;
  readonly onInvokeAction: (control: ActionControl) => void;
}) {
  const destructive = action.intent === "destructive";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: action.disabled === true }}
      disabled={action.disabled === true}
      key={`${action.action}-${index}`}
      onPress={(event) => invokeIsolatedListAction(event, () => onInvokeAction(action))}
      style={[
        styles.listAction,
        destructive ? styles.destructiveListAction : null,
        action.disabled === true ? styles.disabledAction : null,
      ]}
    >
      <View style={styles.actionContent}>
        {action.icon === undefined ? null : (
          <HostIcon name={action.icon} size="small" tone={destructive ? "danger" : "muted"} />
        )}
        <Text
          style={[
            styles.listActionText,
            destructive ? styles.destructiveListActionText : null,
          ]}
        >
          {action.label}
        </Text>
      </View>
    </Pressable>
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
  leadingIcon: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    width: 32,
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
  actionContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
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
