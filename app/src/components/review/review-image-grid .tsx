import { BORDER_RADIUS } from "@/constants/constants";
import { ReviewImage } from "@/data/types";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import ImageViewer from "./image-viewer";

interface ReviewImageProps {
  reviewImages: ReviewImage[];
}

export default function ReviewImageGrid({ reviewImages }: ReviewImageProps) {
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);

  const handleImagePress = () => {
    setIsGalleryVisible(true);
  };

  return (
    <View style={s.container}>
      {reviewImages.map((image) => (
        <Pressable key={image.identifier} onPress={handleImagePress}>
          <Image style={s.image} contentFit="cover" source={{ uri: image.imageUrl }} />
        </Pressable>
      ))}
      <ImageViewer images={reviewImages} visible={isGalleryVisible} onDismiss={() => setIsGalleryVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  image: {
    height: 100,
    width: 80,
    borderRadius: BORDER_RADIUS,
  },
});
