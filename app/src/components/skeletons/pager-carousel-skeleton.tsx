import { BORDER_RADIUS } from "@/constants/constants";
import { useEffect } from "react";
import { View } from "react-native";
import { useTheme } from "react-native-paper";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

function ShimmerBlock({ style }: { style?: any }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ backgroundColor: theme.colors.surfaceVariant, borderRadius: BORDER_RADIUS }, style, animatedStyle]}
    />
  );
}

export default function PagerCarouselSkeleton() {
  return (
    <View style={{ gap: 8 }}>
      <ShimmerBlock style={{ width: "100%", aspectRatio: 16 / 10 }} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <ShimmerBlock key={i} style={{ width: 6, height: 6, borderRadius: 3 }} />
        ))}
      </View>
    </View>
  );
}
