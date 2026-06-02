import { ELEVATION_SHADOW } from "@/constants/constants";
import { MapMarkerFilter } from "@/data/types";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons, Ionicons, FontAwesome6 } from "@expo/vector-icons";

interface Props {
  filter: MapMarkerFilter;
  onChange: (filter: MapMarkerFilter) => void;
}

const DISTANCE = 80;

export default function FilterButton({ filter, onChange }: Props) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const animation = useSharedValue(0);
  const scale = useSharedValue(1);

  const toggleMenu = () => {
    const next = !isOpen;
    setIsOpen(next);
    animation.value = withSpring(next ? 1 : 0);
    scale.value = withSpring(next ? 1.6 : 1);
  };

  const mainStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const trailsStyle = useAnimatedStyle(() => {
    const rad = (90 * Math.PI) / 180;
    return {
      transform: [
        { translateX: interpolate(animation.value, [0, 1], [0, Math.cos(rad) * DISTANCE]) },
        { translateY: interpolate(animation.value, [0, 1], [0, -Math.sin(rad) * DISTANCE]) },
      ],
      opacity: animation.value,
    };
  });

  const sheltersStyle = useAnimatedStyle(() => {
    const rad = (135 * Math.PI) / 180;
    return {
      transform: [
        { translateX: interpolate(animation.value, [0, 1], [0, Math.cos(rad) * DISTANCE]) },
        { translateY: interpolate(animation.value, [0, 1], [0, -Math.sin(rad) * DISTANCE]) },
      ],
      opacity: animation.value,
    };
  });

  const firePitsStyle = useAnimatedStyle(() => {
    const rad = (180 * Math.PI) / 180;
    return {
      transform: [
        { translateX: interpolate(animation.value, [0, 1], [0, Math.cos(rad) * DISTANCE]) },
        { translateY: interpolate(animation.value, [0, 1], [0, -Math.sin(rad) * DISTANCE]) },
      ],
      opacity: animation.value,
    };
  });

  const accessibilityStyle = useAnimatedStyle(() => {
    const rad = (225 * Math.PI) / 180;
    return {
      transform: [
        { translateX: interpolate(animation.value, [0, 1], [0, Math.cos(rad) * DISTANCE]) },
        { translateY: interpolate(animation.value, [0, 1], [0, -Math.sin(rad) * DISTANCE]) },
      ],
      opacity: animation.value,
    };
  });

  return (
    <>
      <Animated.View
        style={[
          s.button,
          s.filter,
          mainStyle,
          {
            backgroundColor:
              filter.trails || filter.shelters || filter.firePits || filter.accessibility
                ? theme.colors.primary
                : theme.colors.secondary,
            borderColor: theme.colors.onPrimary,
          },
        ]}
      >
        <Pressable onPress={toggleMenu}>
          <Ionicons name="filter" size={24} color={theme.colors.onPrimary} />
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={isOpen ? "auto" : "none"}
        style={[
          s.button,
          trailsStyle,
          {
            backgroundColor: filter.trails ? theme.colors.primary : theme.colors.secondary,
            borderColor: theme.colors.onPrimary,
          },
        ]}
      >
        <Pressable onPress={() => onChange({ ...filter, trails: !filter.trails })}>
          <Ionicons name="trail-sign-outline" size={24} color={theme.colors.onPrimary} />
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={isOpen ? "auto" : "none"}
        style={[
          s.button,
          sheltersStyle,
          {
            backgroundColor: filter.shelters ? theme.colors.primary : theme.colors.secondary,
            borderColor: theme.colors.onPrimary,
          },
        ]}
      >
        <Pressable onPress={() => onChange({ ...filter, shelters: !filter.shelters })}>
          <FontAwesome6 name="tent" size={20} color={theme.colors.onPrimary} />
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={isOpen ? "auto" : "none"}
        style={[
          s.button,
          firePitsStyle,
          {
            backgroundColor: filter.firePits ? theme.colors.primary : theme.colors.secondary,
            borderColor: theme.colors.onPrimary,
          },
        ]}
      >
        <Pressable onPress={() => onChange({ ...filter, firePits: !filter.firePits })}>
          <Ionicons name="bonfire-outline" size={24} color={theme.colors.onPrimary} />
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={isOpen ? "auto" : "none"}
        style={[
          s.button,
          accessibilityStyle,
          {
            backgroundColor: filter.accessibility ? theme.colors.primary : theme.colors.secondary,
            borderColor: theme.colors.onPrimary,
          },
        ]}
      >
        <Pressable onPress={() => onChange({ ...filter, accessibility: !filter.accessibility })}>
          <MaterialCommunityIcons name="wheelchair-accessibility" size={24} color={theme.colors.onPrimary} />
        </Pressable>
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  button: {
    position: "absolute",
    right: 15,
    bottom: 80,
    padding: 12,
    borderRadius: 999,
    borderWidth: 2,
    ...ELEVATION_SHADOW,
  },
  filter: {
    zIndex: 10,
  },
});
