// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { incomingEventInvitationsAtom } from "@/atoms/event-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import InlineError from "@/components/inline-error";
import LoadingIndicator from "@/components/loading-indicator";
import ScreenTitleBar from "@/components/screen-title-bar";
import SectionPanel from "@/components/section-panel";
import { SCREEN_PADDING } from "@/constants/constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EventSummary } from "@/data/types";
import { useEventMutations } from "@/hooks/events/useEventMutations";
import { useEventFeed, useMyEvents } from "@/hooks/events/useEventQueries";
import { useReturnHereAfterLogin } from "@/hooks/useReturnHereAfterLogin";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useAtomValue } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import EventCard from "./event-card";
import EventInvitationRow from "./event-invitation-row";
import EventsPastSection from "./events-past-section";
import { EVENTS_TAB_ROUTES, openEvent as openEventIn } from "./event-routes";

const openEvent = (identifier: string) => openEventIn(EVENTS_TAB_ROUTES, identifier);

export default function EventsListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [showAuthDialog, setAuthDialog] = useState(false);
  const returnHere = useReturnHereAfterLogin();
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
    // refetch ignores enabled, so a signed-out refresh would ask for invitations and own events. keep-comment: why the guard
    if (isAuthenticated) {
      void invitations.refetch();
      void mine.refetch();
    }
    void feed.refetch();
  };

  const renderItem = useCallback(
    ({ item }: { item: EventSummary }) => <EventCard event={item} onPress={openEvent} />,
    [],
  );

  const header = (
    <View style={s.header}>
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
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenTitleBar
        title={t("events.title")}
        leading={<MaterialCommunityIcons name="calendar-month-outline" size={25} color={theme.colors.onBackground} />}
        action={{
          testID: "events-create",
          label: t("events.form.create"),
          icon: "add",
          onPress: () =>
            isAuthenticated ? guardedNavigate(() => router.navigate("/(tabs)/events/create")) : setAuthDialog(true),
        }}
        style={s.titleBar}
      />
      <FlatList
        testID="events-list"
        contentContainerStyle={s.content}
        data={feedEvents}
        keyExtractor={(item) => item.identifier}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <LoadingIndicator />
          ) : isAuthenticated ? (
            <EventsPastSection onOpen={openEvent} />
          ) : null
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={refresh} />
        }
      />
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage={t("events.signInToCreate")}
        onBeforeNavigate={returnHere}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  titleBar: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 10,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    gap: 12,
    marginHorizontal: -SCREEN_PADDING,
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
