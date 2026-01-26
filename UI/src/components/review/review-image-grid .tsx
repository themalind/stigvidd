import { ReviewImage } from "@/data/types";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View } from "react-native";
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
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}
    >
      {reviewImages.map((image) => (
        <Pressable key={image.identifier} onPress={handleImagePress}>
          <Image
            style={{ height: 100, width: 80, borderRadius: 8 }}
            contentFit="cover"
            source={{ uri: image.imageUrl }}
          />
        </Pressable>
      ))}
      <ImageViewer
        images={reviewImages}
        visible={isGalleryVisible}
        onDismiss={() => setIsGalleryVisible(false)}
      />
    </View>
  );
}
