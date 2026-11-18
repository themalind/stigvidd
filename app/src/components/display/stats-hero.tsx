// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING } from "@/constants/constants";
import { buildDecorativeRoute } from "@/utils/geo/decorative-route";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Svg, { Circle, Path } from "react-native-svg";

// keep-comment: also sets the wave's amplitude
const ROUTE_BAND_HEIGHT = 68;
const ROUTE_PADDING = 8;
const CONTENT_PADDING = SCREEN_PADDING + 10;
const ROUTE_LIFT = 25;

export interface HeroSatellite {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  label: string;
  // keep-comment: for phrases like "flest från Olof"
  labelFirst?: boolean;
}

interface Props {
  // keep-comment: with its unit ("142 km"), which is set smaller
  figure: string;
  label: string;
  satellites: HeroSatellite[];
}

function splitUnit(formatted: string): [string, string] {
  const at = formatted.lastIndexOf(" ");
  return at === -1 ? [formatted, ""] : [formatted.slice(0, at), formatted.slice(at + 1)];
}

export default function StatsHero({ figure, label, satellites }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [value, unit] = splitUnit(figure);

  const route = useMemo(() => buildDecorativeRoute(width, ROUTE_BAND_HEIGHT, ROUTE_PADDING), [width]);
  const surface = theme.dark ? theme.colors.surfaceVariant : theme.colors.secondaryContainer;
  const onSurface = theme.dark ? theme.colors.onSurface : theme.colors.onSecondaryContainer;
  const routeOpacity = theme.dark ? 0.3 : 0.65;

  return (
    <View testID="stats-hero-card" style={[s.card, { backgroundColor: surface }]}>
      <View style={s.content}>
        <View style={s.hero}>
          <Text style={[s.heroValue, { color: onSurface }]}>{value}</Text>
          {!!unit && <Text style={[s.heroUnit, { color: onSurface }]}>{unit}</Text>}
        </View>
        <Text style={[s.heroLabel, { color: onSurface }]}>{label}</Text>

        {/* keep-comment: in flow, since the lane sets the gap between figure and satellites */}
        <View testID="stats-hero-route" style={s.routeBand} pointerEvents="none">
          <Svg width={width} height={ROUTE_BAND_HEIGHT} opacity={routeOpacity}>
            <Path
              d={route.d}
              stroke={theme.colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Circle cx={route.start[0]} cy={route.start[1]} r={4} fill={theme.colors.primary} />
          </Svg>
        </View>

        <View style={s.satellites}>
          {satellites.map((satellite, index) => (
            <View key={`${satellite.icon}-${satellite.label}`} style={s.satelliteGroup}>
              {index > 0 && (
                <View testID="stats-hero-separator" style={[s.separator, { backgroundColor: onSurface }]} />
              )}
              <View testID={`stats-hero-satellite-${index}`} style={s.satellite}>
                <MaterialCommunityIcons name={satellite.icon} size={16} color={theme.colors.primary} />
                {satellite.labelFirst && (
                  <Text style={[s.satLabel, { color: onSurface }]} numberOfLines={1}>
                    {satellite.label}
                  </Text>
                )}
                {/* keep-comment: truncates, since a nickname runs to 20 characters and would push its neighbour off */}
                <Text style={[s.satValue, { color: onSurface }]} numberOfLines={1}>
                  {satellite.value}
                </Text>
                {!satellite.labelFirst && (
                  <Text style={[s.satLabel, { color: onSurface }]} numberOfLines={1}>
                    {satellite.label}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: -SCREEN_PADDING,
    overflow: "hidden",
  },
  // keep-comment: lines the figure up with the icon column of the rows below
  content: {
    paddingVertical: 16,
    paddingHorizontal: CONTENT_PADDING,
  },
  routeBand: {
    height: ROUTE_BAND_HEIGHT,
    marginTop: -ROUTE_LIFT,
    marginHorizontal: -CONTENT_PADDING,
  },
  hero: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  heroValue: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: "Inter_600SemiBold",
  },
  heroUnit: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    opacity: 0.8,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.75,
  },
  satellites: {
    flexDirection: "row",
    alignItems: "center",
  },
  satelliteGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  satellite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  satValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  satLabel: {
    fontSize: 13,
    opacity: 0.75,
    flexShrink: 1,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    opacity: 0.3,
    marginHorizontal: 14,
  },
});
