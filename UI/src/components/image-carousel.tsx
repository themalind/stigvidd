import { Trail, TrailImage } from "@/data/types";
import React, { useCallback } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { CarouselTile } from "./ImageCarouselTile";

// Interface för komponentens props - använder generisk typ T som kan vara antingen Trail eller TrailImage
interface CarouselProps<T extends Trail | TrailImage> {
  data: T[]; // Array med objekt att visa i karusellen
  showText?: boolean; // Valfri prop - bestämmer om text ska visas på objekten
  onItemPress?: (item: T) => void; // Valfri callback-funktion som körs när användaren trycker på ett objekt
}

// Huvudkomponenten - en generisk bildkarusell som fungerar med olika datatyper
export default function ImageCarousel<T extends Trail | TrailImage>({
  data,
  showText = true, // Default-värde: visa text
  onItemPress,
}: CarouselProps<T>) {
  // Shared value för att spåra scroll-position (används för animationer)
  const scrollX = useSharedValue(0);

  // Hämtar skärmens bredd
  const { width } = useWindowDimensions();

  // Beräknar varje objekts bredd som 90% av skärmbredden (avrundat)
  const itemWidth = Math.round(width * 0.7); // Öka från 0.9 till 0.95

  // Mellanrum mellan objekten
  const itemSpacing = 2;

  // Total bredd för ett objekt inklusive mellanrum
  const fullItem = itemWidth + itemSpacing;
  const leftPadding = 1;

  // Beräkna snap-punkter för varje objekt (för exakt centrering)
  const snapOffsets = data.map((_, index) => {
    return index * fullItem;
  });

  // Scroll-handler som uppdaterar scrollX-värdet när användaren scrollar
  const onScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => (scrollX.value = event.contentOffset.x),
  });

  // Memoized render-funktion för varje objekt i listan (optimerar prestanda)
  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => (
      <CarouselTile
        item={item} // Objektet som ska visas
        index={index} // Index i listan
        scrollX={scrollX} // Scroll-position för animationer
        itemWidth={itemWidth} // Bredd på objektet
        itemSpacing={itemSpacing} // Mellanrum mellan objekt
        itemKey={item.id} // Unik nyckel för objektet
        showText={showText} // Om text ska visas
        onPress={onItemPress} // Press-handler
      />
    ),
    [scrollX, itemWidth, showText, onItemPress], // Dependencies - funktionen återskapas endast om dessa ändras
  );

  // Optimerad layout-beräkning som hjälper FlatList att förstå objektens position och storlek
  // Detta förbättrar scroll-prestanda och virtualisering
  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: fullItem, // Objektets totala bredd
      offset: fullItem * index, // Objektets position från start
      index, // Objektets index
    }),
    [fullItem], // Återskapas endast om fullItem ändras
  );

  return (
    <View style={{ width: "100%" }}>
      <Animated.FlatList
        data={data}
        horizontal
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled={false}
        snapToOffsets={snapOffsets}
        snapToAlignment="start" // ÄNDRAT: Tillbaka till "start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        windowSize={5}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        removeClippedSubviews={true}
        getItemLayout={getItemLayout}
        contentContainerStyle={{
          paddingLeft: leftPadding, // Endast vänster padding
          paddingRight: 20, // Lite padding till höger för sista bilden
        }}
        showsHorizontalScrollIndicator={false}
        onScroll={onScrollHandler}
      />
    </View>
  );
}

/*
 LOG  VirtualizedList: You have a large list that is slow to update - 
 make sure your renderItem function renders components that follow React performance best practices like PureComponent, 
 shouldComponentUpdate, etc. {"contentLength": 2189.155517578125, "dt": 515, "prevDt": 642}
› Reloading apps*/
