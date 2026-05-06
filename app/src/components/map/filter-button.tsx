import { MapMarkerFilter } from "@/data/types";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Animated } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons, Ionicons, FontAwesome6 } from "@expo/vector-icons";

interface Props {
  filter: MapMarkerFilter;
  onChange: (filter: MapMarkerFilter) => void;
}

export default function FilterButton({ filter, onChange }: Props) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const next = !isOpen;

    Animated.spring(scale, {
      toValue: next ? 1.6 : 1,
      useNativeDriver: true,
    }).start();

    Animated.spring(translateY, {
      toValue: next ? 0 : 0,
      useNativeDriver: true,
    }).start();

    Animated.spring(animation, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
    }).start();

    setIsOpen(next);
  };

  const getStyle = (angle: number, distance: number) => {
    const rad = (angle * Math.PI) / 180;

    return {
      transform: [
        {
          translateX: animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.cos(rad) * distance],
          }),
        },
        {
          translateY: animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -Math.sin(rad) * distance],
          }),
        },
      ],
      opacity: animation,
    };
  };

  return (
    <>
      <Animated.View
        style={[
          s.button,
          s.filter,
          {
            backgroundColor:
              filter.trails || filter.shelters || filter.firePits || filter.accessability
                ? theme.colors.primary
                : theme.colors.secondary,
            borderColor: theme.colors.onPrimary,
            transform: [{ scale }, { translateY }],
          },
        ]}
      >
        <Pressable onPress={toggleMenu}>
          <Ionicons name="filter" size={24} color={theme.colors.onPrimary} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          s.button,
          getStyle(90, 80),
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
        style={[
          s.button,
          getStyle(135, 80),
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
        style={[
          s.button,
          getStyle(180, 80),
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
        style={[
          s.button,
          getStyle(225, 80),
          {
            backgroundColor: filter.accessability ? theme.colors.primary : theme.colors.secondary,
            borderColor: theme.colors.onPrimary,
          },
        ]}
      >
        <Pressable onPress={() => onChange({ ...filter, accessability: !filter.accessability })}>
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
    elevation: 5,
    borderWidth: 2,
  },
  filter: {
    zIndex: 10,
  },
});
