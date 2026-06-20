import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { MapMarkerFilter } from "@/data/types";
import { asTranslationKey } from "@/i18n";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text, useTheme } from "react-native-paper";
import { MARKER_COLORS } from "./marker-styles";

interface Props {
  filter: MapMarkerFilter;
  onChange: (filter: MapMarkerFilter) => void;
}

const ITEMS: { key: keyof MapMarkerFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "trails", label: "filter.trails", icon: "map-marker-path" },
  { key: "shelters", label: "filter.shelters", icon: "tent" },
  { key: "firePits", label: "filter.firePits", icon: "campfire" },
  { key: "accessibility", label: "filter.accessibility", icon: "wheelchair-accessibility" },
];

// Collapsed filter control for the map: a slim pill that expands into a checkbox
// menu. Floats in the top-right corner; uses elevation colour (not shadows) for depth.
export default function MapFilterMenu({ filter, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const surface = theme.colors.elevation.level2;
  const activeCount = ITEMS.filter((item) => filter[item.key]).length;

  return (
    <View style={s.container}>
      <Pressable onPress={() => setOpen((v) => !v)} style={[s.trigger, { backgroundColor: surface }]}>
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
          entering={FadeInUp.duration(150)}
          exiting={FadeOutUp.duration(120)}
          style={[s.panel, { backgroundColor: surface }]}
        >
          {ITEMS.map((item) => {
            const selected = filter[item.key];
            return (
              <Pressable
                key={item.key}
                onPress={() => onChange({ ...filter, [item.key]: !filter[item.key] })}
                style={s.row}
              >
                <View style={s.leading}>
                  {item.key === "accessibility" ? (
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={18}
                      color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                  ) : (
                    // Colour swatch matching the category's pin on the map (a legend).
                    <View
                      style={[
                        s.dot,
                        { backgroundColor: MARKER_COLORS[item.key].fill, borderColor: MARKER_COLORS[item.key].stroke },
                      ]}
                    />
                  )}
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
    // Right-align the trigger and the panel so the menu drops down flush with the
    // top-right corner (easier thumb reach) instead of overflowing leftward.
    alignItems: "flex-end",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
