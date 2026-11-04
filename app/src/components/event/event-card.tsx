// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS, EVENT_COVER_ASPECT } from "@/constants/constants";
import { EventSummary } from "@/data/types";
import { formatDistanceKm } from "@/utils/format-distance";
import { formatTimeRange } from "@/utils/event-time";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import EventDateBadge from "./event-date-badge";
import EventTags from "./event-tags";

type Props = {
  event: EventSummary;
  onPress: (identifier: string) => void;
  isPast?: boolean;
};

function useStatusText(event: EventSummary): string | undefined {
  const { t } = useTranslation();
  if (event.status === "Cancelled") return t("events.cancelled");
  if (event.myStatus === "Joined") return t("events.youJoined");
  if (event.myStatus === "Interested") return t("events.youAreInterested");
  if (event.maxParticipants != null && event.participantCount >= event.maxParticipants) return t("events.full");
  return undefined;
}

function EventCard({ event, onPress, isPast = false }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const status = useStatusText(event);
  const isCancelled = event.status === "Cancelled";

  const details = [
    formatTimeRange(event.startsAt, event.endsAt, i18n.language),
    event.placeName,
    event.routeLengthMeters == null ? undefined : formatDistanceKm(event.routeLengthMeters / 1000),
  ].filter((part): part is string => !!part);

  const participants =
    event.maxParticipants == null
      ? t("events.participants", { count: event.participantCount })
      : t("events.participantsOfMax", { count: event.participantCount, max: event.maxParticipants });

  const organizer = event.organizerNickName
    ? t("events.organizedBy", { nickName: event.organizerNickName })
    : undefined;
  const unread = event.unreadPostCount > 0 ? t("events.unreadPosts", { count: event.unreadPostCount }) : undefined;

  return (
    <Pressable
      testID={`event-card-${event.identifier}`}
      accessibilityRole="button"
      onPress={() => onPress(event.identifier)}
      style={[s.card, { backgroundColor: theme.colors.surface }]}
    >
      {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={s.cover} contentFit="cover" /> : null}
      <View style={s.body}>
        <EventDateBadge startsAt={event.startsAt} muted={isCancelled || isPast} />
        <View style={s.text}>
          <EventTags visibility={event.visibility} isPast={isPast && !isCancelled} />
          <Text style={[s.title, { color: theme.colors.onSurface }, isCancelled && s.struck]} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {details.join(" · ")}
          </Text>
          <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {[organizer, participants].filter(Boolean).join(" · ")}
          </Text>
          {status || unread ? (
            <View style={s.statusRow}>
              {status ? (
                <Text style={[s.status, { color: isCancelled ? theme.colors.error : theme.colors.primary }]}>
                  {status}
                </Text>
              ) : null}
              {unread ? (
                <View style={s.unread}>
                  <MaterialCommunityIcons name="message-text-outline" size={14} color={theme.colors.tertiary} />
                  <Text style={[s.status, { color: theme.colors.tertiary }]}>{unread}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(EventCard);

const s = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  cover: {
    aspectRatio: EVENT_COVER_ASPECT,
  },
  body: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  struck: {
    textDecorationLine: "line-through",
  },
  meta: {
    fontSize: 13,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  status: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  unread: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
});
