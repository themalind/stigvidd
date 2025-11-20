import { Trail, TrailImage } from "@/data/types";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "react-native-paper";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

const { width } = Dimensions.get("screen");
const ITEM_WIDTH = Math.round(width * 0.8);

// Type guard för att kolla om item är Trail
function isTrail(item: Trail | TrailImage): item is Trail {
  return "name" in item && "trailLenght" in item;
}

// Ny interface för tile-props
interface CarouselTileProps<T extends Trail | TrailImage> {
  item: T;
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  itemSpacing?: number;
  itemKey?: string | number;
  showText?: boolean; // styr om text ska visas
  onPress?: (item: T) => void; // custom onPress-handler
}

function ImageCarouselTileInner<T extends Trail | TrailImage>({
  item,
  index,
  scrollX,
  itemWidth,
  itemSpacing = 12,
  itemKey,
  showText = true,
  onPress,
}: CarouselTileProps<T>) {
  const fullItem = itemWidth + itemSpacing;

  const rnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          [(index - 1) * fullItem, index * fullItem, (index + 1) * fullItem],
          [-fullItem * 0.35, 0, fullItem * 0.35],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollX.value,
          [(index - 1) * fullItem, index * fullItem, (index + 1) * fullItem],
          [0.7, 1, 0.7],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const imageSize = Math.round(itemWidth * 0.92);

  // Hämta bild-URL beroende på typ
  const getImageSource = () => {
    if (isTrail(item)) {
      return item.trailImages && item.trailImages.length > 0
        ? item.trailImages[0].imageUrl
        : require("../assets/images/noImage.png");
    } else {
      // TrailImage
      return item.imageUrl || require("../assets/images/noImage.png");
    }
  };

  // Default onPress-handler
  const handlePress = () => {
    if (onPress) {
      onPress(item);
    } else if (isTrail(item)) {
      router.push({
        pathname: "/(tabs)/(stacks)/trail/[id]",
        params: { id: item.id },
      });
    }
  };

  // Hämta text att visa (endast för Trail)
  const getDisplayText = () => {
    if (!showText || !isTrail(item)) return null;
    return `${item.name} ${item.trailLenght} km`;
  };

  const displayText = getDisplayText();

  return (
    <Animated.View
      style={[
        s.tile,
        { width: itemWidth, marginHorizontal: itemSpacing / 2 },
        rnAnimatedStyle,
      ]}
    >
      <TouchableOpacity onPress={handlePress}>
        <ExpoImage
          source={getImageSource()}
          style={{ width: imageSize, height: imageSize, borderRadius: 12 }}
          contentFit="cover"
          cachePolicy="disk"
          priority="high"
        />

        {displayText && <Text style={s.trailDetails}>{displayText}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

// Memoize med generic type
export const CarouselTile = React.memo(ImageCarouselTileInner, (prev, next) => {
  const sameIndex = prev.index === next.index;
  const sameKey =
    prev.itemKey !== undefined || next.itemKey !== undefined
      ? prev.itemKey === next.itemKey
      : prev.item === next.item;
  const sameLayout =
    prev.itemWidth === next.itemWidth && prev.itemSpacing === next.itemSpacing;
  const sameShowText = prev.showText === next.showText;
  return sameIndex && sameKey && sameLayout && sameShowText;
}) as <T extends Trail | TrailImage>(
  props: CarouselTileProps<T>,
) => React.ReactElement;

const s = StyleSheet.create({
  background: {
    position: "absolute",
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    padding: 20,
    borderRadius: 20,
  },
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
