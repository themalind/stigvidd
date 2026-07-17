import BackButton from "@/components/back-button";
import { SCREEN_PADDING } from "@/constants/constants";
import Constants from "expo-constants";
import { Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function AboutScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  const features = t("about.features", { returnObjects: true }) as string[];
  const version = Constants.expoConfig?.version;
  const email = t("about.contactEmail");

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <BackButton />
          <Text style={[s.appName, { color: theme.colors.onBackground }]}>Stigvidd</Text>
        </View>
        <View style={s.content}>
          <Text variant="titleMedium" style={[s.tagline, { color: theme.colors.onBackground }]}>
            {t("about.tagline")}
          </Text>
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
              {t("about.contactTitle")}
            </Text>
            <Text variant="bodyMedium" style={[s.featureText, { color: theme.colors.onSecondaryContainer }]}>
              {t("about.contactText")}
            </Text>
            <Text
              variant="bodyMedium"
              style={[s.link, { color: theme.colors.primary }]}
              onPress={() => Linking.openURL(`mailto:${email}`)}
            >
              {email}
            </Text>
          </View>

          <View style={[s.section, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Text variant="titleSmall" style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>
              {t("about.dataSourceTitle")}
            </Text>
            <Text variant="bodyMedium" style={[s.featureText, { color: theme.colors.onSecondaryContainer }]}>
              {t("about.dataSourceText")}
            </Text>
          </View>

          {version ? (
            <Text variant="bodySmall" style={[s.version, { color: theme.colors.outline }]}>
              {t("about.versionLabel")} {version}
            </Text>
          ) : null}
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
  tagline: {
    fontFamily: "Inter_600SemiBold",
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
  link: {
    fontWeight: "600",
  },
  version: {
    textAlign: "center",
    marginTop: 8,
  },
  footer: {
    textAlign: "center",
  },
});
