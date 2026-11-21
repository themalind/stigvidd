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
  // keep-comment: keep it stable (useCallback) and return a memo card; a swipe re-renders only the cards whose
  // keep-comment: layout changed (active), since the list calls it again for each row
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
  const [settledKey, setSettledKey] = useState<string>();
  const listRef = useRef<FlatList<T>>(null);

  const multiple = items.length > 1;
  const cardWidth = windowWidth - SCREEN_PADDING * 2 - (multiple ? PEEK : 0);
  const snapInterval = cardWidth + SCREEN_PADDING;

  // keep-comment: a new opening starts at its first card, or the list keeps the old card ("3/4")
  const [shownOpening, setShownOpening] = useState(opening);
  if (opening !== shownOpening) {
    setShownOpening(opening);
    setSettledKey(undefined);
  }

  // keep-comment: held by key, not position, so a card dropped by a refetch never moves the reader onto
  // keep-comment: its neighbour; the reader of the dropped card itself is moved to the first card, for good
  const keys = items.map(keyOf);
  if (settledKey !== undefined && !keys.includes(settledKey)) setSettledKey(keys[0]);
  const activeIndex = settledKey === undefined ? 0 : Math.max(keys.indexOf(settledKey), 0);
  const activeKey = keys[activeIndex];

  // keep-comment: the offset the list rests at, in pixels, so a new card width also counts as out of place
  const listOffsetRef = useRef(0);
  // keep-comment: begin and end drag always come in pairs, unlike the momentum events
  const draggingRef = useRef(false);

  // keep-comment: the list follows the card held when it moves without a swipe (a new opening, cards dropped
  // keep-comment: before it, a new width), but never under a finger
  useEffect(() => {
    const offset = activeIndex * snapInterval;
    if (offset === listOffsetRef.current || draggingRef.current) return;
    listOffsetRef.current = offset;
    listRef.current?.scrollToOffset({ offset, animated: false });
  }, [activeIndex, snapInterval]);

  useEffect(() => {
    if (activeKey !== undefined) onActiveChange?.(activeKey);
  }, [activeKey, onActiveChange]);

  // keep-comment: settles on letting go too, since iOS sends no momentum end when a finger stops a fling
  const settleAt = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / snapInterval), keys.length - 1));
    listOffsetRef.current = index * snapInterval;
    setSettledKey(keys[index]);
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
        onScrollBeginDrag={() => (draggingRef.current = true)}
        onScrollEndDrag={(e) => {
          draggingRef.current = false;
          settleAt(e);
        }}
        onMomentumScrollEnd={settleAt}
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
