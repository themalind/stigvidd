import { BORDER_RADIUS } from "@/constants/constants";
import { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;

function ShimmerBlock({ style }: { style?: any }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[{ backgroundColor: theme.colors.surfaceVariant, borderRadius: BORDER_RADIUS }, style, animatedStyle]}
    />
  );
}

export default function MapSkeleton({ text }: { text?: string }) {
  const theme = useTheme();
  return (
    <View style={s.container}>
      <ShimmerBlock
        style={{
          borderRadius: BORDER_RADIUS,
          width: WIDTH * 0.9,
          height: HEIGHT * 0.3,
        }}
      />
      {text && (
        <View style={s.overlay}>
          <Text style={[s.text, { color: theme.colors.onSurfaceVariant }]}>{text}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
