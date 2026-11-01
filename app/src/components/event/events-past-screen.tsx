// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BackButton from "@/components/back-button";
import InlineError from "@/components/inline-error";
import LoadingIndicator from "@/components/loading-indicator";
import { SCREEN_PADDING } from "@/constants/constants";
import { useMyEvents } from "@/hooks/events/useEventQueries";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import EventCard from "./event-card";
import { EVENTS_TAB_ROUTES, openEvent as openEventIn } from "./event-routes";

const openEvent = (identifier: string) => openEventIn(EVENTS_TAB_ROUTES, identifier);

export default function EventsPastScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const past = useMyEvents(true);
  const events = useMemo(() => past.data?.pages.flatMap((page) => page.items) ?? [], [past.data]);

  const empty = () => {
    if (past.isLoading) return <LoadingIndicator />;
    if (past.isError && !past.data) {
      return <InlineError message={t("events.loadError")} onRetry={() => void past.refetch()} />;
    }
    return <Text style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>{t("events.noPastEvents")}</Text>;
  };

  return (
    <FlatList
      testID="events-past"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={s.content}
      data={events}
      keyExtractor={(item) => item.identifier}
      renderItem={({ item }) => <EventCard event={item} onPress={openEvent} />}
      ListHeaderComponent={
        <View style={s.header}>
          <BackButton />
          <Text style={[s.title, { color: theme.colors.onBackground }]}>{t("events.pastTitle")}</Text>
        </View>
      }
      ListEmptyComponent={empty}
      ListFooterComponent={past.isFetchingNextPage ? <LoadingIndicator /> : null}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (past.hasNextPage && !past.isFetchingNextPage) void past.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={past.isRefetching && !past.isFetchingNextPage}
          onRefresh={() => void past.refetch()}
        />
      }
    />
  );
}

const s = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
});
