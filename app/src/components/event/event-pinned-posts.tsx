// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { EventPost } from "@/data/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  pinned: EventPost[];
  onSelect: (post: EventPost) => void;
};

export default function EventPinnedPosts({ pinned, onSelect }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (pinned.length === 0) return null;

  return (
    <View testID="event-board-pinned" style={[s.box, { backgroundColor: theme.colors.surface }]}>
      <View style={s.header}>
        <MaterialCommunityIcons name="pin" size={14} color={theme.colors.primary} />
        <Text style={[s.heading, { color: theme.colors.primary }]}>{t("events.pinnedPosts")}</Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {pinned.map((post) => (
          <Pressable
            key={post.identifier}
            testID={`event-pinned-${post.identifier}`}
            accessibilityRole="button"
            accessibilityHint={t("events.showPinnedPost")}
            onPress={() => onSelect(post)}
          >
            <Text style={{ color: theme.colors.onSurface }} numberOfLines={3}>
              <Text style={s.author}>{post.authorNickName ?? t("events.deletedUser")}: </Text>
              {post.body}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // Pins are uncapped, so the box scrolls rather than pushing the board off screen. keep-comment: why maxHeight
  // Without flexShrink 0 the board squeezed the box to one clipped line. keep-comment: why flexShrink
  box: {
    flexShrink: 0,
    maxHeight: 180,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 8,
    paddingTop: 8,
    borderRadius: BORDER_RADIUS,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
  },
  heading: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  content: {
    padding: 10,
    paddingTop: 4,
    gap: 6,
  },
  author: {
    fontFamily: "Inter_600SemiBold",
  },
});
