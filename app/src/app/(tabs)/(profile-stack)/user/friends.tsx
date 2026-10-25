// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getBlockedUsers, getOutgoingRequests } from "@/api/friends";
import { friendsAtom, incomingRequestsAtom, userSearchAtomFamily } from "@/atoms/friends-atoms";
import AlertDialog from "@/components/alert-dialog";
import AccountBannedDialog from "@/components/auth/account-banned-dialog";
import BackButton from "@/components/back-button";
import BlockUserDialog, { UserRef } from "@/components/friends/block-user-dialog";
import PersonRow from "@/components/friends/person-row";
import ListSection from "@/components/list-section";
import { BLOCKS_STALE_TIME, REQUESTS_STALE_TIME } from "@/constants/cache";
import { BORDER_RADIUS, MIN_USER_SEARCH_LENGTH, SCREEN_PADDING } from "@/constants/constants";
import { SharedHike } from "@/data/types";
import { useBlockMutations } from "@/hooks/friends/useBlockMutations";
import { useFriendMutations } from "@/hooks/friends/useFriendMutations";
import { useSharedHikes } from "@/hooks/shared-hikes/useSharedHikes";
import { useCanWrite } from "@/hooks/useCanWrite";
import { formatDate } from "@/utils/format-date";
import { guardedNavigate } from "@/utils/navigation";
import { relativeDay } from "@/utils/relative-day";
import { latestShareBySender } from "@/utils/shares-by-sender";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { TFunction } from "i18next";
import { useAtom } from "jotai";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, IconButton, Searchbar, Text, useTheme } from "react-native-paper";

const RECENT_SHARE_DAYS = 7;

function openProfile(identifier: string) {
  guardedNavigate(() =>
    router.navigate({ pathname: "/(tabs)/(profile-stack)/user/friend/[identifier]", params: { identifier } }),
  );
}

function latestShareSubtitle(t: TFunction, share: SharedHike | undefined) {
  if (!share) return { subtitle: t("friends.noSharesYet"), recent: false };
  const rel = relativeDay(share.sharedAt);
  const when = rel ? t(rel.key, { count: rel.count }) : formatDate(share.sharedAt);
  return {
    subtitle: t("friends.latestShare", { hike: share.hikeName, when }),
    recent: rel !== null && rel.count <= RECENT_SHARE_DAYS,
  };
}

