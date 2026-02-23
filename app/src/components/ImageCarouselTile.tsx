import { TrailOverview } from "@/data/types";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";

interface CarouselTileProps {
  item: TrailOverview;
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  itemSpacing?: number;
  showText?: boolean;
  onPress?: (item: TrailOverview) => void;
}

function ImageCarouselTileInner({
  item,
  index,
  scrollX,
  itemWidth,
  itemSpacing = 5,
  showText = true,
  onPress,
}: CarouselTileProps) {
  const fullItem = itemWidth + itemSpacing;

  const rnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          [(index - 1) * fullItem, index * fullItem, (index + 1) * fullItem],
          [0.85, 1, 0.85],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const imageSize = itemWidth;
  const imageHeight = Math.round(imageSize * 0.78);

  const imageSource =
    item.trailImagesResponse && item.trailImagesResponse.length > 0
      ? item.trailImagesResponse[0].imageUrl
      : require("../assets/images/noImage.png");

  const handlePress = () => {
    if (onPress) {
      onPress(item);
    } else {
      router.push({
        pathname: "/(tabs)/(home)/trail/[identifier]",
        params: { identifier: item.identifier },
      });
    }
  };

  const displayText = showText ? `${item.name} ${item.trailLength} km` : null;

  return (
    <Animated.View
      style={[
        s.tile,
        {
          width: itemWidth,
          marginHorizontal: itemSpacing / 2,
          overflow: "hidden",
        },
        rnAnimatedStyle,
      ]}
    >
      <Pressable onPress={handlePress} style={{ alignItems: "center" }}>
        <ExpoImage
          source={imageSource}
          style={{
            width: imageSize,
            height: imageHeight,
            borderRadius: 8,
          }}
          contentFit="cover"
          cachePolicy="disk"
          priority="high"
        />

        {displayText && <Text style={s.trailDetails}>{displayText}</Text>}
      </Pressable>
    </Animated.View>
  );
}

export const CarouselTile = React.memo(ImageCarouselTileInner, (prev, next) => {
  return (
    prev.index === next.index &&
    prev.item.identifier === next.item.identifier &&
    prev.itemWidth === next.itemWidth &&
    prev.itemSpacing === next.itemSpacing &&
    prev.showText === next.showText
  );
});

const s = StyleSheet.create({
  trailDetails: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tile: {
    justifyContent: "center",
    alignItems: "center",
  },
});
