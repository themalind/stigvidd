import BackButton from "@/components/back-button";
import { SCREEN_PADDING } from "@/constants/constants";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function AboutScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  const features = t("about.features", { returnObjects: true }) as string[];
  const techStack = t("about.techStack", { returnObjects: true }) as { label: string; value: string }[];

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <BackButton />
          <Text style={[s.appName, { color: theme.colors.onBackground }]}>Stigvidd</Text>
        </View>
        <View style={s.content}>
          <Text variant="bodyMedium" style={[s.description, { color: theme.colors.onBackground }]}>
            {t("about.description")}
          </Text>

          <View style={[s.section, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Text variant="titleSmall" style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>
              {t("about.featuresTitle")}
            </Text>
            {features.map((f, i) => (
              <View key={i} style={s.featureRow}>
                <Text style={{ color: theme.colors.onSecondaryContainer }}>{"•"}</Text>
                <Text variant="bodyMedium" style={[s.featureText, { color: theme.colors.onSecondaryContainer }]}>
                  {f}
                </Text>
              </View>
            ))}
          </View>

          <View style={[s.section, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Text variant="titleSmall" style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>
              {t("about.techTitle")}
            </Text>
            {techStack.map(({ label, value }) => (
              <View key={label} style={s.techRow}>
                <Text variant="bodySmall" style={[s.techLabel, { color: theme.colors.onSecondaryContainer }]}>
                  {label}
                </Text>
                <Text variant="bodySmall" style={[s.techValue, { color: theme.colors.onSecondaryContainer }]}>
                  {value}
                </Text>
              </View>
            ))}
          </View>

          <View style={[s.section, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Text variant="titleSmall" style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>
              {t("about.dataSourceTitle")}
            </Text>
            <Text variant="bodyMedium" style={[s.featureText, { color: theme.colors.onSecondaryContainer }]}>
              {t("about.dataSourceText")}
            </Text>
          </View>

          <Text variant="bodySmall" style={[s.footer, { color: theme.colors.outline }]}>
            {t("about.footer")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
  },
  appName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginBottom: 4,
  },
  container: {
    paddingTop: 8,
    paddingBottom: 40,
    gap: 8,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 16,
  },
  description: {
    lineHeight: 22,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  featureText: {
    flex: 1,
    lineHeight: 20,
  },
  techRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  techLabel: {
    fontWeight: "600",
    width: 70,
  },
  techValue: {
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    textAlign: "center",
    marginTop: 8,
  },
});
