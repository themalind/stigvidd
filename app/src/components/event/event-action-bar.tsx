// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SlimButton from "@/components/display/slim-button";
import { BORDER_RADIUS } from "@/constants/constants";
import { HikingEvent } from "@/data/types";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  event: HikingEvent;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onInterested: (interested: boolean) => void;
};

// The organizer leaves through cancel or delete, never here. keep-comment: their leave hands the event over
export function eventActions(event: HikingEvent) {
  const isInterested = event.myStatus === "Interested";
  const isFull = event.maxParticipants != null && event.participantCount >= event.maxParticipants;
  return {
    join: event.permissions.canJoin,
    full: isFull && event.myStatus !== "Joined" && event.status === "Published" && !event.isPast,
    leave: event.myStatus === "Joined" && event.myRole !== "Organizer" && !event.isPast,
    markInterested: event.permissions.canMarkInterested && !isInterested,
    unmarkInterested: isInterested,
  };
}

export default function EventActionBar({ event, busy, onJoin, onLeave, onInterested }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const actions = eventActions(event);

  if (!Object.values(actions).some(Boolean)) return null;

  return (
    <View
      testID="event-action-bar"
      style={[s.bar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}
    >
      {actions.markInterested || actions.unmarkInterested ? (
        <SlimButton
          testID="event-interested"
          mode="outlined"
          icon={({ size, color }) =>
            actions.unmarkInterested ? (
              <MaterialCommunityIcons testID="event-interested-on" name="pine-tree-variant" size={size} color={color} />
            ) : (
              <MaterialCommunityIcons name="pine-tree-variant-outline" size={size} color={color} />
            )
          }
          accessibilityLabel={actions.unmarkInterested ? t("events.interestedSelected") : t("events.interested")}
          disabled={busy}
          onPress={() => onInterested(!actions.unmarkInterested)}
          style={s.button}
        >
          {t("events.interested")}
        </SlimButton>
      ) : null}
      {actions.leave ? (
        <SlimButton mode="outlined" disabled={busy} onPress={onLeave} style={s.button}>
          {t("events.leave")}
        </SlimButton>
      ) : null}
      {actions.join ? (
        <SlimButton mode="contained" disabled={busy} onPress={onJoin} style={s.button}>
          {t("events.join")}
        </SlimButton>
      ) : null}
      {actions.full && !actions.join ? (
        <SlimButton testID="event-full" mode="contained" disabled style={s.button}>
          {t("events.full")}
        </SlimButton>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
  },
});
