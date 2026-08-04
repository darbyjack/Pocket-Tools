import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii } from "./theme";

export interface ErrorNoticeProps {
  readonly detail: string;
  readonly message?: string;
  readonly title: string;
}

export function ErrorNotice({ detail, message, title }: ErrorNoticeProps) {
  const [visibleDetail, setVisibleDetail] = useState<string | null>(null);
  const showDetails = visibleDetail === detail;

  return (
    <View accessibilityRole="alert" style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {message === undefined ? null : <Text style={styles.message}>{message}</Text>}
      <Pressable
        accessibilityRole="button"
        onPress={() => setVisibleDetail(showDetails ? null : detail)}
        style={styles.detailsButton}
      >
        <Text style={styles.detailsButtonText}>
          {showDetails ? "Hide details" : "Show details"}
        </Text>
      </Pressable>
      {showDetails ? (
        <Text selectable style={styles.detail}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  title: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "800",
  },
  message: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  detailsButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  detailsButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
  detail: {
    color: colors.danger,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
});
