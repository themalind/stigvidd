import { TrailImage } from "@/data/types";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useTheme } from "react-native-paper";

interface GalleryProps {
  images: TrailImage[];
}

export default function ImageGallery({ images }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState(images[0]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();

  const ITEM_WIDTH = 80;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / ITEM_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <View style={s.container}>
      <View style={s.focusImageConatiner}>
        <Image source={selectedImage.imageUrl} style={s.focusImage} contentFit="cover" />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={s.scrollView}
          horizontal
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH}
          decelerationRate="fast"
        >
          {images.map((image, index) => (
            <Pressable
              key={image.identifier}
              onPress={() => {
                setSelectedImage(image);
                setCurrentIndex(index);
              }}
            >
              <View>
                <Image source={image.imageUrl} style={s.scrollImage} contentFit="cover" />
              </View>
            </Pressable>
          ))}
        </ScrollView>
        {images.length > 1 && (
          <View style={s.paginationContainer}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  s.dots,
                  {
                    backgroundColor: currentIndex === index ? theme.colors.primary : theme.colors.onBackground,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  focusImageConatiner: {
    marginBottom: 20,
    width: "100%",
  },
  focusImage: {
    height: 300,
    width: 350,
    borderRadius: 10,
  },
  scrollImage: {
    height: 90,
    width: 60,
    borderRadius: 5,
  },
  scrollView: {
    flexGrow: 0,
    gap: 15,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  dots: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});
