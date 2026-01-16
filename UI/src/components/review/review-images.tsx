import { ReviewImage } from "@/data/types";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

interface ReviewImageProps {
  reviewImages: ReviewImage[];
}

export default function ReviewImages({ reviewImages }: ReviewImageProps) {
  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}
    >
      {reviewImages.map((img) => (
        <Pressable key={img.identifier}>
          <Image
            style={{ height: 100, width: 80, borderRadius: 8 }}
            contentFit="cover"
            source={{ uri: img.imageUrl }}
          />
        </Pressable>
      ))}
    </View>
  );
}
