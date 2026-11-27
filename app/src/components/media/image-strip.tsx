// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ImageViewer, { ViewerImage } from "@/components/media/image-viewer";
import { BORDER_RADIUS, IMAGE_CHIP_BACKGROUND, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Image } from "expo-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Icon, Surface, useTheme } from "react-native-paper";

const THUMB_WIDTH = 104;
const REMOVE_SIZE = 28;

interface Props {
  images: ViewerImage[];
  title?: string;
  // keep-comment: plain drops the card, for a strip inside something that already is one
  variant?: "card" | "plain";
  onReport?: (image: ViewerImage) => void;
  edit?: {
    max: number;
    emptyHint: string;
    uploadingCount?: number;
    onAdd: () => void;
    onRemove: (image: ViewerImage) => void;
  };
}

export default function ImageStrip({ images, title, variant = "card", onReport, edit }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const uploadingCount = edit?.uploadingCount ?? 0;

  if (images.length === 0 && uploadingCount === 0) {
    if (!edit) return null;

    return (
      <Pressable
        testID="image-strip-empty"
        onPress={edit.onAdd}
        accessibilityRole="button"
        accessibilityLabel={t("images.addImages")}
        style={({ pressed }) => [
          s.empty,
          { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface },
          pressed && s.pressed,
        ]}
      >
        <Icon source="image-plus" size={28} color={theme.colors.primary} />
        <Text style={[s.emptyTitle, { color: theme.colors.onSurface }]}>{t("images.addImages")}</Text>
        <Text style={[s.emptyHint, { color: theme.colors.onSurfaceVariant }]}>{edit.emptyHint}</Text>
      </Pressable>
    );
  }

  const canAddMore = edit !== undefined && images.length + uploadingCount < edit.max;
  const plain = variant === "plain";

  return (
    <Surface
      testID="image-strip"
      elevation={0}
      style={[plain ? s.plain : s.card, { backgroundColor: theme.colors.surface }]}
    >
      {(title !== undefined || edit) && (
        <View style={s.headerRow}>
          {title !== undefined && <Text style={[s.title, { color: theme.colors.onSurface }]}>{title}</Text>}
          {edit && (
            <Text testID="image-strip-count" style={[s.count, { color: theme.colors.onSurfaceVariant }]}>
              {images.length}/{edit.max}
            </Text>
          )}
          <View style={s.spacer} />
          {canAddMore && (
            <Button
              testID="image-strip-add"
              mode="text"
              icon="plus"
              compact
              onPress={edit.onAdd}
              disabled={uploadingCount > 0}
            >
              {t("images.add")}
            </Button>
          )}
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.strip, !plain && s.stripInset]}
      >
        {images.map((image, index) => (
          <View key={image.identifier} testID="image-strip-item">
            <Pressable
              testID="image-strip-thumb"
              onPress={() => setViewerIndex(index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={t("images.openImage", { index: index + 1, count: images.length })}
            >
              <Image source={{ uri: image.imageUrl }} contentFit="cover" style={s.thumb} />
            </Pressable>
            {edit && (
              <Pressable
                testID="image-strip-remove"
                onPress={() => edit.onRemove(image)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("images.removeImage", { index: index + 1, count: images.length })}
                style={s.remove}
              >
                <Icon source="close" size={16} color="#fff" />
              </Pressable>
            )}
          </View>
        ))}
        {Array.from({ length: uploadingCount }, (_, i) => (
          <View
            key={`uploading-${i}`}
            testID="image-strip-uploading"
            accessibilityLabel={t("images.uploadingImage")}
            style={[s.thumb, s.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ))}
      </ScrollView>
      <ImageViewer
        images={images}
        visible={viewerIndex !== null}
        initialIndex={viewerIndex ?? 0}
        onDismiss={() => setViewerIndex(null)}
        onReport={
          onReport &&
          ((image) => {
            setViewerIndex(null);
            onReport(image);
          })
        }
      />
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
  plain: {
    marginTop: 10,
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
  },
  stripInset: {
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
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: IMAGE_CHIP_BACKGROUND,
  },
});
