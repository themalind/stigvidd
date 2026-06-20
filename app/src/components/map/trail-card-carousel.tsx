import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { TrailCard } from "@/data/types";
import { useTrailCards } from "@/hooks/useTrailCard";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Text, useTheme } from "react-native-paper";

interface Props {
  identifiers: string[];
  onClose: () => void;
  onReadMore: (identifier: string) => void;
  onShowOnMap: (identifier: string) => void;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
// Leave a sliver of the next card visible (peek) so it's obvious the list scrolls.
const PEEK = 44;
const CARD_WIDTH = SCREEN_WIDTH - SCREEN_PADDING * 2 - PEEK;
const SNAP_INTERVAL = CARD_WIDTH + SCREEN_PADDING;
// A lone card has no next card to peek at, so it fills the width (minus padding)
// and reads as centered instead of left-aligned with an empty gap.
const SINGLE_CARD_WIDTH = SCREEN_WIDTH - SCREEN_PADDING * 2;

export default function TrailCardCarousel({ identifiers, onClose, onReadMore, onShowOnMap }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const multiple = identifiers.length > 1;
  const cardWidth = multiple ? CARD_WIDTH : SINGLE_CARD_WIDTH;

  // One batched fetch for the whole cluster instead of one request per card.
  const { cards, isError, refetch } = useTrailCards(identifiers);

  // Reset to the first card whenever a different cluster is opened — otherwise the
  // list keeps its previous scroll offset / index (e.g. lands on "3/4").
  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [identifiers]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveIndex(Math.max(0, Math.min(index, identifiers.length - 1)));
  };

  // Stable renderItem + memoized cards: scrolling only changes activeIndex (the
  // dots), so without this every card — and its <Image> — would re-render on each
  // scroll. Cards depend only on the identifier list and the (stable) callbacks.
  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <CarouselCard
        identifier={item}
        card={cards[item]}
        cardWidth={cardWidth}
        isError={isError}
        onRetry={refetch}
        position={identifiers.length > 1 ? `${index + 1}/${identifiers.length}` : undefined}
        onReadMore={onReadMore}
        onShowOnMap={onShowOnMap}
      />
    ),
    [cards, cardWidth, isError, refetch, identifiers.length, onReadMore, onShowOnMap],
  );

  // Fixed-width cards → give the list their geometry so it doesn't measure them.
  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: cardWidth,
      offset: SCREEN_PADDING + index * SNAP_INTERVAL,
      index,
    }),
    [cardWidth],
  );

  return (
    <View style={[s.wrapper, { bottom: insets.bottom + 16 }]}>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={10}
        style={[s.dismissButton, { backgroundColor: theme.colors.surface }]}
      >
        <MaterialIcons name="keyboard-arrow-down" size={24} color={theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
      <FlatList
        ref={listRef}
        data={identifiers}
        keyExtractor={(id) => id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
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
          {identifiers.map((id, i) => (
            <View
              key={id}
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

const CarouselCard = memo(function CarouselCard({
  identifier,
  card,
  cardWidth,
  isError,
  onRetry,
  position,
  onReadMore,
  onShowOnMap,
}: {
  identifier: string;
  card?: TrailCard;
  cardWidth: number;
  isError: boolean;
  onRetry: () => void;
  position?: string;
  onReadMore: (identifier: string) => void;
  onShowOnMap: (identifier: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[s.card, { width: cardWidth, backgroundColor: theme.colors.surface }]}>
      {!card && isError ? (
        // The batched fetch failed and this card has no cached data — offer a retry
        // instead of an indefinite spinner.
        <View style={s.stateBox}>
          <Text style={[s.errorText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
            {t("map.cardError")}
          </Text>
          <TouchableOpacity
            style={[s.button, s.retryButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={onRetry}
          >
            <MaterialIcons name="refresh" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={[s.buttonText, { color: theme.colors.onSurfaceVariant }]}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : !card ? (
        <ActivityIndicator style={s.loader} color={theme.colors.primary} />
      ) : (
        <>
          <View style={s.header}>
            {card.image && <Image source={{ uri: card.image.imageUrl }} style={s.image} contentFit="cover" />}
            <View style={s.meta}>
              <Text style={s.name} numberOfLines={1}>
                {card.name}
              </Text>
              <View style={s.infoRow}>
                {card.trailLength != null && (
                  <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>{card.trailLength} km</Text>
                )}
                <View style={s.difficultyRow}>
                  {getDifficultyIcon(classificationParser(card.classification ?? 0))}
                  <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>
                    {classificationParser(card.classification ?? 0)}
                  </Text>
                </View>
                <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>
                  {Number(card.averageRating) > 0 ? `★ ${Number(card.averageRating).toFixed(1)}` : t("review.noReviews")}
                </Text>
              </View>
            </View>
            {position && <Text style={[s.counter, { color: theme.colors.onSurfaceVariant }]}>{position}</Text>}
          </View>
          <View style={s.buttonRow}>
            <TouchableOpacity
              style={[s.button, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => onReadMore(identifier)}
            >
              <Text style={[s.buttonText, { color: theme.colors.onSurfaceVariant }]}>{t("map.readMore")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.button, { backgroundColor: theme.colors.primaryContainer }]}
              onPress={() => onShowOnMap(identifier)}
            >
              <MaterialIcons name="map" size={16} color={theme.colors.onPrimaryContainer} />
              <Text style={[s.buttonText, { color: theme.colors.onPrimaryContainer }]}>{t("map.showOnMap")}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
});

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
  card: {
    borderRadius: SURFACE_BORDER_RADIUS,
    padding: 14,
    gap: 10,
    minHeight: 130,
    justifyContent: "center",
  },
  loader: {
    paddingVertical: 8,
  },
  stateBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
  },
  retryButton: {
    flex: 0,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: SURFACE_BORDER_RADIUS,
    flexShrink: 0,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  difficultyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoText: {
    fontSize: 13,
  },
  counter: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    paddingLeft: 4,
  },
  dismissButton: {
    alignSelf: "center",
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
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
