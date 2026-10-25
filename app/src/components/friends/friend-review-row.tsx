// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Rating } from "@/components/review/rating";
import { FriendReview } from "@/data/types";
import { formatDate } from "@/utils/format-date";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

export default function FriendReviewRow({ review }: { review: FriendReview }) {
  const theme = useTheme();

  return (
    <Pressable
      testID="friend-review-row"
      accessibilityRole="button"
      accessibilityLabel={review.trailName}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
      onPress={() =>
        guardedNavigate(() =>
          router.navigate({
            pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
            params: { identifier: review.trailIdentifier },
          }),
        )
      }
    >
      <View style={s.text}>
        <View style={s.header}>
          <Text style={s.title} numberOfLines={1}>
            {review.trailName}
          </Text>
          <Rating averageRating={review.rating} variant="stars" starSize={13} starColor={theme.colors.secondary} />
        </View>
        {!!review.text && (
          <Text variant="bodyMedium" numberOfLines={2}>
            {review.text}
          </Text>
        )}
        <Text variant="bodySmall" style={s.date}>
          {formatDate(review.createdAt)}
        </Text>
      </View>
      <Icon source="chevron-right" size={20} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // keep-comment: shrinks so a long trail name never pushes the stars off the row
  title: {
    flexShrink: 1,
    fontWeight: "600",
  },
  date: {
    opacity: 0.6,
  },
});
