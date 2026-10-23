// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { HikeImage } from "@/data/types";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Icon, Surface, useTheme } from "react-native-paper";

const THUMB_WIDTH = Dimensions.get("screen").width * 0.28;

interface Props {
  images: HikeImage[];
  onOpen: (index: number) => void;
  // Only for the owner, who can add photos.
  edit?: { max: number; uploadingCount: number; onAdd: () => void };
}

export default function HikeImageSection({ images, onOpen, edit }: Props) {
  const canEdit = edit !== undefined;
  const uploadingCount = edit?.uploadingCount ?? 0;
  const max = edit?.max ?? 0;
  const onAdd = edit?.onAdd;
  const theme = useTheme();
  const { t } = useTranslation();

  if (images.length === 0 && uploadingCount === 0) {
    if (!canEdit) return null;

    return (
      <Pressable
        testID="hike-images-empty"
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={t("hike.addImages")}
        style={({ pressed }) => [
          s.empty,
          { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface },
          pressed && s.pressed,
        ]}
      >
        <Icon source="image-plus" size={28} color={theme.colors.primary} />
        <Text style={[s.emptyTitle, { color: theme.colors.onSurface }]}>{t("hike.addImages")}</Text>
        <Text style={[s.emptyHint, { color: theme.colors.onSurfaceVariant }]}>{t("hike.addImagesHint", { max })}</Text>
      </Pressable>
    );
  }

  const canAddMore = canEdit && images.length + uploadingCount < max;

  return (
    <Surface testID="hike-images" elevation={0} style={[s.card, { backgroundColor: theme.colors.surface }]}>
      <View style={s.headerRow}>
        <Text style={[s.title, { color: theme.colors.onSurface }]}>{t("hike.images")}</Text>
        {canEdit && (
          <Text testID="hike-images-count" style={[s.count, { color: theme.colors.onSurfaceVariant }]}>
            {images.length}/{max}
          </Text>
        )}
        <View style={s.spacer} />
        {canAddMore && (
          <Button
            testID="hike-images-add"
            mode="text"
            icon="plus"
            compact
            onPress={onAdd}
            disabled={uploadingCount > 0}
          >
            {t("hike.addImage")}
          </Button>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
        {images.map((image, index) => (
          <Pressable
            key={image.identifier}
            testID="hike-image-thumb"
            onPress={() => onOpen(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={t("hike.openImage", { index: index + 1, count: images.length })}
          >
            <Image source={{ uri: image.imageUrl }} contentFit="cover" style={s.thumb} />
          </Pressable>
        ))}
        {Array.from({ length: uploadingCount }, (_, i) => (
          <View
            key={`uploading-${i}`}
            testID="hike-image-uploading"
            accessibilityLabel={t("hike.uploadingImage")}
            style={[s.thumb, s.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ))}
      </ScrollView>
    </Surface>
  );
}

const s = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  emptyTitle: {
    fontWeight: "600",
    fontSize: 15,
  },
  emptyHint: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    paddingVertical: 14,
    borderRadius: SURFACE_BORDER_RADIUS,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 20,
    paddingRight: 8,
    minHeight: 36,
  },
  title: {
    fontWeight: "700",
    fontSize: 15,
  },
  count: {
    fontSize: 13,
  },
  spacer: {
    flex: 1,
  },
  strip: {
    gap: 10,
    paddingHorizontal: 20,
  },
  thumb: {
    width: THUMB_WIDTH,
    aspectRatio: 3 / 4,
    borderRadius: BORDER_RADIUS,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
