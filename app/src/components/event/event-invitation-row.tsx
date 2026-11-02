// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { EventInvitation } from "@/data/types";
import { formatEventDate, formatTimeRange } from "@/utils/event-time";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import EventVisibilityChip from "./event-visibility-chip";
import InvitationAnswerButtons from "./invitation-answer-buttons";

type Props = {
  invitation: EventInvitation;
  busy: boolean;
  onOpen: (identifier: string) => void;
  onAccept: (identifier: string) => void;
  onDecline: (identifier: string) => void;
};

export default function EventInvitationRow({ invitation, busy, onOpen, onAccept, onDecline }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { event, invitedByNickName } = invitation;
  const when = `${formatEventDate(event.startsAt, i18n.language)} · ${formatTimeRange(event.startsAt, event.endsAt, i18n.language)}`;

  return (
    <View testID={`event-invitation-${event.identifier}`} style={[s.row, { backgroundColor: theme.colors.background }]}>
      <Pressable accessibilityRole="button" onPress={() => onOpen(event.identifier)} style={s.text}>
        <Text testID="event-invitation-title" style={[s.title, { color: theme.colors.onSurface }]}>
          {event.title}
        </Text>
        <Text style={[s.message, { color: theme.colors.onSurfaceVariant }]}>
          {invitedByNickName ? (
            <>
              {t("events.invitedBy")}{" "}
              <Text testID="event-invitation-inviter" style={[s.inviter, { color: theme.colors.onSurface }]}>
                {invitedByNickName}
              </Text>
            </>
          ) : (
            t("events.invitedYouAnonymous")
          )}
        </Text>
        <View style={s.meta}>
          <EventVisibilityChip visibility={event.visibility} />
          <Text style={[s.when, { color: theme.colors.onSurfaceVariant }]}>{when}</Text>
        </View>
      </Pressable>
      <InvitationAnswerButtons
        busy={busy}
        onAccept={() => onAccept(event.identifier)}
        onDecline={() => onDecline(event.identifier)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    gap: 8,
    padding: 12,
    borderRadius: BORDER_RADIUS,
  },
  text: {
    gap: 6,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Inter_600SemiBold",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  inviter: {
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  when: {
    fontSize: 13,
    flexShrink: 1,
  },
});
