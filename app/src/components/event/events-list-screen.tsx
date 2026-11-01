// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { incomingEventInvitationsAtom } from "@/atoms/event-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import SignInPrompt from "@/components/auth/sign-in-prompt";
import InlineError from "@/components/inline-error";
import LoadingIndicator from "@/components/loading-indicator";
import SectionPanel from "@/components/section-panel";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { EventSummary } from "@/data/types";
import { useEventMutations } from "@/hooks/events/useEventMutations";
import { useEventFeed, useMyEvents } from "@/hooks/events/useEventQueries";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import EventCard from "./event-card";
import EventInvitationRow from "./event-invitation-row";
import { EVENTS_TAB_ROUTES, openEvent as openEventIn } from "./event-routes";

const openEvent = (identifier: string) => openEventIn(EVENTS_TAB_ROUTES, identifier);

export default function EventsListScreen() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  if (!isAuthenticated) return <SignInPrompt message={t("events.signInToSee")} />;
  return <EventsList />;
}

function EventsList() {
  const theme = useTheme();
  const { t } = useTranslation();
  const invitations = useAtomValue(incomingEventInvitationsAtom);
  const mine = useMyEvents(false);
  const feed = useEventFeed();
  const { acceptInvitationMutation, declineInvitationMutation } = useEventMutations();
  const answering = acceptInvitationMutation.isPending || declineInvitationMutation.isPending;

  const myEvents = useMemo(() => mine.data?.pages.flatMap((page) => page.items) ?? [], [mine.data]);
  // Events the user is already part of are listed under "Dina kommande". keep-comment: avoids showing one twice
  const feedEvents = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items).filter((item) => !item.myRole && !item.myStatus) ?? [],
    [feed.data],
  );

  const refresh = () => {
    void invitations.refetch();
    void mine.refetch();
    void feed.refetch();
  };

  const renderItem = useCallback(
    ({ item }: { item: EventSummary }) => <EventCard event={item} onPress={openEvent} />,
    [],
  );

  const header = (
    <View style={s.header}>
      <View style={s.titleRow}>
        <Text style={[s.title, { color: theme.colors.onBackground }]}>{t("events.title")}</Text>
        <Button
          testID="events-create"
          mode="contained"
          icon="plus"
          compact
          onPress={() => guardedNavigate(() => router.navigate("/(tabs)/events/create"))}
          style={{ borderRadius: BORDER_RADIUS }}
        >
          {t("events.form.create")}
        </Button>
      </View>

      {invitations.data && invitations.data.length > 0 ? (
        <SectionPanel title={t("events.invitations")} testID="event-invitations">
          {invitations.data.map((invitation) => (
            <EventInvitationRow
              key={invitation.event.identifier}
              invitation={invitation}
              busy={answering}
              onOpen={openEvent}
              onAccept={(identifier) => acceptInvitationMutation.mutate(identifier)}
              onDecline={(identifier) => declineInvitationMutation.mutate(identifier)}
            />
          ))}
        </SectionPanel>
      ) : null}

      {myEvents.length > 0 ? (
        <View style={s.group} testID="my-events">
          <Text style={[s.groupTitle, { color: theme.colors.onSurfaceVariant }]}>{t("events.yourUpcoming")}</Text>
          {myEvents.map((event) => (
            <EventCard key={event.identifier} event={event} onPress={openEvent} />
          ))}
        </View>
      ) : null}

      <View style={s.group}>
        <Text style={[s.groupTitle, { color: theme.colors.onSurfaceVariant }]}>{t("events.upcoming")}</Text>
      </View>
    </View>
  );

  const empty = () => {
    if (feed.isLoading) return <LoadingIndicator />;
    if (feed.isError && !feed.data) {
      return <InlineError message={t("events.loadError")} onRetry={() => void feed.refetch()} />;
    }
    return <Text style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>{t("events.empty")}</Text>;
  };

  return (
    <FlatList
      testID="events-list"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={s.content}
      data={feedEvents}
      keyExtractor={(item) => item.identifier}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <LoadingIndicator />
        ) : (
          <Button
            testID="events-past-link"
            mode="text"
            icon="history"
            onPress={() => guardedNavigate(() => router.navigate("/(tabs)/events/past"))}
          >
            {t("events.pastTitle")}
          </Button>
        )
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
      refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={refresh} />}
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
    gap: 12,
    marginHorizontal: -SCREEN_PADDING,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: SCREEN_PADDING,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
  },
  group: {
    gap: 12,
    marginHorizontal: SCREEN_PADDING,
  },
  groupTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 6,
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
});
