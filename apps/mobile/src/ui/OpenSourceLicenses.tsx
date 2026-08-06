import { Pressable, StyleSheet, Text, View } from "react-native";

import legalNotices from "../generated/legal-notices.json";
import { ScreenScrollView } from "./ScreenScrollView";
import { colors, radii, spacing } from "./theme";

export interface OpenSourceLicensesProps {
  readonly onBack: () => void;
}

export function OpenSourceLicenses({ onBack }: OpenSourceLicensesProps) {
  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Open-source licenses</Text>
      </View>

      <Text style={styles.introduction}>
        Pocket Tools is licensed under Apache License 2.0 and includes third-party software and
        visual assets under their respective licenses. This page is bundled with the application and
        does not require a network connection.
      </Text>

      <LicenseSection title="Pocket Tools — Apache License 2.0">
        {legalNotices.projectLicenseText}
      </LicenseSection>

      <LicenseSection title="Third-party notices">
        {legalNotices.thirdPartyNoticesText}
      </LicenseSection>
    </ScreenScrollView>
  );
}

function LicenseSection({
  children,
  title,
}: {
  readonly children: string;
  readonly title: string;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.licenseCard}>
        <Text selectable style={styles.licenseText}>
          {children}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    padding: spacing.screen,
    paddingBottom: 48,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  backButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  backButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
  },
  introduction: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  licenseCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 16,
  },
  licenseText: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
});
