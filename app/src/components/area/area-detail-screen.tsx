import { borasAreas, FacilityType } from "@/data/areas-data";
import { asTranslationKey } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Divider, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import BackButton from "../back-button";
import FacilitySection from "./facility-section";

export default function AreaDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ identifier: string }>();
  const identifier = Array.isArray(params.identifier) ? params.identifier[0] : params.identifier;
  const area = borasAreas.find((i) => i.identifier === identifier);

  if (!area) return <ActivityIndicator style={{ flex: 1 }} />;

  const firePits = area.facilities[FacilityType.Firepit];
  const fishing = area.facilities[FacilityType.FishingArea];
  const shelter = area.facilities[FacilityType.Shelter];
  const swimming = area.facilities[FacilityType.SwimmingArea];

  const hasFacilities = firePits.length > 0 || fishing.length > 0 || shelter.length > 0 || swimming.length > 0;

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.backButtonRow}>
          <BackButton />
        </View>
        <Image source={area.image} style={s.heroImage} resizeMode="cover" />
        <View style={s.header}>
          <Text style={[s.title, { color: theme.colors.onBackground }]}>{area.name}</Text>
          <View style={s.locationRow}>
            <MaterialIcons name="place" size={16} color={theme.colors.primary} />
            <Text style={[s.locationText, { color: theme.colors.onSurfaceVariant }]}>{t(asTranslationKey(area.location))}</Text>
          </View>
        </View>
        <Text style={[s.description, { color: theme.colors.onBackground }]}>{t(asTranslationKey(area.description))}</Text>

        {hasFacilities && (
          <>
            <Divider />
            <Text style={[s.facilitiesHeading, { color: theme.colors.onBackground }]}>{t("area.facilities")}</Text>
            <FacilitySection title={t("area.firePits")} icon="outdoor-grill" items={firePits} />
            <FacilitySection title={t("area.shelters")} icon="cabin" items={shelter} />
            <FacilitySection title={t("area.fishing")} icon="set-meal" items={fishing} />
            <FacilitySection title={t("area.swimming")} icon="pool" items={swimming} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    gap: 16,
    paddingBottom: 32,
  },
  backButtonRow: {
    paddingLeft: 4,
    paddingTop: 4,
  },
  heroImage: {
    width: "100%",
    height: 220,
  },
  header: {
    paddingHorizontal: 12,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 14,
  },
  description: {
    paddingHorizontal: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  facilitiesHeading: {
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: "700",
  },
});
