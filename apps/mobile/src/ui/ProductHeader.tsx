import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii } from "./theme";

export interface ProductHeaderProps {
  readonly onSettings: () => void;
}

export function ProductHeader({ onSettings }: ProductHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Pocket Tools logo"
          source={require("../../assets/icon.png")}
          style={styles.logo}
        />
        <Text style={styles.title}>Pocket Tools</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onSettings}
        style={({ pressed }) => [styles.settingsButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.settingsText}>Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  brand: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  logo: {
    height: 48,
    width: 48,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 28,
    fontWeight: "800",
  },
  settingsButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  settingsText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
