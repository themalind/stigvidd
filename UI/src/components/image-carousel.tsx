import { Trail, TrailImage } from "@/data/types";
import React, { useCallback } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { CarouselTile } from "./ImageCarouselTile";

interface CarouselProps<T extends Trail | TrailImage> {
  data: T[]; // generisk data-array
  showText?: boolean; // visa text eller inte
  onItemPress?: (item: T) => void; // custom press-handler
}

export default function ImageCarousel<T extends Trail | TrailImage>({
  data,
  showText = true,
  onItemPress,
}: CarouselProps<T>) {
  const scrollX = useSharedValue(0);
  const { width } = useWindowDimensions();
  const itemWidth = Math.round(width * 0.6);
  const itemSpacing = 5;
  const fullItem = itemWidth + itemSpacing;
  const sidePadding = (width - itemWidth) / 2 - itemSpacing / 2;

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
        itemKey={item.id}
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
    <View style={{ width: "100%" }}>
      <Animated.FlatList
        data={data}
        horizontal
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled={false}
        snapToInterval={fullItem}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        windowSize={5}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        removeClippedSubviews={true}
        getItemLayout={getItemLayout}
        contentContainerStyle={{ paddingHorizontal: Math.max(0, sidePadding) }}
        showsHorizontalScrollIndicator={false}
        onScroll={onScrollHandler}
      />
    </View>
  );
}
