// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ExampleImageOverlay from "@/components/media/example-image-overlay";
import { SLIM_BUTTON_HEIGHT, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { TrailCard } from "@/data/types";
import { useTrailCards } from "@/hooks/trail/useTrailCard";
import { useTrailCoordinates } from "@/hooks/trail/useTrailCoordinates";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/components/display/difficulty-icon";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Icon, Text, useTheme } from "react-native-paper";
import { Rating } from "../review/rating";
import MapCardCarousel, { type CarouselCardLayout } from "./map-card-carousel";

interface Props {
  identifiers: string[];
  onClose: () => void;
  onReadMore: (identifier: string) => void;
  onShowOnMap: (identifier: string) => void;
  // keep-comment: the covered height, so the map can lift its attribution clear of cards of varying height
  onMeasure?: (coveredHeight: number) => void;
}

// No safe-area offset: the tab bar already clears the home indicator. keep-comment: hidden layout dependency
const BOTTOM_OFFSET = 16;

function identity(identifier: string) {
  return identifier;
}

export default function TrailCardCarousel({ identifiers, onClose, onReadMore, onShowOnMap, onMeasure }: Props) {
  const { cards, isError, notFound, refetch } = useTrailCards(identifiers);

  const [shown, setShown] = useState<{ cluster: string[]; identifier: string }>();
  const reportShown = useCallback(
    (identifier: string) => setShown({ cluster: identifiers, identifier }),
    [identifiers],
  );
  // keep-comment: another cluster shows its first card from the first render, before the carousel reports it
  const activeIdentifier = shown?.cluster === identifiers ? shown.identifier : identifiers[0];
  // keep-comment: warms the cache "Se på karta" reads; only for a card that loaded, so a deleted trail is not fetched
  useTrailCoordinates(activeIdentifier, { enabled: !!activeIdentifier && !!cards[activeIdentifier] });

  const renderCard = useCallback(
    (identifier: string, { width, position }: CarouselCardLayout) => (
      <CarouselCard
        identifier={identifier}
        card={cards[identifier]}
        cardWidth={width}
        isError={isError}
        isNotFound={notFound.has(identifier)}
        onRetry={refetch}
        position={position}
        onReadMore={onReadMore}
        onShowOnMap={onShowOnMap}
      />
    ),
    [cards, isError, notFound, refetch, onReadMore, onShowOnMap],
  );

  return (
    <MapCardCarousel
      items={identifiers}
      opening={identifiers}
      keyOf={identity}
      renderCard={renderCard}
      onClose={onClose}
      onActiveChange={reportShown}
      onMeasure={onMeasure}
      bottomOffset={BOTTOM_OFFSET}
    />
  );
}

const CarouselCard = memo(function CarouselCard({
  identifier,
  card,
  cardWidth,
  isError,
  isNotFound,
  onRetry,
  position,
  onReadMore,
  onShowOnMap,
}: {
  identifier: string;
  card?: TrailCard;
  cardWidth: number;
  isError: boolean;
  isNotFound: boolean;
  onRetry: () => void;
  position?: string;
  onReadMore: (identifier: string) => void;
  onShowOnMap: (identifier: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      testID={`carousel-card-${identifier}`}
      style={[s.card, { width: cardWidth, backgroundColor: theme.colors.surface }]}
    >
      {!card && isNotFound ? (
        // keep-comment: the trail was removed after its marker loaded, so there is nothing to retry
        <View style={s.stateBox}>
          <Text style={[s.errorText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
            {t("map.cardNotFound")}
          </Text>
        </View>
      ) : !card && isError ? (
        <View style={s.stateBox}>
          <Text style={[s.errorText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
            {t("map.cardError")}
          </Text>
          <Pressable
            style={({ pressed }) => [
              s.button,
              s.retryButton,
              { backgroundColor: theme.colors.surfaceVariant },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onRetry}
          >
            <MaterialIcons name="refresh" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={[s.buttonText, { color: theme.colors.onSurfaceVariant }]}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : !card ? (
        <ActivityIndicator style={s.loader} color={theme.colors.primary} />
      ) : (
        <>
          <View style={s.header}>
            {card.image && (
              <View>
                <Image source={{ uri: card.image.imageUrl }} style={s.image} contentFit="cover" />
                <ExampleImageOverlay source={{ uri: card.image.imageUrl }} />
              </View>
            )}
            <View style={s.meta}>
              {card.contribution && (
                <View testID="carousel-contribution" style={s.contributionRow}>
                  <Icon source="account-group" size={14} color={theme.colors.primary} />
                  <Text style={[s.contributionText, { color: theme.colors.primary }]}>{t("trail.contributed")}</Text>
                </View>
              )}
              <Text style={s.name} numberOfLines={1}>
                {card.name}
              </Text>
              <View style={s.infoRow}>
                <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>{card.trailLength} km</Text>
                <View style={s.difficultyRow}>
                  {getDifficultyIcon(classificationParser(card.classification))}
                  <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>
                    {classificationParser(card.classification)}
                  </Text>
                </View>
                <Rating
                  averageRating={Number(card.averageRating)}
                  starColor={theme.colors.onSurfaceVariant}
                  textStyle={[s.infoText, { color: theme.colors.onSurfaceVariant }]}
                />
              </View>
            </View>
            {position && <Text style={[s.counter, { color: theme.colors.onSurfaceVariant }]}>{position}</Text>}
          </View>
          <View style={s.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                s.button,
                { backgroundColor: theme.colors.surfaceVariant },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => onReadMore(identifier)}
            >
              <Text style={[s.buttonText, { color: theme.colors.onSurfaceVariant }]}>{t("map.readMore")}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                s.button,
                { backgroundColor: theme.colors.primaryContainer },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => onShowOnMap(identifier)}
            >
              <MaterialIcons name="map" size={16} color={theme.colors.onPrimaryContainer} />
              <Text style={[s.buttonText, { color: theme.colors.onPrimaryContainer }]}>{t("map.showOnMap")}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
});

const s = StyleSheet.create({
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
  contributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  contributionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
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
    height: SLIM_BUTTON_HEIGHT,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
