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
import SegmentedControl from "@/components/segmented-control";
import { SCREEN_PADDING } from "@/constants/constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EventSummary } from "@/data/types";
import { useEventMutations } from "@/hooks/events/useEventMutations";
import { useEventFeed, useMyEvents } from "@/hooks/events/useEventQueries";
import { useEventSearch } from "@/hooks/events/useEventSearch";
import FilterIconButton from "@/components/filter/filter-icon-button";
import { useReturnHereAfterLogin } from "@/hooks/useReturnHereAfterLogin";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useAtomValue } from "jotai";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import EventCard from "./event-card";
import EventFilterSheet from "./event-filter-sheet";
import EventSearchBar from "./event-search-bar";
import EventInvitationRow from "./event-invitation-row";
import { EVENTS_TAB_ROUTES, openEvent as openEventIn } from "./event-routes";

const openEvent = (identifier: string) => openEventIn(EVENTS_TAB_ROUTES, identifier);

type EventsTab = "explore" | "mine" | "past";

export default function EventsListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [showAuthDialog, setAuthDialog] = useState(false);
  const [chosenTab, setTab] = useState<EventsTab>("explore");
  const listRef = useRef<FlatList<EventSummary>>(null);
  const returnHere = useReturnHereAfterLogin();
  const invitations = useAtomValue(incomingEventInvitationsAtom);
  const tab: EventsTab = isAuthenticated ? chosenTab : "explore";
  const isPast = tab === "past";
  const search = useEventSearch(isPast);
  const [showFilters, setShowFilters] = useState(false);
  const feed = useEventFeed(search.upcoming);
  const mine = useMyEvents(false, true, search.upcoming);
  const past = useMyEvents(true, isPast, search.past);
  const { acceptInvitationMutation, declineInvitationMutation } = useEventMutations();
  const answering = acceptInvitationMutation.isPending || declineInvitationMutation.isPending;
  const invitationCount = invitations.data?.length ?? 0;

  const feedEvents = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const myEvents = useMemo(() => mine.data?.pages.flatMap((page) => page.items) ?? [], [mine.data]);
  const pastEvents = useMemo(() => past.data?.pages.flatMap((page) => page.items) ?? [], [past.data]);

  const active = { explore: feed, mine, past }[tab];
  const data = { explore: feedEvents, mine: myEvents, past: pastEvents }[tab];
  const emptyText = { explore: t("events.empty"), mine: t("events.noMyEvents"), past: t("events.noPastEvents") }[tab];

  const chooseTab = (next: EventsTab) => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    setTab(next);
  };

  const refresh = () => {
    // refetch ignores enabled, so a signed-out refresh would ask for invitations and own events. keep-comment: why the guard
    if (isAuthenticated) {
      void invitations.refetch();
      void mine.refetch();
      if (isPast) void past.refetch();
    }
    void feed.refetch();
  };

  const renderItem = useCallback(
    ({ item }: { item: EventSummary }) => <EventCard event={item} onPress={openEvent} isPast={isPast} />,
    [isPast],
  );

  const header =
    tab === "mine" && invitationCount > 0 ? (
      <View style={s.header}>
        <SectionPanel title={t("events.invitations")} testID="event-invitations">
          {invitations.data?.map((invitation) => (
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
        {myEvents.length > 0 ? (
          <Text style={[s.groupTitle, { color: theme.colors.onSurfaceVariant }]}>{t("events.yourUpcoming")}</Text>
        ) : null}
      </View>
    ) : null;

  const empty = () => {
    if (active.isLoading) return <LoadingIndicator />;
    if (active.isError && !active.data) {
      return <InlineError message={t("events.loadError")} onRetry={() => void active.refetch()} />;
    }
    if (search.isActive) {
      return (
        <View testID="events-no-matches" style={s.noMatches}>
          <Text style={[s.noMatchesTitle, { color: theme.colors.onBackground }]}>{t("events.search.noMatches")}</Text>
          <Text style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>{t("events.search.noMatchesHint")}</Text>
        </View>
      );
    }
    return <Text style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>{emptyText}</Text>;
  };

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View style={s.top}>
        <ScreenTitleBar
          title={t("events.title")}
          leading={<MaterialCommunityIcons name="calendar-month-outline" size={25} color={theme.colors.onBackground} />}
          trailing={
            <FilterIconButton
              testID="events-filter-button"
              label={t("events.search.filters")}
              activeCount={search.activeCount}
              onPress={() => setShowFilters(true)}
            />
          }
          action={{
            testID: "events-create",
            label: t("events.form.create"),
            icon: "add",
            onPress: () =>
              isAuthenticated ? guardedNavigate(() => router.navigate("/(tabs)/events/create")) : setAuthDialog(true),
          }}
          style={s.titleBar}
        />
        {isAuthenticated ? (
          <SegmentedControl
            testID="events-tabs"
            options={[
              { value: "explore", label: t("events.tabExplore") },
              {
                value: "mine",
                label: t("events.tabMine"),
                badge: invitationCount,
                badgeLabel: t("events.pendingInvitations", { count: invitationCount }),
              },
              { value: "past", label: t("events.tabPast") },
            ]}
            value={tab}
            onChange={chooseTab}
            style={s.tabs}
          />
        ) : null}
        <EventSearchBar search={search} showWhen={!isPast} />
      </View>
      <FlatList
        ref={listRef}
        testID="events-list"
        contentContainerStyle={s.content}
        data={data}
        keyExtractor={(item) => item.identifier}
        renderItem={renderItem}
        ListHeaderComponent={header ?? undefined}
        ListEmptyComponent={empty}
        ListFooterComponent={active.isFetchingNextPage ? <LoadingIndicator /> : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (active.hasNextPage && !active.isFetchingNextPage) void active.fetchNextPage();
        }}
        refreshControl={
          // A changed search refetches behind the previous list, which is not a pull to refresh. keep-comment: why placeholder data is excluded
          <RefreshControl
            refreshing={active.isRefetching && !active.isFetchingNextPage && !active.isPlaceholderData}
            onRefresh={refresh}
          />
        }
      />
      <EventFilterSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        search={search}
        showWhen={!isPast}
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
  top: {
    paddingHorizontal: SCREEN_PADDING,
  },
  titleBar: {
    paddingVertical: 10,
  },
  tabs: {
    marginBottom: 10,
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
  groupTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 6,
    marginHorizontal: SCREEN_PADDING,
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
  noMatches: {
    alignItems: "center",
    paddingTop: 24,
  },
  noMatchesTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
