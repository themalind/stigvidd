// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AdventureReveal from "@/components/home/adventure-reveal";
import { TrailFilterModal } from "@/components/trail/trail-list/trail-filter-modal";
import { BORDER_RADIUS, OVERLAY_TEXT_SHADOW, SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { TrailShortInfoResponse } from "@/data/types";
import { useTrailFilters } from "@/hooks/trail/useTrailFilters";
import { useTrails } from "@/hooks/trail/useTrails";
import { useRealUserLocation } from "@/hooks/useUserLocation";
import { guardedNavigate } from "@/utils/navigation";
import { pickRandomTrail } from "@/utils/pick-random-trail";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const HERO_HEIGHT = 260;

// Draws a random trail. Its own filter state, so narrowing the draw leaves the trails tab alone.
export default function AdventureCard() {
  const theme = useTheme();
  const { t } = useTranslation();
  // Null without a real fix, which hides the "near me" filter.
  const userLocation = useRealUserLocation();
  const { data: trails } = useTrails();

  const { filteredTrails, filters, updateFilter, updateLengthFilter, clearFilters, cities, classifications } =
    useTrailFilters(trails, userLocation);

  const [pick, setPick] = useState<TrailShortInfoResponse | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);

  // A length range counts as one filter, not two.
  const activeFilterCount = useMemo(() => {
    const { minLength, maxLength, maxDistance, ...rest } = filters;
    const hasLengthRange = minLength !== undefined || maxLength !== undefined;
    return Object.values(rest).filter((v) => v !== undefined).length + (hasLengthRange ? 1 : 0);
  }, [filters]);

  // Drops a pick the filters no longer allow.
  useEffect(() => {
    if (pick && !filteredTrails.some((trail) => trail.identifier === pick.identifier)) {
      setPick(null);
    }
  }, [filteredTrails, pick]);

  const roll = () => setPick(pickRandomTrail(filteredTrails, pick?.identifier));

  const open = () => {
    if (!pick) {
      return;
    }
    guardedNavigate(() =>
      router.navigate({
        pathname: "/(tabs)/(home)/trail/[identifier]",
        params: { identifier: pick.identifier },
      }),
    );
  };

  const noMatches = trails !== undefined && filteredTrails.length === 0;

  // Rendered in both states, so the filters stay reachable.
  const filterRow = (
    <View style={s.filterRow}>
      <View style={s.summaryGroup}>
        <Text testID="adventure-filter-summary" style={[s.summary, { color: theme.colors.onSurfaceVariant }]}>
          {activeFilterCount === 0
            ? t("home.adventurousAllTrails")
            : t("home.adventurousFilterCount", { count: activeFilterCount })}
        </Text>
        {/* Clears the filters without opening the sheet. */}
        {activeFilterCount > 0 && (
          <Pressable testID="adventure-clear-filters" onPress={clearFilters} hitSlop={8}>
            <View style={[s.clearChip, { borderColor: theme.colors.outlineVariant }]}>
              <MaterialIcons name="close" size={14} color={theme.colors.tertiary} />
              <Text style={[s.clearChipText, { color: theme.colors.tertiary }]}>{t("trailList.clearFilters")}</Text>
            </View>
          </Pressable>
        )}
      </View>
      <Pressable testID="adventure-filter-button" onPress={() => setFilterVisible(true)}>
        <View style={[s.filterButton, { backgroundColor: theme.colors.secondary }]}>
          <MaterialIcons name="filter-list" size={18} color={theme.colors.onSecondary} />
          <Text style={[s.filterButtonText, { color: theme.colors.onSecondary }]}>{t("filter.label")}</Text>
        </View>
      </Pressable>
    </View>
  );

  return (
    <View testID="adventure-card" style={s.section}>
      {pick ? (
        <View style={s.result}>
          <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>{t("home.adventurousResult")}</Text>
          <View style={[s.card, { backgroundColor: theme.colors.surface }]}>
            {filterRow}
            <AdventureReveal trail={pick} onOpen={open} onReroll={roll} />
          </View>
        </View>
      ) : (
        <>
          <View testID="adventure-hero" style={s.hero}>
            <Image
              source={require("../../assets/images/adventure_cover.jpg")}
              style={[StyleSheet.absoluteFill, s.heroImage]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            {/* Darkest in the middle, where the heading sits. */}
            <LinearGradient
              colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.3)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.heroText}>
              <Text style={s.heroTitle}>{t("home.adventurousTitle")}</Text>
              <View style={s.heroRule} />
              <Text style={s.heroBody}>{t("home.adventurousBody")}</Text>
            </View>
          </View>

          <View style={[s.footer, { backgroundColor: theme.colors.surface }]}>
            {filterRow}
            {noMatches ? (
              <View testID="adventure-no-match" style={s.emptyState}>
                <Text style={[s.body, { color: theme.colors.onSurfaceVariant }]}>{t("home.adventurousNoMatch")}</Text>
              </View>
            ) : (
              <Pressable
                testID="adventure-roll"
                onPress={roll}
                disabled={trails === undefined}
                style={({ pressed }) => [
                  s.rollButton,
                  { backgroundColor: theme.colors.primary },
                  trails === undefined && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <MaterialCommunityIcons name="dice-multiple" size={22} color={theme.colors.onPrimary} />
                <Text style={[s.rollButtonText, { color: theme.colors.onPrimary }]}>{t("home.adventurousAction")}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      <TrailFilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        title={t("filter.label")}
        cities={cities}
        classifications={classifications}
        filters={filters}
        sortBy="name-asc"
        onUpdateFilter={updateFilter}
        onUpdateLengthFilter={updateLengthFilter}
        onUpdateSort={() => {}}
        onClearFilters={clearFilters}
        hasLocation={userLocation !== null}
        showSort={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    padding: SCREEN_PADDING,
    borderRadius: BORDER_RADIUS,
    gap: 0,
  },
  result: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  card: {
    borderRadius: SURFACE_BORDER_RADIUS,
    padding: 12,
    gap: 12,
  },
  hero: {
    height: HERO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderTopLeftRadius: SURFACE_BORDER_RADIUS,
    borderTopRightRadius: SURFACE_BORDER_RADIUS,
  },
  heroImage: {
    borderTopLeftRadius: SURFACE_BORDER_RADIUS,
    borderTopRightRadius: SURFACE_BORDER_RADIUS,
  },
  heroText: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 38,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    ...OVERLAY_TEXT_SHADOW,
  },
  heroRule: {
    width: 70,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  heroBody: {
    color: "#ffffff",
    fontSize: 15,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    ...OVERLAY_TEXT_SHADOW,
  },
  footer: {
    padding: 12,
    gap: 12,
    borderBottomLeftRadius: SURFACE_BORDER_RADIUS,
    borderBottomRightRadius: SURFACE_BORDER_RADIUS,
  },
  body: {
    fontSize: 13,
    flex: 1,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  summary: {
    fontSize: 13,
    flexShrink: 1,
  },
  clearChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  clearChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 10,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  filterButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  rollButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  rollButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
