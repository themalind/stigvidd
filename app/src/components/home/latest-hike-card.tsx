// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import RoutePreviewMap from "@/components/map/route-preview-map";
import SectionPanel, { PANEL_BLEED, PANEL_PADDING } from "@/components/section-panel";
import { OVERLAY_TEXT_SHADOW } from "@/constants/constants";
import { Hike } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import { formatDate } from "@/utils/format-date";
import { formatDistanceKm } from "@/utils/format-distance";
import { formatTotalDuration } from "@/utils/hike-stats";
import { guardedNavigate } from "@/utils/navigation";
import { relativeDay } from "@/utils/relative-day";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

// keep-comment: exported so the skeleton reserves exactly this, and the card drops in without a shift
export const CARD_HEIGHT = 210;

interface Props {
  hike: Hike;
}

export default function LatestHikeCard({ hike }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mapReady, setMapReady] = useState(false);

  // keep-comment: defers the map so it doesn't compete with the landing screen's first paint
  useEffect(() => {
    startTransition(() => setMapReady(true));
  }, []);

  const path = useMemo(
    () => CoordinateParser({ data: hike.coordinates ?? "", identifier: hike.identifier }),
    [hike.coordinates, hike.identifier],
  );

  const openHike = () =>
    guardedNavigate(() =>
      router.navigate({ pathname: "/(tabs)/(home)/hike/[identifier]", params: { identifier: hike.identifier } }),
    );

  const when = relativeDay(hike.createdAt);
  // keep-comment: relativeDay returns null past a month, where the absolute date takes over
  const whenLabel = when ? t(when.key, { count: when.count }) : formatDate(hike.createdAt);

  return (
    <SectionPanel title={t("home.latestHike")}>
      <View style={[s.card, PANEL_BLEED, { backgroundColor: theme.colors.surfaceVariant }]}>
        {mapReady && path.length > 0 && (
          <RoutePreviewMap
            idPrefix="latest-hike"
            path={path}
            onOpen={openHike}
            showBadge={false}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.9)"]}
          locations={[0, 0.45, 0.68, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable style={({ pressed }) => [s.content, pressed && { opacity: 0.7 }]} onPress={openHike}>
          <View style={s.textColumn}>
            <Text style={s.name} numberOfLines={1}>
              {hike.name}
            </Text>
            <Text style={s.meta}>
              {formatDistanceKm(hike.hikeLength)} · {formatTotalDuration(hike.duration)} · {whenLabel}
            </Text>
          </View>
          <Icon source="chevron-right" size={24} color="#ffffff" />
        </Pressable>
      </View>
    </SectionPanel>
  );
}

const s = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    marginBottom: -PANEL_PADDING,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  textColumn: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: "#ffffff",
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
    ...OVERLAY_TEXT_SHADOW,
  },
  meta: {
    color: "#ffffff",
    fontSize: 13,
    ...OVERLAY_TEXT_SHADOW,
  },
});
