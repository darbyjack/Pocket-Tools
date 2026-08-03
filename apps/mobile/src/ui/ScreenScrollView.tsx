import type { ReactElement } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
} from "react-native";

export interface ScreenScrollViewProps extends ScrollViewProps {
  readonly keyboardAware?: boolean;
}

export function ScreenScrollView({
  keyboardAware = false,
  style,
  ...props
}: ScreenScrollViewProps): ReactElement {
  const scrollView = (
    <ScrollView
      {...props}
      keyboardDismissMode={props.keyboardDismissMode ?? "on-drag"}
      style={[styles.screen, style]}
    />
  );

  if (!keyboardAware) return scrollView;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      {scrollView}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
