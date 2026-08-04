import { Image, StyleSheet, Text, View } from "react-native";

import { colors } from "./theme";

export function ProductHeader() {
  return (
    <View style={styles.container}>
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        resizeMode="contain"
        source={require("../../assets/icon.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Pocket Tools</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  logo: {
    borderRadius: 12,
    height: 48,
    width: 48,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 28,
    fontWeight: "800",
  },
});
