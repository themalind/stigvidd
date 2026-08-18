import RoutePreviewMap from "@/components/map/route-preview-map";
import HikeDetails from "@/components/trail/trail-creator/hike-details";
import { OVERLAY_TEXT_SHADOW, SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Hike } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import { formatDate } from "@/utils/format-date";
import { formatDistanceKm } from "@/utils/format-distance";
import { formatTotalDuration } from "@/utils/hike-stats";
import { relativeDay } from "@/utils/relative-day";
import { LinearGradient } from "expo-linear-gradient";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

// Exported so the skeleton reserves exactly this, and the card drops in without a shift.
export const CARD_HEIGHT = 210;

interface Props {
  hike: Hike;
}

export default function LatestHikeCard({ hike }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Defers the map so it doesn't compete with the landing screen's first paint.
  useEffect(() => {
    startTransition(() => setMapReady(true));
  }, []);

  const path = useMemo(
    () => CoordinateParser({ data: hike.coordinates ?? "", identifier: hike.identifier }),
    [hike.coordinates, hike.identifier],
  );

  const when = relativeDay(hike.createdAt);
  // relativeDay returns null past a month, where the absolute date takes over.
  const whenLabel = when ? t(when.key, { count: when.count }) : formatDate(hike.createdAt);

  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>{t("home.latestHike")}</Text>
      <View style={[s.card, { backgroundColor: theme.colors.surfaceVariant }]}>
        {mapReady && path.length > 0 && (
          <RoutePreviewMap
            idPrefix="latest-hike"
            path={path}
            onOpen={() => setDetailsVisible(true)}
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
        <Pressable
          style={({ pressed }) => [s.content, pressed && { opacity: 0.7 }]}
          onPress={() => setDetailsVisible(true)}
        >
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
      <HikeDetails visible={detailsVisible} hike={hike} onDismiss={() => setDetailsVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: SURFACE_BORDER_RADIUS,
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
