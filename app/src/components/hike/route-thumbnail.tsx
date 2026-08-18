import { BORDER_RADIUS } from "@/constants/constants";
import CoordinateParser from "@/utils/coordinate-parser";
import { buildRouteThumbnail } from "@/utils/route-thumbnail";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import Svg, { Circle, Path } from "react-native-svg";

const DEFAULT_SIZE = 52;

interface Props {
  /** The hike's raw coordinate payload; absent or unparseable falls back to the icon. */
  coordinates?: string;
  identifier: string;
  size?: number;
  /** Overrides the tint, for a list that keeps the accent for something else. */
  background?: string;
  stroke?: string;
}

// The hike's own outline, in the slot a shared icon used to fill. Memoized because a list
// row remounts on every sort and the parse is the expensive part.
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
      // One image to a screen reader; the shape itself carries no label.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {route ? (
        <Svg width={size} height={size}>
          <Path d={route.d} stroke={line} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Trailhead, so an out-and-back reads in the direction it was walked. */}
          <Circle cx={route.start[0]} cy={route.start[1]} r={3} fill={line} />
        </Svg>
      ) : (
        <MaterialCommunityIcons name="map-legend" size={24} color={line} />
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
