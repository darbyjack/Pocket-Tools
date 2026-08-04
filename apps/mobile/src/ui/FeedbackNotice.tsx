import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "./theme";

export interface FeedbackNoticeProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

export function FeedbackNotice({ message, onDismiss }: FeedbackNoticeProps) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.notice}>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityLabel="Dismiss message"
        accessibilityRole="button"
        onPress={onDismiss}
        style={({ pressed }) => [styles.dismiss, pressed ? styles.dismissPressed : null]}
      >
        <Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "center",
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.item,
    padding: spacing.item,
  },
  message: {
    color: colors.success,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  dismiss: {
    borderColor: colors.successBorder,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dismissPressed: {
    backgroundColor: colors.surface,
  },
  dismissText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "700",
  },
});
