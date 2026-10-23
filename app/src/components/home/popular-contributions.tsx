// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getPopularContributedTrails } from "@/api/trails";
import { trailListSourceAtom } from "@/atoms/trail-list-atoms";
import ContributionCard from "@/components/home/contribution-card";
import SectionPanel, { PANEL_BLEED, PANEL_PADDING } from "@/components/section-panel";
import { guardedNavigate } from "@/utils/navigation";
import { POPULAR_TRAILS_STALE_TIME } from "@/constants/cache";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useTheme } from "react-native-paper";

export const popularContributionsQueryKey = ["trails", "popular-contributions"] as const;

export const HOME_CONTRIBUTION_LIMIT = 5;

// keep-comment: renders nothing until there is at least one published walk, so a new install shows no empty section
export default function PopularContributions() {
  const theme = useTheme();
  const { t } = useTranslation();
  const setTrailListSource = useSetAtom(trailListSourceAtom);
  const { data } = useQuery({
    queryKey: popularContributionsQueryKey,
    queryFn: getPopularContributedTrails,
    staleTime: POPULAR_TRAILS_STALE_TIME,
  });

  if (!data || data.length === 0) return null;

  const openTrail = (identifier: string) =>
    guardedNavigate(() => router.navigate({ pathname: "/(tabs)/(home)/trail/[identifier]", params: { identifier } }));

  const showAll = () =>
    guardedNavigate(() => {
      setTrailListSource("contributions");
      router.navigate("/(tabs)/(trails-tab)");
    });

  return (
    <SectionPanel
      testID="home-popular-contributions"
      title={t("home.popularContributions")}
      subtitle={t("home.popularContributionsHint")}
      headerAction={
        <Pressable testID="home-contributions-see-all" onPress={showAll} hitSlop={12} accessibilityRole="link">
          <Text style={[s.seeAll, { color: theme.colors.tertiary }]}>{t("home.seeAllContributions")}</Text>
        </Pressable>
      }
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={PANEL_BLEED}
        contentContainerStyle={s.row}
        testID="home-contributions-row"
      >
        {data.slice(0, HOME_CONTRIBUTION_LIMIT).map((trail) => (
          <ContributionCard
            key={trail.identifier}
            testID={`home-contribution-${trail.identifier}`}
            trail={trail}
            onPress={openTrail}
          />
        ))}
      </ScrollView>
    </SectionPanel>
  );
}

const s = StyleSheet.create({
  seeAll: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  row: {
    gap: 10,
    paddingHorizontal: PANEL_PADDING,
  },
});
