// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ExampleImageOverlay from "@/components/example-image-overlay";
import { BORDER_RADIUS } from "@/constants/constants";
import { TrailImage } from "@/data/types";
import { useIsOnline } from "@/hooks/useIsOnline";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useTheme } from "react-native-paper";

interface GalleryProps {
  images: TrailImage[];
}

export default function ImageGallery({ images }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState(images[0]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const ITEM_WIDTH = 80;
  const GAP = 15;
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

  const handleImagePress = (image: TrailImage, index: number) => {
    setSelectedImage(image);
    setCurrentIndex(index);
    retryFailed();

    // Scrolla till den valda bilden
    scrollViewRef.current?.scrollTo({
      x: index * (ITEM_WIDTH + GAP),
      animated: true,
    });
  };

  return (
    <View style={s.container}>
      <View style={s.focusImageConatiner}>
        {selectedImage && (
          <Image
            key={keyFor(selectedImage.imageUrl)}
            testID="gallery-focus-image"
            source={selectedImage.imageUrl}
            style={s.focusImage}
            contentFit="cover"
            onLoad={() => handleLoad(selectedImage.imageUrl)}
            onError={() => markFailed(selectedImage.imageUrl)}
          />
        )}
        {selectedImage && <ExampleImageOverlay source={selectedImage.imageUrl} />}
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={s.scrollView}
          horizontal
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH + GAP}
          decelerationRate="fast"
        >
          {images.map((image, index) => (
            <Pressable key={image.identifier} onPress={() => handleImagePress(image, index)}>
              <View>
                <Image
                  key={keyFor(image.imageUrl)}
                  testID={`gallery-thumb-${index}`}
                  source={image.imageUrl}
                  style={s.scrollImage}
                  contentFit="cover"
                  onLoad={() => handleLoad(image.imageUrl)}
                  onError={() => markFailed(image.imageUrl)}
                />
                <ExampleImageOverlay source={image.imageUrl} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
        {images.length > 1 && (
          <View style={s.paginationContainer}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  s.dots,
                  {
                    backgroundColor: currentIndex === index ? theme.colors.tertiary : theme.colors.onBackground,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  focusImageConatiner: {
    marginBottom: 20,
  },
  focusImage: {
    height: 300,
    width: 350,
    borderRadius: BORDER_RADIUS,
  },
  scrollImage: {
    height: 90,
    width: 60,
    borderRadius: BORDER_RADIUS,
  },
  scrollView: {
    gap: 15,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  dots: {
    width: 8,
    height: 8,
    borderRadius: BORDER_RADIUS,
    marginHorizontal: 4,
  },
});
