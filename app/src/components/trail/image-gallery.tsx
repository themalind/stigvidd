// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ExampleImageOverlay from "@/components/example-image-overlay";
import ImageViewer from "@/components/review/image-viewer";
import { BORDER_RADIUS } from "@/constants/constants";
import { TrailImage } from "@/data/types";
import { useIsOnline } from "@/hooks/useIsOnline";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useTheme } from "react-native-paper";

interface GalleryProps {
  images: TrailImage[];
}

const FOCUS_HEIGHT = 300;
const THUMB_WIDTH = 60;
const GAP = 15;

export default function ImageGallery({ images }: GalleryProps) {
  const [index, setIndex] = useState(0);
  const currentIndex = Math.min(index, Math.max(images.length - 1, 0));
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const [viewerOpen, setViewerOpen] = useState(false);
  const pagerRef = useRef<FlatList<TrailImage>>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const isOnline = useIsOnline();

  // expo-image never retries a failed load, so a failed URL is remounted under a new key. keep-comment: hidden library behaviour
  const [failed, setFailed] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<Record<string, number>>({});

  const markFailed = useCallback((url: string) => {
    setFailed((prev) => (prev.includes(url) ? prev : [...prev, url]));
  }, []);

  const retryFailed = useCallback(() => {
    if (failed.length === 0) return;
    setAttempts((prev) => {
      const next = { ...prev };
      for (const url of failed) next[url] = (next[url] ?? 0) + 1;
      return next;
    });
    setFailed([]);
  }, [failed]);

  // Any image that loads proves the connection works again; so does a reconnect. keep-comment: retry trigger
  const handleLoad = useCallback(
    (url: string) => {
      if (!failed.includes(url)) retryFailed();
    },
    [failed, retryFailed],
  );

  const retryFailedRef = useRef(retryFailed);
  retryFailedRef.current = retryFailed;
  useEffect(() => {
    if (isOnline) retryFailedRef.current();
  }, [isOnline]);

  const keyFor = (url: string) => `${url}#${attempts[url] ?? 0}`;

  useEffect(() => {
    scrollViewRef.current?.scrollTo({
      x: Math.max(0, currentIndex * (THUMB_WIDTH + GAP) - (width - THUMB_WIDTH) / 2),
      animated: true,
    });
  }, [currentIndex, width]);

  const handleThumbPress = (thumbIndex: number) => {
    setIndex(thumbIndex);
    retryFailed();
    pagerRef.current?.scrollToIndex({ index: thumbIndex, animated: true });
  };

  const handleSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const handleViewerClose = (lastIndex: number) => {
    setViewerOpen(false);
    setIndex(lastIndex);
    pagerRef.current?.scrollToIndex({ index: lastIndex, animated: false });
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    if (measured > 0 && measured !== width) setWidth(measured);
  };

  return (
    <View style={s.container} onLayout={handleLayout}>
      <FlatList
        ref={pagerRef}
        testID="gallery-pager"
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleSwipeEnd}
        keyExtractor={(image) => image.identifier}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={s.pager}
        renderItem={({ item, index: pageIndex }) => (
          <Pressable
            testID={`gallery-page-button-${pageIndex}`}
            accessibilityRole="imagebutton"
            onPress={() => setViewerOpen(true)}
            style={{ width }}
          >
            <Image
              key={keyFor(item.imageUrl)}
              testID={`gallery-page-${pageIndex}`}
              source={item.imageUrl}
              style={[s.focusImage, { width }]}
              contentFit="cover"
              onLoad={() => handleLoad(item.imageUrl)}
              onError={() => markFailed(item.imageUrl)}
            />
            <ExampleImageOverlay source={item.imageUrl} />
          </Pressable>
        )}
      />
      <ImageViewer images={images} visible={viewerOpen} initialIndex={currentIndex} onDismiss={handleViewerClose} />
      {images.length > 1 && (
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={s.thumbRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {images.map((image, thumbIndex) => {
            const active = thumbIndex === currentIndex;
            return (
              <Pressable
                key={image.identifier}
                testID={`gallery-thumb-button-${thumbIndex}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => handleThumbPress(thumbIndex)}
              >
                <View style={!active && s.inactiveThumb}>
                  <Image
                    key={keyFor(image.imageUrl)}
                    testID={`gallery-thumb-${thumbIndex}`}
                    source={image.imageUrl}
                    style={s.thumb}
                    contentFit="cover"
                    onLoad={() => handleLoad(image.imageUrl)}
                    onError={() => markFailed(image.imageUrl)}
                  />
                  <ExampleImageOverlay source={image.imageUrl} />
                  {active && <View style={[s.activeBorder, { borderColor: theme.colors.tertiary }]} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    gap: 20,
  },
  pager: {
    borderRadius: BORDER_RADIUS,
  },
  focusImage: {
    height: FOCUS_HEIGHT,
    borderRadius: BORDER_RADIUS,
  },
  thumbRow: {
    gap: GAP,
  },
  thumb: {
    height: 90,
    width: THUMB_WIDTH,
    borderRadius: BORDER_RADIUS,
  },
  inactiveThumb: {
    opacity: 0.6,
  },
  activeBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS,
  },
});
