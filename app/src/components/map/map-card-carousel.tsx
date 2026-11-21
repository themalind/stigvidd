// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING } from "@/constants/constants";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";
import MapOverlayDismissButton from "./map-overlay-dismiss-button";

export interface CarouselCardLayout {
  width: number;
  // keep-comment: "2/3", only when there is more than one card
  position?: string;
  active: boolean;
}

interface Props<T> {
  items: readonly T[];
  // keep-comment: changes on each tap that opens the carousel; compared by identity, so new
  // keep-comment: data for the same opening (a refetch after a vote) keeps the card that is showing
  opening: unknown;
  keyOf: (item: T) => string;
  // keep-comment: keep it stable (useCallback), or every card re-renders on each swipe
  renderCard: (item: T, layout: CarouselCardLayout) => ReactElement;
  onClose: () => void;
  onActiveChange?: (key: string) => void;
  // keep-comment: the covered height, so the map can lift its attribution clear of the cards
  onMeasure?: (coveredHeight: number) => void;
  bottomOffset: number;
  testID?: string;
}

// keep-comment: a sliver of the next card shows that the list scrolls
const PEEK = 44;

export default function MapCardCarousel<T>({
  items,
  opening,
  keyOf,
  renderCard,
  onClose,
  onActiveChange,
  onMeasure,
  bottomOffset,
  testID = "carousel",
}: Props<T>) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<T>>(null);

  const multiple = items.length > 1;
  const cardWidth = windowWidth - SCREEN_PADDING * 2 - (multiple ? PEEK : 0);
  const snapInterval = cardWidth + SCREEN_PADDING;

  // keep-comment: a new opening starts at its first card, or the list keeps the old index ("3/4")
  const [shownOpening, setShownOpening] = useState(opening);
  if (opening !== shownOpening) {
    setShownOpening(opening);
    setActiveIndex(0);
  }
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [opening]);

  const activeItem = items[activeIndex];
  const activeKey = activeItem === undefined ? undefined : keyOf(activeItem);
  useEffect(() => {
    if (activeKey !== undefined) onActiveChange?.(activeKey);
  }, [activeKey, onActiveChange]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
    setActiveIndex(Math.max(0, Math.min(index, items.length - 1)));
  };

  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) =>
      renderCard(item, {
        width: cardWidth,
        position: items.length > 1 ? `${index + 1}/${items.length}` : undefined,
        active: index === activeIndex,
      }),
    [renderCard, cardWidth, items.length, activeIndex],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<T> | null | undefined, index: number) => ({
      length: cardWidth,
      offset: SCREEN_PADDING + index * snapInterval,
      index,
    }),
    [cardWidth, snapInterval],
  );

  return (
    <View
      testID={testID}
      style={[s.wrapper, { bottom: bottomOffset }]}
      onLayout={(e) => onMeasure?.(e.nativeEvent.layout.height + bottomOffset)}
    >
      <MapOverlayDismissButton onPress={onClose} />
      <FlatList
        testID={`${testID}-list`}
        ref={listRef}
        data={items}
        keyExtractor={keyOf}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={s.listContent}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
      />
      {multiple && (
        <View style={s.dots}>
          {items.map((item, i) => (
            <View
              key={keyOf(item)}
              testID={`${testID}-dot`}
              style={[
                s.dot,
                {
                  width: i === activeIndex ? 18 : 6,
                  backgroundColor: i === activeIndex ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  listContent: {
    paddingHorizontal: SCREEN_PADDING,
    gap: SCREEN_PADDING,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
