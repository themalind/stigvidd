// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING } from "@/constants/constants";
import { buildDecorativeRoute } from "@/utils/decorative-route";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Svg, { Circle, Path } from "react-native-svg";

// Lane the route line gets to itself, between the figure and the satellites. Also sets
// the wave's amplitude: taller lane, wider swing.
const ROUTE_BAND_HEIGHT = 68;
// Inset of the line within its lane, horizontally and vertically.
const ROUTE_PADDING = 8;
const CONTENT_PADDING = SCREEN_PADDING + 10;
// Pulls the lane up into its own top headroom, closing the gap under the label.
const ROUTE_LIFT = 25;

export interface HeroSatellite {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  label: string;
  /** Renders the label before the value, for phrases like "flest från Olof". */
  labelFirst?: boolean;
}

interface Props {
  /** Formatted figure including its unit, e.g. "142 km" — the unit is set smaller. */
  figure: string;
  label: string;
  satellites: HeroSatellite[];
}

// Splits a trailing unit off the figure so it can be set at its own size.
function splitUnit(formatted: string): [string, string] {
  const at = formatted.lastIndexOf(" ");
  return at === -1 ? [formatted, ""] : [formatted.slice(0, at), formatted.slice(at + 1)];
}

// Banner above a hike list
export default function StatsHero({ figure, label, satellites }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [value, unit] = splitUnit(figure);

  // The get-started card's line, redrawn when the screen width changes.
  const route = useMemo(() => buildDecorativeRoute(width, ROUTE_BAND_HEIGHT, ROUTE_PADDING), [width]);
  const surface = theme.dark ? theme.colors.surfaceVariant : theme.colors.secondaryContainer;
  const onSurface = theme.dark ? theme.colors.onSurface : theme.colors.onSecondaryContainer;
  const routeOpacity = theme.dark ? 0.3 : 0.65;

  return (
    <View style={[s.card, { backgroundColor: surface }]}>
      <View style={s.content}>
        <View style={s.hero}>
          <Text style={[s.heroValue, { color: onSurface }]}>{value}</Text>
          {!!unit && <Text style={[s.heroUnit, { color: onSurface }]}>{unit}</Text>}
        </View>
        <Text style={[s.heroLabel, { color: onSurface }]}>{label}</Text>

        {/* In flow: the lane is what sets the gap between the figure and the satellites. */}
        <View style={s.routeBand} pointerEvents="none">
          <Svg width={width} height={ROUTE_BAND_HEIGHT} opacity={routeOpacity}>
            <Path
              d={route.d}
              stroke={theme.colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Trailhead marker. */}
            <Circle cx={route.start[0]} cy={route.start[1]} r={4} fill={theme.colors.primary} />
          </Svg>
        </View>

        <View style={s.satellites}>
          {satellites.map((satellite, index) => (
            <View key={`${satellite.icon}-${satellite.label}`} style={s.satelliteGroup}>
              {index > 0 && <View style={[s.separator, { backgroundColor: onSurface }]} />}
              <View style={s.satellite}>
                <MaterialCommunityIcons name={satellite.icon} size={16} color={theme.colors.primary} />
                {satellite.labelFirst && (
                  <Text style={[s.satLabel, { color: onSurface }]} numberOfLines={1}>
                    {satellite.label}
                  </Text>
                )}
                {/* Truncates rather than pushing its neighbour off the row — a satellite
                    may carry a nickname, and those run to 20 characters. */}
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
  // Breaks out of the screen's horizontal padding to reach both edges.
  card: {
    marginHorizontal: -SCREEN_PADDING,
    overflow: "hidden",
  },
  // Aligns the figure with the icon column of the rows below.
  content: {
    paddingVertical: 16,
    paddingHorizontal: CONTENT_PADDING,
  },
  // Gives back the width the content padding took, so the line spans the card.
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
