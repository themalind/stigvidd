// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getPopularContributedTrails } from "@/api/trails";
import { CONTRIBUTION_MARKER_COLORS } from "@/components/map/marker-styles";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { TrailCard } from "@/data/types";
import { formatDistanceKm } from "@/utils/format-distance";
import { guardedNavigate } from "@/utils/navigation";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, useTheme } from "react-native-paper";

export const popularContributionsQueryKey = ["trails", "popular-contributions"] as const;

function ContributionRow({ trail }: { trail: TrailCard }) {
  const theme = useTheme();
  const nickName = trail.contribution?.submitterNickName;
  const meta = [formatDistanceKm(trail.trailLength), nickName].filter(Boolean).join(" · ");

  return (
    <Pressable
      testID={`home-contribution-${trail.identifier}`}
      style={[s.row, { backgroundColor: theme.colors.surface }]}
      onPress={() =>
        guardedNavigate(() =>
          router.navigate({ pathname: "/(tabs)/(home)/trail/[identifier]", params: { identifier: trail.identifier } }),
        )
      }
      accessibilityRole="button"
    >
      {trail.image ? (
        <Image source={{ uri: trail.image.imageUrl }} style={s.thumbnail} contentFit="cover" />
      ) : (
        <View style={[s.thumbnail, { backgroundColor: theme.colors.surfaceVariant }]} />
      )}
      <View style={s.text}>
        <Text style={[s.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {trail.name}
        </Text>
        <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={s.likes}>
        <Icon source="thumb-up-outline" size={16} color={CONTRIBUTION_MARKER_COLORS.fill} />
        <Text style={[s.likeCount, { color: CONTRIBUTION_MARKER_COLORS.fill }]}>
          {trail.contribution?.likeCount ?? 0}
        </Text>
      </View>
    </Pressable>
  );
}

// keep-comment: renders nothing until there is at least one published walk, so a new install shows no empty section
export default function PopularContributions() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: popularContributionsQueryKey, queryFn: getPopularContributedTrails });

  if (!data || data.length === 0) return null;

  return (
    <View testID="home-popular-contributions" style={s.section}>
      <View>
        <Text style={[s.title, { color: theme.colors.onBackground }]}>{t("home.popularContributions")}</Text>
        <Text style={[s.subtitle, { color: theme.colors.onSurfaceVariant }]}>{t("home.popularContributionsHint")}</Text>
      </View>
      {data.map((trail) => (
        <ContributionRow key={trail.identifier} trail={trail} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 8,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  subtitle: {
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: BORDER_RADIUS,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  meta: {
    fontSize: 13,
  },
  likes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likeCount: {
    fontFamily: "Inter_600SemiBold",
  },
});
