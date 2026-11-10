// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import OverflowMenu from "@/components/layout/overflow-menu";
import { BORDER_RADIUS } from "@/constants/constants";
import { EventPost } from "@/data/types";
import { formatPostTime } from "@/utils/event/event-time";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  post: EventPost;
  canModerate: boolean;
  showUnreadDivider: boolean;
  onEdit: (post: EventPost) => void;
  onDelete: (post: EventPost) => void;
  onPin: (post: EventPost, pinned: boolean) => void;
  onReport: (post: EventPost) => void;
};

function EventPostRow({ post, canModerate, showUnreadDivider, onEdit, onDelete, onPin, onReport }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const author = post.authorNickName ?? t("events.deletedUser");
  const canReport = !post.isMine && post.authorIdentifier != null;

  return (
    <View testID={`event-post-${post.identifier}`} style={s.wrapper}>
      {showUnreadDivider ? (
        <View testID="event-unread-divider" style={s.divider}>
          <View style={[s.line, { backgroundColor: theme.colors.tertiary }]} />
          <Text style={[s.dividerText, { color: theme.colors.tertiary }]}>{t("events.newPosts")}</Text>
          <View style={[s.line, { backgroundColor: theme.colors.tertiary }]} />
        </View>
      ) : null}
      <View style={[s.post, { backgroundColor: post.isMine ? theme.colors.primaryContainer : theme.colors.surface }]}>
        <View style={s.header}>
          {post.isPinned ? <MaterialCommunityIcons name="pin" size={14} color={theme.colors.primary} /> : null}
          <Text style={[s.author, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {author}
          </Text>
          <Text style={[s.time, { color: theme.colors.onSurfaceVariant }]}>
            {formatPostTime(post.createdAt, i18n.language)}
            {post.editedAt ? ` · ${t("events.edited")}` : ""}
          </Text>
          <OverflowMenu
            testID={`event-post-menu-${post.identifier}`}
            size={18}
            accessibilityLabel={t("events.postActions")}
            style={s.menuButton}
            items={[
              {
                icon: "pencil-outline",
                title: t("events.editPost"),
                onPress: () => onEdit(post),
                visible: post.canEdit,
              },
              {
                icon: post.isPinned ? "pin-off-outline" : "pin-outline",
                title: post.isPinned ? t("events.unpin") : t("events.pin"),
                onPress: () => onPin(post, !post.isPinned),
                visible: canModerate,
              },
              {
                icon: "delete-outline",
                title: t("common.delete"),
                onPress: () => onDelete(post),
                visible: post.canDelete,
              },
              { icon: "flag-outline", title: t("events.report"), onPress: () => onReport(post), visible: canReport },
            ]}
          />
        </View>
        <Text style={[s.body, { color: theme.colors.onSurface }]}>{post.body}</Text>
      </View>
    </View>
  );
}

export default memo(EventPostRow);

const s = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  line: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  post: {
    borderRadius: BORDER_RADIUS,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
  },
  author: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  time: {
    fontSize: 12,
    flex: 1,
  },
  menuButton: {
    margin: 0,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
