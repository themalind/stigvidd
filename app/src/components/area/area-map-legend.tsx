// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ACCESSIBLE_RING_COLOR, MARKER_COLORS } from "@/components/map/marker-styles";
import { AreaMapShapes, MapFacilityKind } from "@/utils/area/area-map-shapes";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { AREA_DOT_COLORS } from "./area-map-layers";

interface Props {
  shapes: AreaMapShapes;
  style?: StyleProp<ViewStyle>;
}

export default function AreaMapLegend({ shapes, style }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const entries = useMemo(() => {
    const kinds = shapes.facilities.features.map((f) => f.properties?.kind as MapFacilityKind);
    const count = (kind: MapFacilityKind) => kinds.filter((k) => k === kind).length;
    const trails = shapes.trails.features.length;
    return [
      {
        key: "trails",
        count: trails,
        label: t("area.trailCount", { count: trails }),
        color: MARKER_COLORS.trails.fill,
      },
      {
        key: "swimming",
        count: count("swimming"),
        label: t("area.mapSwimming", { count: count("swimming") }),
        color: AREA_DOT_COLORS.swimming,
      },
      {
        key: "firePit",
        count: count("firePit"),
        label: t("area.firePitCount", { count: count("firePit") }),
        color: AREA_DOT_COLORS.firePit,
      },
      {
        key: "shelter",
        count: count("shelter"),
        label: t("area.shelterCount", { count: count("shelter") }),
        color: AREA_DOT_COLORS.shelter,
      },
    ].filter((entry) => entry.count > 0);
  }, [shapes, t]);
  const hasAccessible = [...shapes.trails.features, ...shapes.facilities.features].some(
    (feature) => feature.properties?.isAccessible === true,
  );

  if (entries.length === 0) return null;

  return (
    <View testID="area-map-legend" style={[s.legend, style]}>
      {entries.map((entry) => (
        <View key={entry.key} style={s.item}>
          <View style={[s.dot, { backgroundColor: entry.color }]} />
          <Text style={[s.text, { color: theme.colors.onSurface }]}>{entry.label}</Text>
        </View>
      ))}
      {hasAccessible && (
        <View testID="area-map-legend-accessible" style={s.item}>
          <View style={[s.ring, { borderColor: ACCESSIBLE_RING_COLOR }]} />
          <Text style={[s.text, { color: theme.colors.onSurface }]}>{t("area.mapAccessible")}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ring: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
  },
  text: {
    fontSize: 13,
  },
});
