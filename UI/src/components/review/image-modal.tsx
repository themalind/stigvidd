import { ReviewImage } from "@/data/types";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import { Modal, Portal, useTheme } from "react-native-paper";

interface ModalProps {
  images: ReviewImage[]; // Borde vi ändra så att det inte finns trailimage och reviewimage, bara Image?
  visible: boolean;
  onDismiss: () => void;
}

const { width, height } = Dimensions.get("screen");
const DOT_SIZE = 8;
const DOT_SPACING = 8;
const DOT_INDICATOR_SIZE = DOT_SIZE + DOT_SPACING;
const ITEM_HEIGHT = height * 0.5;
const ITEM_WIDTH = width * 0.7;

export default function ImageModal({ images, visible, onDismiss }: ModalProps) {
  const theme = useTheme();
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemWidth = width - 40;

  // För att synka pagination med rätt bild, när man kommer tillbaka för att se bilderna igen.
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / itemWidth);
    setCurrentIndex(index);
  };

  return (
    <Portal>
      {visible && (
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          backgroundColor: theme.colors.inverseOnSurface,
          margin: 20,
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
          maxHeight: height * 0.6,
          maxWidth: width,
          borderRadius: 20,
        }}
      >
        <View>
          <Animated.FlatList
            horizontal
            pagingEnabled // Gör att bilderna "snappar" på plats
            showsHorizontalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 0 }}
            keyExtractor={(image) => image.identifier}
            data={images}
            initialScrollIndex={currentIndex}
            getItemLayout={(_, index) => ({
              length: itemWidth,
              offset: itemWidth * index,
              index,
            })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true },
            )}
            renderItem={({ item }) => (
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: width - 40, // För att bildrna ska ligga snyggt i modalen
                }}
              >
                <Image
                  source={item.imageUrl}
                  contentFit="contain"
                  style={{ height: ITEM_HEIGHT, width: ITEM_WIDTH }}
                />
              </View>
            )}
          />
          {images.length > 1 && ( // Dölj pagination när det bara finns en bild att visa
            <View style={s.pagination}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[s.dot, { backgroundColor: theme.colors.tertiary }]}
                />
              ))}
              <Animated.View
                style={[
                  s.dotIndicator,
                  {
                    transform: [
                      {
                        translateX: scrollX.interpolate({
                          inputRange: images.map((_, i) => i * (width - 40)),
                          outputRange: images.map(
                            (_, i) => i * DOT_INDICATOR_SIZE,
                          ),
                        }),
                      },
                    ],
                    borderColor: theme.colors.primary,
                  },
                ]}
              />
            </View>
          )}
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  pagination: {
    flexDirection: "row",
    alignSelf: "center",
    transform: [{ translateY: -20 }],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE,
    marginRight: DOT_SPACING,
  },
  dotIndicator: {
    width: DOT_INDICATOR_SIZE,
    height: DOT_INDICATOR_SIZE,
    borderRadius: DOT_INDICATOR_SIZE,
    borderWidth: 2,
    position: "absolute",
    top: -DOT_SPACING / 2,
    left: -DOT_SPACING / 2,
  },
});

// TODO Pagination: https://www.youtube.com/watch?v=FIAPuq24b0g
