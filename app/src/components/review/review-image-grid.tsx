// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { ReviewImage } from "@/data/types";
import { Image } from "expo-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import ImageViewer from "./image-viewer";

interface ReviewImageProps {
  reviewImages: ReviewImage[];
}

export default function ReviewImageGrid({ reviewImages }: ReviewImageProps) {
  const { t } = useTranslation();
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [openIndex, setOpenIndex] = useState(0);

  const handleImagePress = (index: number) => {
    setOpenIndex(index);
    setIsGalleryVisible(true);
  };

  return (
    <View style={s.container}>
      {reviewImages.map((image, index) => (
        <Pressable
          key={image.identifier}
          testID={`review-image-${index}`}
          onPress={() => handleImagePress(index)}
          accessibilityRole="imagebutton"
          accessibilityLabel={t("hike.openImage", { index: index + 1, count: reviewImages.length })}
        >
          <Image style={s.image} contentFit="cover" source={{ uri: image.imageUrl }} />
        </Pressable>
      ))}
      <ImageViewer
        images={reviewImages}
        visible={isGalleryVisible}
        initialIndex={openIndex}
        onDismiss={() => setIsGalleryVisible(false)}
      />
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
