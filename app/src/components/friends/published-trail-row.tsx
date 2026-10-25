// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ImageThumbnail, { THUMBNAIL_SIZE } from "@/components/image-thumbnail";
import MediaListRow from "@/components/media-list-row";
import { BORDER_RADIUS } from "@/constants/constants";
import { FriendPublishedTrail } from "@/data/types";
import { formatDate } from "@/utils/format-date";
import { formatDistanceKm } from "@/utils/format-distance";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Icon, useTheme } from "react-native-paper";

export default function PublishedTrailRow({ trail }: { trail: FriendPublishedTrail }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <MediaListRow
      testID="published-trail-row"
      thumbnail={
        trail.imageUrl ? (
          <ImageThumbnail uri={trail.imageUrl} />
        ) : (
          <View
            testID="published-trail-fallback"
            style={[s.fallback, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <Icon source="map-outline" size={24} color={theme.colors.onSurfaceVariant} />
          </View>
        )
      }
      title={trail.name}
      meta={[formatDistanceKm(trail.trailLength), trail.city].filter(Boolean)}
      trailing={t("friends.publishedOn", { date: formatDate(trail.publishedAt) })}
      onPress={() =>
        guardedNavigate(() =>
          router.navigate({
            pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
            params: { identifier: trail.identifier },
          }),
        )
      }
    />
  );
}

const s = StyleSheet.create({
  fallback: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: BORDER_RADIUS,
    justifyContent: "center",
    alignItems: "center",
  },
});
