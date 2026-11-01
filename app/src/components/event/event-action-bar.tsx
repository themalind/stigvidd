// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { HikingEvent } from "@/data/types";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, useTheme } from "react-native-paper";

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
  return {
    join: event.permissions.canJoin,
    leave: event.myStatus === "Joined" && event.myRole !== "Organizer",
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
      {actions.markInterested ? (
        <Button mode="outlined" disabled={busy} onPress={() => onInterested(true)} style={s.button}>
          {t("events.interested")}
        </Button>
      ) : null}
      {actions.unmarkInterested ? (
        <Button mode="outlined" disabled={busy} onPress={() => onInterested(false)} style={s.button}>
          {t("events.notInterested")}
        </Button>
      ) : null}
      {actions.leave ? (
        <Button mode="outlined" disabled={busy} onPress={onLeave} style={s.button}>
          {t("events.leave")}
        </Button>
      ) : null}
      {actions.join ? (
        <Button mode="contained" disabled={busy} onPress={onJoin} style={s.button}>
          {t("events.join")}
        </Button>
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
