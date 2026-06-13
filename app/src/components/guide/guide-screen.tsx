import BackButton from "@/components/back-button";
import { asTranslationKey } from "@/i18n";
import { BORDER_RADIUS } from "@/constants/constants";
import { DIFFICULTIES } from "@/data/trail-content";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { LayoutAnimation, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface AccordionProps {
  icon: React.ReactNode;
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionSection({ icon, title, summary, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const theme = useTheme();

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }

  return (
    <View
      style={[
        s.accordion,
        {
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Pressable onPress={toggle} style={[s.accordionHeader, { backgroundColor: theme.colors.secondaryContainer }]}>
        <View style={s.accordionHeaderLeft}>
          <View style={[s.iconWrap, { backgroundColor: theme.colors.secondaryContainer }]}>{icon}</View>
          <View style={s.titleGroup}>
            <Text style={[s.sectionTitle, { color: theme.colors.onSecondaryContainer }]}>{title}</Text>
            {!open && (
              <Text
                style={[s.summaryText, { color: theme.colors.onSecondaryContainer }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {summary}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.onSecondaryContainer} />
      </Pressable>

      {open && (
        <>
          <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
          <View style={s.accordionContent}>{children}</View>
        </>
      )}
    </View>
  );
}

export default function GuideScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const cardText = theme.colors.onSurface;

  const links = t("guide.links", { returnObjects: true }) as { label: string; url: string }[];

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <BackButton />
          <Text variant="headlineMedium" style={[s.pageTitle, { color: theme.colors.primary }]}>
            {t("guide.title")}
          </Text>
        </View>
        <View style={s.content}>
          <AccordionSection
            icon={<MaterialCommunityIcons name="walk" size={18} color={theme.colors.primary} />}
            title={t("guide.allemansrattenTitle")}
            summary={t("guide.allemansrattenSummary")}
            defaultOpen
          >
            <Text style={[s.bodyText, { color: cardText }]}>{t("guide.allemansrattenBody1")}</Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              <Text style={[s.bold, { color: cardText }]}>{t("guide.allemansrattenMayBold")} </Text>
              {t("guide.allemansrattenMay")}
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              <Text style={[s.bold, { color: cardText }]}>{t("guide.allemansrattenMayNotBold")} </Text>
              {t("guide.allemansrattenMayNot")}
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              <Text style={[s.bold, { color: cardText }]}>{t("guide.allemansrattenDogBold")} </Text>
              {t("guide.allemansrattenDog")}
            </Text>
          </AccordionSection>

          <AccordionSection
            icon={<MaterialCommunityIcons name="shield-check-outline" size={18} color={theme.colors.primary} />}
            title={t("guide.naturreservatTitle")}
            summary={t("guide.naturreservatSummary")}
          >
            <Text style={[s.bodyText, { color: cardText }]}>{t("guide.naturreservatBody1")}</Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              {t("guide.naturreservatRulesPrefix")}
              <Text style={[s.bold, { color: cardText }]}>{t("guide.naturreservatRulesBold")}</Text>
              {t("guide.naturreservatRulesSuffix")}
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              {t("guide.naturreservatForbidPrefix")}
              <Text style={[s.bold, { color: cardText }]}>{t("guide.naturreservatForbidBold")}</Text>
              {t("guide.naturreservatForbidSuffix")}
            </Text>
          </AccordionSection>

          <AccordionSection
            icon={<MaterialCommunityIcons name="wheelchair-accessibility" size={18} color={theme.colors.primary} />}
            title={t("guide.accessibilityGuideTitle")}
            summary={t("guide.accessibilityGuideSummary")}
          >
            <Text style={[s.bodyText, { color: cardText }]}>
              {t("guide.accessibilityGuideBody1Prefix")}
              <Text style={[s.bold, { color: cardText }]}>{t("guide.accessibilityGuideBody1Bold")}</Text>
              {t("guide.accessibilityGuideBody1Suffix")}
            </Text>
            <Text style={[s.bodyText, { color: cardText }]}>{t("guide.accessibilityGuideBody2")}</Text>
            <Text style={[s.bodyText, { color: cardText }]}>
              {t("guide.accessibilityGuideBody3Prefix")}
              <Text style={[s.bold, { color: cardText }]}>{t("guide.accessibilityGuideBody3Bold")}</Text>
              {t("guide.accessibilityGuideBody3Suffix")}
            </Text>
          </AccordionSection>

          <AccordionSection
            icon={<Ionicons name="trail-sign-outline" size={18} color={theme.colors.primary} />}
            title={t("guide.difficultiesGuideTitle")}
            summary={t("guide.difficultiesGuideSummary")}
          >
            <View style={s.cardStack}>
              {DIFFICULTIES.map((item) => (
                <View key={item.value} style={[s.difficultyCard, { borderColor: theme.colors.outlineVariant }]}>
                  <View style={s.difficultyCardHeader}>
                    {getDifficultyIcon(classificationParser(item.value))}
                    <Text style={[s.cardLabel, { color: cardText }]}>{t(asTranslationKey(item.label))}</Text>
                  </View>
                  <Text style={[s.bodyText, { color: cardText }]}>{t(asTranslationKey(item.description))}</Text>
                </View>
              ))}
            </View>
          </AccordionSection>

          <AccordionSection
            icon={<Ionicons name="book-outline" size={18} color={theme.colors.primary} />}
            title={t("guide.readMoreTitle")}
            summary={t("guide.readMoreSummary")}
          >
            {links.map(({ label, url }, index) => (
              <View key={url}>
                {index > 0 && <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />}
                <Pressable style={s.linkRow} onPress={() => Linking.openURL(url)}>
                  <View
                    style={[
                      s.linkIconBox,
                      { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary },
                    ]}
                  >
                    <MaterialCommunityIcons name="link-variant" size={20} color={theme.colors.onTertiaryContainer} />
                  </View>
                  <Text style={[s.linkText, { color: theme.colors.onSurface }]}>{label}</Text>
                </Pressable>
              </View>
            ))}
          </AccordionSection>

          <Text variant="bodySmall" style={[s.footer, { color: theme.colors.outline }]}>
            {t("guide.footer")}
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
    paddingLeft: Platform.select({ ios: 0, default: 12 }),
  },
  container: {
    paddingTop: 8,
    paddingBottom: 48,
    gap: 8,
  },
  content: {
    paddingHorizontal: 12,
    gap: 12,
  },
  pageTitle: {
    fontWeight: "bold",
  },
  accordion: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  summaryText: {
    fontSize: 12,
    opacity: 0.65,
  },
  accordionContent: {
    padding: 14,
    gap: 12,
  },
  cardStack: {
    gap: 8,
  },
  difficultyCard: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 6,
  },
  difficultyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  bold: {
    fontWeight: "700",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingVertical: 10,
  },
  linkIconBox: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    padding: 8,
  },
  linkText: {
    flex: 1,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    marginTop: 4,
  },
});
