// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/alert-dialog";
import { ZOOM_TYPE, Zoomable } from "@likashefqet/react-native-image-zoom";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Icon, Modal, Portal, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ViewerImage {
  identifier: string;
  imageUrl: string;
}

interface ModalProps {
  images: ViewerImage[];
  visible: boolean;
  onDismiss: (lastIndex: number) => void;
  initialIndex?: number;
  onDelete?: (image: ViewerImage) => Promise<unknown>;
  deleteNotes?: string[];
  onReport?: (image: ViewerImage) => void;
}

const DOT_SIZE = 8;
const DOT_SPACING = 8;
const DOT_INDICATOR_SIZE = DOT_SIZE + DOT_SPACING;
const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;

export default function ImageViewer({
  images,
  visible,
  onDismiss,
  initialIndex,
  onDelete,
  deleteNotes = [],
  onReport,
}: ModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: itemWidth, height: itemHeight } = useWindowDimensions();
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(initialIndex ?? 0);
  const [wasVisible, setWasVisible] = useState(visible);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // keep-comment: set during render, not in an effect, so the list mounts on the tapped picture
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setZoomed(false);
    if (visible && initialIndex !== undefined) setCurrentIndex(initialIndex);
  }

  useEffect(() => {
    scrollX.setValue(currentIndex * itemWidth);
  }, [currentIndex, itemWidth, scrollX]);

  const lastIndex = Math.max(0, Math.min(currentIndex, images.length - 1));
  const current = images[lastIndex];
  const close = () => onDismiss(lastIndex);

  const confirmDelete = async () => {
    setShowDeleteDialog(false);
    if (!onDelete || !current) return;
    const remaining = images.length - 1;
    try {
      await onDelete(current);
    } catch {
      return;
    }
    if (remaining === 0) onDismiss(0);
    else setCurrentIndex((index) => Math.min(index, remaining - 1));
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / itemWidth);
    setCurrentIndex(index);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={close} style={s.fullScreen} contentContainerStyle={s.surface}>
        {visible && <StatusBar style="light" />}
        {/* keep-comment: Paper's iOS Surface drops flex on its inner layer for a Modal, so the frame needs a fixed size */}
        <View testID="review-image-frame" style={{ width: itemWidth, height: itemHeight }}>
          <Animated.FlatList
            testID="review-image-list"
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            keyExtractor={(image) => image.identifier}
            data={images}
            initialScrollIndex={currentIndex}
            getItemLayout={(_, index) => ({
              length: itemWidth,
              offset: itemWidth * index,
              index,
            })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
            renderItem={({ item }) => (
              <View testID="review-image-item" style={{ width: itemWidth, height: itemHeight }}>
                <Zoomable
                  style={s.zoomable}
                  maxScale={MAX_ZOOM}
                  doubleTapScale={DOUBLE_TAP_ZOOM}
                  isDoubleTapEnabled
                  onPinchStart={() => setZoomed(true)}
                  onDoubleTap={(type) => setZoomed(type === ZOOM_TYPE.ZOOM_IN)}
                  onResetAnimationEnd={() => setZoomed(false)}
                >
                  <Image source={item.imageUrl} contentFit="contain" style={s.image} />
                </Zoomable>
              </View>
            )}
          />
          <Pressable
            testID="image-viewer-close"
            hitSlop={12}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            style={[s.cornerButton, { top: insets.top + 8, left: 12 }]}
          >
            <Icon size={26} source="close" color="#fff" />
          </Pressable>
          {onDelete && current && (
            <Pressable
              testID="image-viewer-delete"
              hitSlop={12}
              onPress={() => setShowDeleteDialog(true)}
              accessibilityRole="button"
              accessibilityLabel={t("common.delete")}
              style={[s.cornerButton, { top: insets.top + 8, right: 12 }]}
            >
              <Icon size={24} source="delete" color={theme.colors.error} />
            </Pressable>
          )}
          {!onDelete && onReport && current && (
            <Pressable
              testID="image-viewer-report"
              hitSlop={12}
              onPress={() => onReport(current)}
              accessibilityRole="button"
              accessibilityLabel={t("report.title")}
              style={[s.cornerButton, { top: insets.top + 8, right: 12 }]}
            >
              <Icon size={24} source="alert-circle" color="#fff" />
            </Pressable>
          )}
          {images.length > 1 && !zoomed && (
            <View testID="review-image-pagination" style={[s.pagination, { bottom: insets.bottom + 24 }]}>
              {images.map((_, index) => (
                <View
                  key={index}
                  testID="review-image-dot"
                  style={[s.dot, { backgroundColor: theme.colors.tertiary }]}
                />
              ))}
              <Animated.View
                testID="review-image-indicator"
                style={[
                  s.dotIndicator,
                  {
                    borderColor: theme.colors.primary,
                    transform: [
                      {
                        translateX: scrollX.interpolate({
                          inputRange: images.map((_, i) => i * itemWidth),
                          outputRange: images.map((_, i) => i * DOT_INDICATOR_SIZE),
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
          )}
        </View>
      </Modal>
      <AlertDialog
        visible={showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        title={t("hike.deleteImageTitle")}
        infoText={[t("hike.deleteImageConfirm"), ...deleteNotes]}
        textColor={theme.colors.onSurface}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        onConfirm={confirmDelete}
        backgroundColor={theme.colors.surface}
      />
    </Portal>
  );
}

const s = StyleSheet.create({
  fullScreen: {
    marginTop: 0,
    marginBottom: 0,
  },
  surface: {
    flex: 1,
    backgroundColor: "#000",
  },
  zoomable: {
    flex: 1,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  cornerButton: {
    position: "absolute",
    zIndex: 1,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  pagination: {
    position: "absolute",
    flexDirection: "row",
    alignSelf: "center",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE,
    marginRight: DOT_SPACING,
  },
  dotIndicator: {
    width: DOT_INDICATOR_SIZE,
    height: DOT_INDICATOR_SIZE,
    borderRadius: DOT_INDICATOR_SIZE,
    borderWidth: 2,
    position: "absolute",
    top: -DOT_SPACING / 2,
    left: -DOT_SPACING / 2,
  },
});
