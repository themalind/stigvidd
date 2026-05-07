import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Alert, Dimensions, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

const { width } = Dimensions.get("screen");

interface ReviewImageProp {
  setReviewImages?: (data: string[]) => void; // För att retunera bilderna till formuläret
}

export default function AddReviewImages({ setReviewImages }: ReviewImageProp) {
  const theme = useTheme();
  const setError = useSetAtom(showErrorAtom);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  function OnImagesChange(images: ImagePicker.ImagePickerAsset[]) {
    if (!setReviewImages) {
      return;
    }
    const urls = images.map((asset) => asset.uri); // Använd 'imgs' parametern
    setReviewImages(urls);
  }

  const onDeleteImage = (uri: string) => {
    const newImages = images.filter((i) => i.uri !== uri);
    setImages(newImages);
    OnImagesChange(newImages); // Använd den nya arrayen direkt
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission required", "Permission to access the media library is required.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.3,
      allowsEditing: true,
    });

    if (!result.canceled) {
      if (!result.assets[0].mimeType?.includes("image/jpeg")) {
        setError("Endast JPG-bilder är tillåtna");
        return;
      }

      const newImages = [...images, result.assets[0]];
      setImages(newImages);
      OnImagesChange(newImages);
    }
  };

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {images.length > 0 &&
        images.map((image, index) => (
          <View key={index}>
            <Pressable
              onPress={() => onDeleteImage(image.uri)}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                zIndex: 1337,
                borderRadius: 50,
                backgroundColor: theme.colors.background,
                opacity: 1,
              }}
            >
              <MaterialCommunityIcons name="close" size={25} color={theme.colors.onBackground} />
            </Pressable>
            <Image source={{ uri: image.uri }} contentFit="cover" style={s.image} />
          </View>
        ))}

      {images.length < 3 && (
        <TouchableOpacity
          onPress={pickImage}
          style={[
            s.imageButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary,
              borderWidth: 2,
            },
          ]}
        >
          <MaterialCommunityIcons name="file-image-plus-outline" size={40} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  imageButton: {
    width: width * 0.25,
    aspectRatio: 3 / 4,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: width * 0.25,
    aspectRatio: 3 / 4,
  },
});
