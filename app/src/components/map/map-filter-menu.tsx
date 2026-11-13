// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS, MAP_CONTROL_HEIGHT, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { FACILITY_ICONS } from "@/constants/facility-icons";
import { MapMarkerFilter } from "@/data/types";
import { asTranslationKey } from "@/i18n";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text, useTheme } from "react-native-paper";
import { MARKER_COLORS, type MarkerColors } from "./marker-styles";

// keep-comment: a category with colors shows its marker swatch (a legend); one without, such as accessibility, its icon
export interface MapFilterItem<K extends string> {
  key: K;
  label: string;
  colors?: MarkerColors;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

interface Props<K extends string> {
  filter: Record<K, boolean>;
  onChange: (filter: Record<K, boolean>) => void;
  items: MapFilterItem<K>[];
}

export const MAP_TAB_FILTER_ITEMS: MapFilterItem<keyof MapMarkerFilter>[] = [
  { key: "trails", label: "filter.trails", colors: MARKER_COLORS.trails },
  { key: "contributions", label: "filter.contributions", colors: MARKER_COLORS.contributions },
  { key: "shelters", label: "filter.shelters", colors: MARKER_COLORS.shelters },
  { key: "firePits", label: "filter.firePits", colors: MARKER_COLORS.firePits },
  { key: "accessibility", label: "filter.accessibility", icon: FACILITY_ICONS.accessible },
];

// keep-comment: depth comes from the elevation colour, not a shadow
export default function MapFilterMenu<K extends string>({ filter, onChange, items }: Props<K>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const surface = theme.colors.elevation.level2;
  const activeCount = items.filter((item) => filter[item.key]).length;

  return (
    <View style={s.container}>
      <Pressable
        testID="map-filter-trigger"
        onPress={() => setOpen((v) => !v)}
        style={[s.trigger, { backgroundColor: surface }]}
      >
        <MaterialCommunityIcons name="tune-variant" size={18} color={theme.colors.onSurface} />
        <Text style={[s.triggerText, { color: theme.colors.onSurface }]}>{t("filter.label")}</Text>
        {activeCount > 0 && (
          <View style={[s.badge, { backgroundColor: theme.colors.primary }]}>
            <Text style={[s.badgeText, { color: theme.colors.onPrimary }]}>{activeCount}</Text>
          </View>
        )}
        <MaterialIcons
          name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {open && (
        <Animated.View
          testID="map-filter-panel"
          entering={FadeInUp.duration(150)}
          exiting={FadeOutUp.duration(120)}
          style={[s.panel, { backgroundColor: surface }]}
        >
          {items.map((item) => {
            const selected = filter[item.key];
            return (
              <Pressable
                key={item.key}
                testID={`map-filter-row-${item.key}`}
                onPress={() => onChange({ ...filter, [item.key]: !filter[item.key] })}
                style={s.row}
              >
                <View style={s.leading}>
                  {item.colors ? (
                    <View
                      testID={`map-filter-dot-${item.key}`}
                      style={[s.dot, { backgroundColor: item.colors.fill, borderColor: item.colors.stroke }]}
                    />
                  ) : item.icon ? (
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={18}
                      color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                  ) : null}
                </View>
                <Text style={[s.rowText, { color: selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
                  {t(asTranslationKey(item.label))}
                </Text>
                <MaterialIcons
                  name={selected ? "check-box" : "check-box-outline-blank"}
                  size={20}
                  color={selected ? theme.colors.primary : theme.colors.outlineVariant}
                />
              </Pressable>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    // keep-comment: right-aligned so the panel drops flush with the top-right corner instead of overflowing leftward
    alignItems: "flex-end",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: MAP_CONTROL_HEIGHT,
    borderRadius: BORDER_RADIUS,
  },
  triggerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  panel: {
    marginTop: 6,
    borderRadius: SURFACE_BORDER_RADIUS,
    paddingVertical: 4,
    minWidth: 210,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  leading: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
  },
});
