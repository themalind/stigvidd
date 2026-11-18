// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import CoordinateParser from "@/utils/geo/coordinate-parser";
import { buildRouteThumbnail } from "@/components/hike/build-route-thumbnail";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import Svg, { Circle, Path } from "react-native-svg";

const DEFAULT_SIZE = 52;

interface Props {
  // keep-comment: absent or unparseable shows the icon
  coordinates?: string;
  identifier: string;
  size?: number;
  background?: string;
  stroke?: string;
}

// keep-comment: memoized, since a row remounts on every sort and the parse is costly
function RouteThumbnail({ coordinates, identifier, size = DEFAULT_SIZE, background, stroke }: Props) {
  const theme = useTheme();
  const tint = background ?? theme.colors.secondaryContainer;
  const line = stroke ?? theme.colors.secondary;

  const route = useMemo(() => {
    if (!coordinates) return null;
    return buildRouteThumbnail(CoordinateParser({ data: coordinates, identifier }), size, size);
  }, [coordinates, identifier, size]);

  return (
    <View
      style={[s.box, { width: size, height: size, backgroundColor: tint }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {route ? (
        <Svg width={size} height={size}>
          <Path d={route.d} stroke={line} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* keep-comment: the start dot shows which way an out-and-back was walked */}
          <Circle cx={route.start[0]} cy={route.start[1]} r={3} fill={line} />
        </Svg>
      ) : (
        <MaterialCommunityIcons testID="route-thumbnail-fallback" name="map-legend" size={24} color={line} />
      )}
    </View>
  );
}

export default memo(RouteThumbnail);

const s = StyleSheet.create({
  box: {
    borderRadius: BORDER_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
});