export default function FriendsScreen() {
  const [query, setQuery] = useState("");
  const { acceptMutation, rejectMutation, sendRequestMutation, withdrawRequestMutation } = useFriendMutations();
  const { blockMutation, unblockMutation } = useBlockMutations();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [userToBlock, setUserToBlock] = useState<UserRef | null>(null);
  const [requestToCancel, setRequestToCancel] = useState<UserRef | null>(null);
  const [blockedVisible, setBlockedVisible] = useState(false);
  const [showBannedDialog, setBannedDialog] = useState(false);
  const { reason } = useCanWrite();
  const unlessBanned = (write: () => void) => (reason === "banned" ? setBannedDialog(true) : write());

  const [incoming] = useAtom(incomingRequestsAtom);
  const [search] = useAtom(userSearchAtomFamily(query));
  const [friends] = useAtom(friendsAtom);
  const { data: latestShares } = useSharedHikes(latestShareBySender);

  const outgoing = useQuery({
    queryKey: ["friends", "outgoing"],
    queryFn: () => getOutgoingRequests(),
    staleTime: REQUESTS_STALE_TIME,
  });

  const blocked = useQuery({
    queryKey: ["blocks"],
    queryFn: () => getBlockedUsers(),
    staleTime: BLOCKS_STALE_TIME,
  });

  const isFriend = (identifier: string) => friends.data?.some((f) => f.identifier === identifier) ?? false;
  const isAsked = (identifier: string) => outgoing.data?.some((r) => r.receiverIdentifier === identifier) ?? false;
  const answering = acceptMutation.isPending || rejectMutation.isPending;

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <BackButton />
          <MaterialCommunityIcons name="account-group" size={24} color={theme.colors.onSurfaceVariant} />
          <Text style={s.headerTitle}>{t("friends.title")}</Text>
        </View>
        <View style={s.content}>
          <Searchbar
            placeholder={t("friends.search")}
            value={query}
            onChangeText={setQuery}
            style={[s.searchbar, { backgroundColor: theme.colors.surface }]}
            inputStyle={s.searchbarInput}
          />

          {query.trim().length >= MIN_USER_SEARCH_LENGTH && (
            <ListSection
              title={t("friends.searchResults")}
              icon="account-search"
              items={search.data}
              keyOf={(user) => user.identifier}
              isPending={search.isPending}
              isError={search.isError}
              errorText={t("friends.searchError")}
              emptyText={t("friends.noResults")}
              renderItem={(user) =>
                isFriend(user.identifier) ? (
                  <PersonRow
                    name={user.nickName}
                    identifier={user.identifier}
                    onPress={() => openProfile(user.identifier)}
                    trailing={
                      <MaterialCommunityIcons name="account-check" size={22} color={theme.colors.onSurfaceVariant} />
                    }
                  />
                ) : (
                  <PersonRow
                    name={user.nickName}
                    identifier={user.identifier}
                    trailing={
                      isAsked(user.identifier) ? (
                        <MaterialCommunityIcons name="clock-outline" size={22} color={theme.colors.outline} />
                      ) : (
                        <IconButton
                          hitSlop={20}
                          accessibilityLabel={t("friends.sendRequest")}
                          icon="account-plus"
                          size={25}
                          onPress={() => unlessBanned(() => sendRequestMutation.mutate(user.nickName))}
                          style={s.iconButton}
                        />
                      )
                    }
                  />
                )
              }
            />
          )}

          <ListSection
            title={t("friends.incomingCount", { count: incoming.data?.length ?? 0 })}
            icon="account-arrow-down"
            items={incoming.data}
            keyOf={(req) => req.requesterIdentifier}
            isError={incoming.isError}
            errorText={t("friends.incomingError")}
            onRetry={() => incoming.refetch()}
            renderItem={(req) => (
              <PersonRow
                name={req.requesterNickName}
                identifier={req.requesterIdentifier}
                actions={
                  <>
                    <Button
                      mode="contained"
                      compact
                      accessibilityLabel={t("friends.accept")}
                      onPress={() => unlessBanned(() => acceptMutation.mutate(req.requesterIdentifier))}
                      disabled={answering}
                    >
                      {t("friends.acceptShort")}
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      accessibilityLabel={t("friends.reject")}
                      onPress={() => rejectMutation.mutate(req.requesterIdentifier)}
                      disabled={answering}
                    >
                      {t("friends.rejectShort")}
                    </Button>
                    <Button
                      testID="block-requester"
                      mode="text"
                      compact
                      textColor={theme.colors.error}
                      onPress={() =>
                        setUserToBlock({ identifier: req.requesterIdentifier, nickName: req.requesterNickName })
                      }
                      disabled={blockMutation.isPending}
                    >
                      {t("friends.block")}
                    </Button>
                  </>
                }
              />
            )}
          />

          <ListSection
            title={friends.data ? t("friends.friendsCount", { count: friends.data.length }) : t("friends.friendsTitle")}
            icon="account-group"
            items={friends.data}
            keyOf={(friend) => friend.identifier}
            isPending={friends.isPending}
            isError={friends.isError}
            errorText={t("friends.friendsError")}
            onRetry={() => friends.refetch()}
            emptyText={t("friends.noFriends")}
            renderItem={(friend) => {
              const { subtitle, recent } = latestShareSubtitle(t, latestShares?.get(friend.identifier));
              return (
                <PersonRow
                  testID="friend-row"
                  name={friend.nickName}
                  identifier={friend.identifier}
                  note={friend.note}
                  subtitle={subtitle}
                  subtitleTone={recent ? "accent" : "muted"}
                  onPress={() => openProfile(friend.identifier)}
                />
              );
            }}
          />

          <ListSection
            title={t("friends.outgoingCount", { count: outgoing.data?.length ?? 0 })}
            icon="account-arrow-right"
            items={outgoing.data}
            keyOf={(req) => req.receiverIdentifier}
            isError={outgoing.isError}
            errorText={t("friends.outgoingError")}
            onRetry={() => outgoing.refetch()}
            renderItem={(req) => (
              <PersonRow
                name={req.receiverNickName}
                identifier={req.receiverIdentifier}
                trailing={
                  <Button
                    mode="text"
                    compact
                    accessibilityLabel={t("friends.cancelRequest")}
                    onPress={() =>
                      setRequestToCancel({ identifier: req.receiverIdentifier, nickName: req.receiverNickName })
                    }
                    disabled={withdrawRequestMutation.isPending}
                  >
                    {t("friends.withdrawShort")}
                  </Button>
                }
              />
            )}
          />

          {(blocked.isError || (blocked.data?.length ?? 0) > 0) && (
            <Button
              testID="toggle-blocked"
              mode="text"
              textColor={theme.colors.onSurfaceVariant}
              icon={blockedVisible ? "chevron-up" : "chevron-down"}
              onPress={() => setBlockedVisible((v) => !v)}
            >
              {blocked.isError
                ? t("friends.blockedTitle")
                : t("friends.blockedCount", { count: blocked.data?.length ?? 0 })}
            </Button>
          )}
          {blockedVisible && (
            <ListSection
              title={t("friends.blockedTitle")}
              icon="cancel"
              items={blocked.data}
              keyOf={(user) => user.identifier}
              isError={blocked.isError}
              errorText={t("friends.blockedError")}
              onRetry={() => blocked.refetch()}
              renderItem={(user) => (
                <PersonRow
                  testID="blocked-row"
                  name={user.nickName}
                  identifier={user.identifier}
                  subtitle={t("friends.blockedSince", {
                    date: new Date(user.blockedAt).toLocaleDateString(i18n.language),
                  })}
                  trailing={
                    <Button
                      testID="unblock-user"
                      mode="text"
                      compact
                      onPress={() => unblockMutation.mutate(user.identifier)}
                      disabled={unblockMutation.isPending}
                    >
                      {t("friends.unblock")}
                    </Button>
                  }
                />
              )}
            />
          )}
        </View>
      </ScrollView>
      <BlockUserDialog
        user={userToBlock}
        onDismiss={() => setUserToBlock(null)}
        onConfirm={(user) => blockMutation.mutate(user.identifier)}
      />
      <AlertDialog
        visible={requestToCancel !== null}
        onDismiss={() => setRequestToCancel(null)}
        onConfirm={() => {
          if (requestToCancel) withdrawRequestMutation.mutate(requestToCancel.identifier);
          setRequestToCancel(null);
        }}
        title={t("friends.cancelRequestTitle")}
        infoText={[
          t("friends.cancelRequestInfo", { name: requestToCancel?.nickName ?? "" }),
          t("friends.removeContinue"),
        ]}
        cancelText={t("common.cancel")}
        confirmText={t("friends.cancelRequestConfirm")}
        icon="account-arrow-left-outline"
      />
      <AccountBannedDialog visible={showBannedDialog} onDismiss={() => setBannedDialog(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  searchbarInput: {
    fontSize: 15,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
    gap: 8,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 20,
  },
  searchbar: {
    borderRadius: BORDER_RADIUS,
    elevation: 0,
  },
  iconButton: {
    margin: 0,
  },
});
