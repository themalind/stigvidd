import { TrailImage, TrailOverview } from "@/data/types";
import React, { useCallback } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { CarouselTile } from "./ImageCarouselTile";

interface CarouselProps<T extends TrailOverview | TrailImage> {
  data: T[];
  showText?: boolean;
  onItemPress?: (item: T) => void;
}

export default function ImageCarousel<T extends TrailOverview | TrailImage>({
  data,
  showText = true,
  onItemPress,
}: CarouselProps<T>) {
  const scrollX = useSharedValue(0);
  const { width } = useWindowDimensions();
  const itemWidth = Math.round(width * 0.7);
  const itemSpacing = 0;
  const fullItem = itemWidth + itemSpacing;

  const snapOffsets = data.map((_, index) => {
    return index * fullItem - width * 0.1;
  });

  const onScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => (scrollX.value = event.contentOffset.x),
  });

  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => (
      <CarouselTile
        item={item}
        index={index}
        scrollX={scrollX}
        itemWidth={itemWidth}
        itemSpacing={itemSpacing}
        itemKey={item.identifier}
        showText={showText}
        onPress={onItemPress}
      />
    ),
    [scrollX, itemWidth, showText, onItemPress],
  );

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: fullItem,
      offset: fullItem * index,
      index,
    }),
    [fullItem],
  );

  return (
    <View style={{ width: "100%", alignContent: "center" }}>
      <Animated.FlatList
        data={data}
        horizontal
        renderItem={renderItem}
        keyExtractor={(item, index) => String(item.identifier)}
        pagingEnabled={false}
        snapToOffsets={snapOffsets}
        snapToInterval={1}
        snapToAlignment="center"
        decelerationRate="fast"
        scrollEventThrottle={16}
        windowSize={5}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        removeClippedSubviews={true}
        getItemLayout={getItemLayout}
        contentContainerStyle={{
          paddingLeft: 0,
          paddingRight: 0,
        }}
        showsHorizontalScrollIndicator={false}
        onScroll={onScrollHandler}
      />
    </View>
  );
}
