// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ExampleImageOverlay from "@/components/example-image-overlay";
import { Rating } from "@/components/review/rating";
import ShimmerBlock from "@/components/skeletons/shimmer-block";
import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { TrailShortInfoResponse } from "@/data/types";
import { useTrailCard } from "@/hooks/useTrailCard";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, { FadeIn } from "react-native-reanimated";

const IMAGE_HEIGHT = 150;

interface Props {
  trail: TrailShortInfoResponse;
  onOpen: () => void;
  onReroll: () => void;
}

// The drawn trail. Only the photo and the rating wait on the card fetch, so the shimmer
// covers the image alone.
export default function AdventureReveal({ trail, onOpen, onReroll }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { card, isLoading } = useTrailCard(trail.identifier);

  const difficulty = classificationParser(trail.classification);
  const imageSource = card?.image ? { uri: card.image.imageUrl } : require("../../assets/images/noImage.png");

  return (
    // Keyed on the identifier so each draw fades in as its own card.
    <Animated.View key={trail.identifier} entering={FadeIn.duration(220)} testID="adventure-reveal" style={s.wrapper}>
      <Pressable
        testID="adventure-reveal-card"
        onPress={onOpen}
        style={({ pressed }) => [s.card, { backgroundColor: theme.colors.surface }, pressed && { opacity: 0.85 }]}
      >
        {isLoading && !card ? (
          <ShimmerBlock style={s.image} />
        ) : (
          <View style={s.imageWrapper}>
            <Image source={imageSource} style={s.image} contentFit="cover" cachePolicy="disk" />
            <ExampleImageOverlay source={imageSource} />
          </View>
        )}
        <View style={s.body}>
          {/* The rating owns its line: "Inga recensioner" is as wide as a trail name. */}
          <Text style={[s.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {trail.name}
          </Text>
          {card ? (
            <Rating
              averageRating={Number(card.averageRating)}
              starColor={theme.colors.onSurfaceVariant}
              textStyle={[s.meta, { color: theme.colors.onSurfaceVariant }]}
            />
          ) : null}
          <View style={s.metaRow}>
            <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
              {trail.city}
            </Text>
            <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]}>{trail.trailLength} km</Text>
            <View style={s.difficultyRow}>
              {getDifficultyIcon(difficulty)}
              <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]}>{difficulty}</Text>
            </View>
            {trail.accessibility ? (
              <MaterialCommunityIcons name="wheelchair-accessibility" size={14} color={theme.colors.tertiary} />
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={s.actions}>
        <Pressable
          testID="adventure-open"
          onPress={onOpen}
          style={({ pressed }) => [s.action, { backgroundColor: theme.colors.primary }, pressed && { opacity: 0.85 }]}
        >
          <Text style={[s.actionText, { color: theme.colors.onPrimary }]}>{t("home.adventurousOpen")}</Text>
        </Pressable>
        <Pressable
          testID="adventure-reroll"
          onPress={onReroll}
          style={({ pressed }) => [
            s.action,
            { backgroundColor: theme.colors.surfaceVariant },
            pressed && { opacity: 0.85 },
          ]}
        >
          <MaterialCommunityIcons name="dice-multiple" size={18} color={theme.colors.onSurfaceVariant} />
          <Text style={[s.actionText, { color: theme.colors.onSurfaceVariant }]}>{t("home.adventurousReroll")}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  card: {
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  imageWrapper: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: IMAGE_HEIGHT,
  },
  body: {
    padding: 10,
    gap: 4,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  difficultyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
