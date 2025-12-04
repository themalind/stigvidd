import { TrailImage, TrailOverviewViewModel } from "@/data/types";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Dimensions, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

const { width } = Dimensions.get("screen");
const ITEM_WIDTH = Math.round(width * 0.9); // Matchar ImageCarousel

// Type guard för att kolla om item är Trail
function isTrail(
  item: TrailOverviewViewModel | TrailImage,
): item is TrailOverviewViewModel {
  return "name" in item && "trailLength" in item;
}

// Interface för tile-props
interface CarouselTileProps<T extends TrailOverviewViewModel | TrailImage> {
  item: T;
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  itemSpacing?: number;
  itemKey?: string | number;
  showText?: boolean;
  onPress?: (item: T) => void;
}

function ImageCarouselTileInner<T extends TrailOverviewViewModel | TrailImage>({
  item,
  index,
  scrollX,
  itemWidth,
  itemSpacing = 5, // Matchar ImageCarousel
  itemKey,
  showText = true,
  onPress,
}: CarouselTileProps<T>) {
  const fullItem = itemWidth + itemSpacing;

  // Animerad stil - ENDAST scale, INGEN translateX för perfekt centrering
  const rnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        // Skalar (zoomar) objektet - centrerade objekt är större (1.0), omgivande mindre (0.85)
        scale: interpolate(
          scrollX.value,
          [(index - 1) * fullItem, index * fullItem, (index + 1) * fullItem],
          [0.85, 1, 0.85], // Ändrat från 0.7 till 0.85 för subtilare effekt
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Beräknar bildens storlek
  const imageSize = itemWidth; // Använd hela itemWidth
  const imageHeight = Math.round(imageSize * 0.6);

  // Hämta bild-URL beroende på typ
  const getImageSource = () => {
    if (isTrail(item)) {
      return item.trailImageDTOs && item.trailImageDTOs.length > 0
        ? item.trailImageDTOs[0].imageUrl
        : require("../assets/images/noImage.png");
    } else {
      return item.imageUrl || require("../assets/images/noImage.png");
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress(item);
    } else if (isTrail(item)) {
      router.replace({
        pathname: "/(tabs)/(stacks)/trail/[identifier]",
        params: { identifier: item.identifier },
      });
    }
  };

  // Hämta text att visa (endast för Trail)
  const getDisplayText = () => {
    if (!showText || !isTrail(item)) return null;
    return `${item.name} ${item.trailLength} km`;
  };

  const displayText = getDisplayText();

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
          source={getImageSource()}
          style={{
            width: imageSize,
            height: imageHeight,
            borderRadius: 12,
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

// Memoized version av komponenten
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
}) as <T extends TrailOverviewViewModel | TrailImage>(
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
