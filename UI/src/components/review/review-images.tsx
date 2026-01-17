import { ReviewImage } from "@/data/types";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View } from "react-native";
import ImageModal from "./image-modal";

interface ReviewImageProps {
  reviewImages: ReviewImage[];
}

export default function ReviewImages({ reviewImages }: ReviewImageProps) {
  const [showModal, setShowModal] = useState(false);
  const handlePress = () => {
    setShowModal(true);
  };

  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}
    >
      {reviewImages.map((img) => (
        <Pressable key={img.identifier} onPress={handlePress}>
          <Image
            style={{ height: 100, width: 80, borderRadius: 8 }}
            contentFit="cover"
            source={{ uri: img.imageUrl }}
          />
        </Pressable>
      ))}
      <ImageModal
        images={reviewImages}
        visible={showModal}
        onDismiss={() => setShowModal(false)}
      />
    </View>
  );
}
