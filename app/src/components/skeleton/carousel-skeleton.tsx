import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "react-native-paper";

const { width } = Dimensions.get("screen");
const CAROUSEL_ITEM_WIDTH = Math.round(width * 0.7);
const CAROUSEL_ITEM_HEIGHT = Math.round(CAROUSEL_ITEM_WIDTH * 0.6);

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
      style={[
        { backgroundColor: theme.colors.surfaceVariant, borderRadius: 8 },
        style,
        animatedStyle,
      ]}
    />
  );
}

export default function CarouselSkeleton() {
  return (
    <View style={s.carouselRow}>
      <ShimmerBlock
        style={{
          width: CAROUSEL_ITEM_WIDTH,
          height: CAROUSEL_ITEM_HEIGHT,
          borderRadius: 8,
        }}
      />
      <ShimmerBlock
        style={{
          width: CAROUSEL_ITEM_WIDTH * 0.4,
          height: CAROUSEL_ITEM_HEIGHT,
          borderRadius: 8,
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  carouselRow: {
    flexDirection: "row",
    gap: 10,
  },
});
