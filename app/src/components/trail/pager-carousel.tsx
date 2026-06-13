import { BORDER_RADIUS } from "@/constants/constants";
import { TrailOverview } from "@/data/types";
import { guardedNavigate } from "@/utils/navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

interface PagerCarouselProps {
  data: TrailOverview[];
  onItemPress?: (item: TrailOverview) => void;
  containerPadding?: number;
}

export default function PagerCarousel({ data, onItemPress, containerPadding = 24 }: PagerCarouselProps) {
  const theme = useTheme();
  const listRef = useRef<FlatList<TrailOverview>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { width: windowWidth } = useWindowDimensions();

  const width = windowWidth - containerPadding;
  const imageHeight = Math.round(width * 0.6);

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(data.length - 1, index));
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handlePress = (item: TrailOverview) => {
    if (onItemPress) {
      onItemPress(item);
    } else {
      guardedNavigate(() =>
        router.navigate({
          pathname: "/(tabs)/(home)/trail/[identifier]",
          params: { identifier: item.identifier },
        }),
      );
    }
  };

  const imageSource = (item: TrailOverview) =>
    item.trailImagesResponse && item.trailImagesResponse.length > 0
      ? item.trailImagesResponse[0].imageUrl
      : require("../../assets/images/noImage.png");

  return (
    <View>
      <View style={{ position: "relative" }}>
        <FlatList
          ref={listRef}
          data={data}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          keyExtractor={(item) => String(item.identifier)}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) => (
            <Pressable onPress={() => handlePress(item)} style={{ width }}>
              <ExpoImage
                source={imageSource(item)}
                style={{ width, height: imageHeight, borderRadius: BORDER_RADIUS }}
                contentFit="cover"
                cachePolicy="disk"
                priority="high"
              />
              <View style={s.textRow}>
                <Text style={[s.name, { color: theme.colors.onSurface }]}>{item.name}</Text>
                <Text style={[s.sub, { color: theme.colors.onSurfaceVariant }]}>{item.trailLength} km</Text>
              </View>
            </Pressable>
          )}
        />

        {currentIndex > 0 && (
          <Pressable style={[s.chevron, s.chevronLeft]} onPress={() => goTo(currentIndex - 1)}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
        )}

        {data.length > 1 && (
          <Pressable
            style={[s.chevron, s.chevronRight, currentIndex === data.length - 1 && s.chevronDisabled]}
            onPress={() => goTo(currentIndex + 1)}
            disabled={currentIndex === data.length - 1}
          >
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </Pressable>
        )}
      </View>

      <View style={s.dots}>
        {data.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              { backgroundColor: i === currentIndex ? theme.colors.primary : theme.colors.outlineVariant },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  textRow: {
    paddingTop: 8,
    paddingHorizontal: 2,
    gap: 2,
  },
  name: {
    fontWeight: "700",
    fontSize: 16,
  },
  sub: {
    fontSize: 13,
  },
  chevron: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  chevronLeft: {
    left: 8,
  },
  chevronRight: {
    right: 8,
  },
  chevronDisabled: {
    backgroundColor: "rgba(0,0,0,0.15)",
    opacity: 0.4,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
