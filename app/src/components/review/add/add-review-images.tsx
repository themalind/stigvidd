import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { resizeImage } from "@/utils/resizeImage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Dimensions, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

const { width } = Dimensions.get("screen");

interface ReviewImageProp {
  setReviewImages?: (data: string[]) => void; // För att retunera bilderna till formuläret
}

export default function AddReviewImages({ setReviewImages }: ReviewImageProp) {
  const theme = useTheme();
  const { t } = useTranslation();
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
      Alert.alert(t("imagePermission.title"), t("imagePermission.message"));
      return;
    }

    try {
      // No cropping (allowsEditing: false) — we resize/compress ourselves below.
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
      });

      if (!result.canceled) {
        // Validate the original picked file; we only accept JPEG.
        if (!result.assets[0].mimeType?.includes("image/jpeg")) {
          setError(t("imagePermission.jpgOnly"));
          return;
        }

        // Shrink dimensions + re-compress to keep uploads small, then swap in the new uri.
        const resizedUri = await resizeImage(result.assets[0].uri);
        const resizedAsset = { ...result.assets[0], uri: resizedUri };

        const newImages = [...images, resizedAsset];
        setImages(newImages);
        OnImagesChange(newImages);
      }
    } catch (error) {
      setError(t("review.addImageError"));
    }
  };

  return (
    <View style={s.container}>
      {images.length > 0 &&
        images.map((image, index) => (
          <View key={index}>
            <Pressable
              onPress={() => onDeleteImage(image.uri)}
              style={[s.deleteButton, { backgroundColor: theme.colors.background }]}
            >
              <MaterialCommunityIcons name="close" size={25} color={theme.colors.onBackground} />
            </Pressable>
            <Image source={{ uri: image.uri }} contentFit="cover" style={s.image} />
          </View>
        ))}

      {images.length < 3 && (
        <Pressable
          onPress={pickImage}
          style={({ pressed }) => [
            s.imageButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary,
            },
            pressed && s.pressed,
          ]}
        >
          <MaterialCommunityIcons name="file-image-plus-outline" size={40} color={theme.colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  deleteButton: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 1337,
    borderRadius: 50,
    opacity: 1,
  },
  imageButton: {
    width: width * 0.25,
    aspectRatio: 3 / 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: width * 0.25,
    aspectRatio: 3 / 4,
  },
});
