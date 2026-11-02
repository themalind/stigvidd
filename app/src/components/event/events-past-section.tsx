// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import InlineError from "@/components/inline-error";
import LoadingIndicator from "@/components/loading-indicator";
import { EventSummary } from "@/data/types";
import { useMyEvents } from "@/hooks/events/useEventQueries";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import EventCard from "./event-card";

type Props = {
  onOpen: (identifier: string) => void;
};

export default function EventsPastSection({ onOpen }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const past = useMyEvents(true, open);
  const events = useMemo<EventSummary[]>(() => past.data?.pages.flatMap((page) => page.items) ?? [], [past.data]);

  if (!open) {
    return (
      <Button testID="events-past-link" mode="text" icon="history" onPress={() => setOpen(true)}>
        {t("events.showPast")}
      </Button>
    );
  }

  return (
    <View testID="events-past" style={s.section}>
      <Text style={[s.title, { color: theme.colors.onSurfaceVariant }]}>{t("events.pastTitle")}</Text>
      {events.map((event) => (
        <EventCard key={event.identifier} event={event} onPress={onOpen} isPast />
      ))}
      {past.isLoading || past.isFetchingNextPage ? <LoadingIndicator /> : null}
      {past.isError && !past.data ? (
        <InlineError message={t("events.loadError")} onRetry={() => void past.refetch()} />
      ) : null}
      {past.isSuccess && events.length === 0 ? (
        <Text style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>{t("events.noPastEvents")}</Text>
      ) : null}
      {past.hasNextPage && !past.isFetchingNextPage ? (
        <Button testID="events-past-more" mode="text" onPress={() => void past.fetchNextPage()}>
          {t("events.loadMorePast")}
        </Button>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    gap: 12,
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 6,
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 12,
  },
});
