// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import LikeCount from "@/components/like-count";
import { BORDER_RADIUS } from "@/constants/constants";
import { TrailCard } from "@/data/types";
import { formatDistanceKm } from "@/utils/format-distance";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

export const CONTRIBUTION_CARD_WIDTH = 150;

interface ContributionCardProps {
  trail: TrailCard;
  onPress: (identifier: string) => void;
  testID: string;
}

export default function ContributionCard({ trail, onPress, testID }: ContributionCardProps) {
  const theme = useTheme();
  const meta = [formatDistanceKm(trail.trailLength), trail.contribution?.submitterNickName].filter(Boolean).join(" · ");

  return (
    <Pressable
      testID={testID}
      style={[s.card, { backgroundColor: theme.colors.background }]}
      onPress={() => onPress(trail.identifier)}
      accessibilityRole="button"
    >
      {trail.image ? (
        <Image source={{ uri: trail.image.imageUrl }} style={s.image} contentFit="cover" />
      ) : (
        <View style={[s.image, { backgroundColor: theme.colors.surfaceVariant }]} />
      )}
      <View style={s.text}>
        <Text style={[s.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {trail.name}
        </Text>
        <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {meta}
        </Text>
        <LikeCount count={trail.contribution?.likeCount ?? 0} size="small" style={s.likes} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    width: CONTRIBUTION_CARD_WIDTH,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  image: {
    width: CONTRIBUTION_CARD_WIDTH,
    height: 96,
  },
  text: {
    padding: 8,
    gap: 2,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
  },
  likes: {
    marginTop: 2,
  },
});
