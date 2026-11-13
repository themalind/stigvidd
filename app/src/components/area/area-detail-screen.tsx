// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING } from "@/constants/constants";
import { FACILITY_ICONS } from "@/constants/facility-icons";
import { FacilityType, hasFacilityType } from "@/data/types";
import { useArea } from "@/hooks/area/useArea";
import { asTranslationKey } from "@/i18n";
import { AreaMapFocus } from "@/utils/area/area-map-shapes";
import { guardedNavigate } from "@/utils/navigation";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import ErrorView from "@/components/status/error-view";
import LoadingIndicator from "@/components/status/loading-indicator";
import AreaImage from "./area-image";
import AreaMap from "./area-map";
import { AreaStackRoutes } from "./area-routes";
import AreaTrailSection from "./area-trail-section";
import FacilityCountRow from "./facility-count-row";
import FacilitySection from "./facility-section";

const HERO_HEIGHT = 260;

// keep-comment: FacilityType is a [Flags] bitmask, so a combined facility (FirePit | Shelter) counts under every kind it carries
const COUNTED_FACILITY_GROUPS = [
  { type: FacilityType.FirePit, focus: "firePit", countKey: "area.firePitCount", icon: FACILITY_ICONS.firePit },
  { type: FacilityType.Shelter, focus: "shelter", countKey: "area.shelterCount", icon: FACILITY_ICONS.shelter },
] as const;

const FACILITY_GROUPS = [
  { type: FacilityType.FishingArea, titleKey: "area.fishing", icon: FACILITY_ICONS.fishing },
  { type: FacilityType.SwimmingArea, titleKey: "area.swimming", icon: FACILITY_ICONS.swimming },
  { type: FacilityType.NatureReserve, titleKey: "area.natureReserve", icon: FACILITY_ICONS.natureReserve },
] as const;

interface Props {
  routes: AreaStackRoutes;
}

export default function AreaDetailScreen({ routes }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ identifier: string }>();

  const { data: area, isLoading, error, refetch } = useArea(params.identifier);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  // A failed refetch keeps the cached data, so the error screen is only for having nothing to show. keep-comment: refetch-error semantics
  if (area === undefined) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  const trailCount = area.trails.length;
  const totalKm = Math.round(area.trails.reduce((sum, tr) => sum + (tr.trailLength ?? 0), 0));
  const countedGroups = COUNTED_FACILITY_GROUPS.map((group) => {
    const members = area.facilities.filter((f) => hasFacilityType(f.facilityType, group.type));
    // keep-comment: only places the map can show, so "show on the map" never opens a map without them
    const accessible = members.filter((f) => f.isAccessible && f.longitude != null && f.latitude != null);
    return { ...group, count: members.length, accessibleCount: accessible.length };
  }).filter((group) => group.count > 0);
  const openMap = (focus?: AreaMapFocus) =>
    guardedNavigate(() =>
      router.navigate({
        pathname: routes.map,
        params: focus ? { identifier: area.identifier, focus } : { identifier: area.identifier },
      }),
    );

  return (
    <View testID="area-screen" style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View testID="area-hero" style={s.hero}>
          <AreaImage area={area} style={s.heroImage} />
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
            testID="area-back"
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [s.backButton, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="chevron-left" size={28} color="#fff" />
          </Pressable>
        )}

        {(trailCount > 0 || totalKm > 0) && (
          <View testID="area-stats" style={s.statsRow}>
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

        <AreaMap
          area={area}
          style={s.section}
          heading={<Text style={[s.sectionHeading, { color: theme.colors.onBackground }]}>{t("area.onTheMap")}</Text>}
          onOpen={() => openMap()}
        />

        {area.trails.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionHeading, { color: theme.colors.onBackground }]}>{t("area.trails")}</Text>
            <AreaTrailSection trails={area.trails} trailRoute={routes.trail} />
          </View>
        )}

        {area.facilities.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionHeading, { color: theme.colors.onBackground }]}>{t("area.facilities")}</Text>
            {countedGroups.length > 0 && (
              <View style={s.countRows}>
                {countedGroups.map((group) => (
                  <FacilityCountRow
                    key={group.type}
                    icon={group.icon}
                    label={t(group.countKey, { count: group.count })}
                    accessibleCount={group.accessibleCount}
                    onShowAccessible={() => openMap(group.focus)}
                  />
                ))}
              </View>
            )}
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
    ...StyleSheet.absoluteFill,
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
  countRows: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 8,
  },
  sectionHeading: {
    paddingHorizontal: SCREEN_PADDING + 4,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
});
