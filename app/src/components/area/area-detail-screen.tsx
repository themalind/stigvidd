import { getAreaByIdentifier } from "@/api/areas";
import { CITY_AREAS_STALE_TIME } from "@/constants/cache";
import { SCREEN_PADDING } from "@/constants/constants";
import { FacilityType, hasFacilityType } from "@/data/types";
import { asTranslationKey } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import ErrorView from "../error-view";
import LoadingIndicator from "../loading-indicator";
import AreaTrailSection from "./area-trail-section";
import FacilitySection from "./facility-section";

const HERO_HEIGHT = 260;

// Facility groups, driven by the [Flags] FacilityType enum. Membership is tested
// bitwise via hasFacilityType, so a combined facility (e.g. FirePit | Shelter)
// correctly surfaces under every kind it carries.
const FACILITY_GROUPS = [
  { type: FacilityType.FirePit, titleKey: "area.firePits", icon: "outdoor-grill" },
  { type: FacilityType.Shelter, titleKey: "area.shelters", icon: "cabin" },
  { type: FacilityType.FishingArea, titleKey: "area.fishing", icon: "set-meal" },
  { type: FacilityType.SwimmingArea, titleKey: "area.swimming", icon: "pool" },
  { type: FacilityType.NatureReserve, titleKey: "area.natureReserve", icon: "park" },
] as const;

export default function AreaDetailScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ identifier: string }>();

  const {
    data: area,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cityArea", params.identifier],
    queryFn: () => getAreaByIdentifier(params.identifier),
    staleTime: CITY_AREAS_STALE_TIME,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError || area === undefined) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  const trailCount = area.trails.length;
  const totalKm = Math.round(area.trails.reduce((sum, tr) => sum + (tr.trailLength ?? 0), 0));

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Image source={{ uri: area.imageUrl }} style={s.heroImage} contentFit="cover" transition={200} />
          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.8)"]}
            locations={[0, 0.35, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[s.heroContent, { paddingBottom: SCREEN_PADDING + 6 }]}>
            <Text style={s.title} numberOfLines={2}>
              {area.name}
            </Text>
            {!!area.location && (
              <View style={s.locationRow}>
                <Icon source="map-marker" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={s.locationText} numberOfLines={1}>
                  {t(asTranslationKey(area.location))}
                </Text>
              </View>
            )}
          </View>
        </View>

        {Platform.OS === "ios" && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [s.backButton, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
          </Pressable>
        )}

        {(trailCount > 0 || totalKm > 0) && (
          <View style={s.statsRow}>
            {trailCount > 0 && (
              <View style={s.stat}>
                <Icon source="hiking" size={18} color={theme.colors.primary} />
                <Text style={[s.statText, { color: theme.colors.onBackground }]}>
                  {trailCount} {t("area.trailsShort")}
                </Text>
              </View>
            )}
            {totalKm > 0 && (
              <View style={s.stat}>
                <Icon source="map-marker-distance" size={18} color={theme.colors.primary} />
                <Text style={[s.statText, { color: theme.colors.onBackground }]}>
                  {totalKm} {t("area.km")}
                </Text>
              </View>
            )}
          </View>
        )}

        {area.description ? (
          <Text style={[s.description, { color: theme.colors.onSurfaceVariant }]}>
            {t(asTranslationKey(area.description))}
          </Text>
        ) : null}

        {area.trails.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionHeading, { color: theme.colors.onBackground }]}>{t("area.trails")}</Text>
            <AreaTrailSection trails={area.trails} />
          </View>
        )}

        {area.facilities.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionHeading, { color: theme.colors.onBackground }]}>{t("area.facilities")}</Text>
            {FACILITY_GROUPS.map((group) => (
              <FacilitySection
                key={group.type}
                title={t(group.titleKey)}
                icon={group.icon}
                items={area.facilities.filter((f) => hasFacilityType(f.facilityType, group.type))}
              />
            ))}
          </View>
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
    paddingBottom: 32,
    gap: 20,
  },
  hero: {
    height: HERO_HEIGHT,
    width: "100%",
    justifyContent: "flex-end",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    paddingHorizontal: SCREEN_PADDING + 4,
    gap: 4,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 26,
    lineHeight: 30,
    color: "#fff",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    flexShrink: 1,
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: SCREEN_PADDING,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: SCREEN_PADDING + 4,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  description: {
    paddingHorizontal: SCREEN_PADDING + 4,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    paddingHorizontal: SCREEN_PADDING + 4,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
});
