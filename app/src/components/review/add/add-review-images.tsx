// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { pickImages } from "@/utils/pick-images";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

const { width } = Dimensions.get("screen");

interface ReviewImageProp {
  setReviewImages?: (data: string[]) => void; // För att retunera bilderna till formuläret
}

export default function AddReviewImages({ setReviewImages }: ReviewImageProp) {
  const theme = useTheme();
  const { t } = useTranslation();
  const setError = useSetAtom(showErrorAtom);
  const [images, setImages] = useState<{ uri: string }[]>([]);

  function OnImagesChange(images: { uri: string }[]) {
    if (!setReviewImages) {
      return;
    }
    const urls = images.map((asset) => asset.uri);
    setReviewImages(urls);
  }

  const onDeleteImage = (uri: string) => {
    const newImages = images.filter((i) => i.uri !== uri);
    setImages(newImages);
    OnImagesChange(newImages);
  };

  const pickImage = async () => {
    try {
      const uris = await pickImages({ limit: 1 });

      if (uris) {
        const newImages = [...images, ...uris.map((uri) => ({ uri }))];
        setImages(newImages);
        OnImagesChange(newImages);
      }
    } catch {
      setError(t("review.addImageError"));
    }
  };

  return (
    <View testID="add-review-images" style={s.container}>
      {images.map((image, index) => (
        <View key={index} testID="add-review-image">
          <Pressable
            testID="add-review-image-delete"
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
          testID="add-review-image-add"
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
