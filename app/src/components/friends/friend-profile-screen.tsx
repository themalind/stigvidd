// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { friendsAtom } from "@/atoms/friends-atoms";
import AlertDialog from "@/components/alert-dialog";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import BlockUserDialog, { UserRef } from "@/components/friends/block-user-dialog";
import FriendNoteDialog from "@/components/friends/friend-note-dialog";
import FriendNoteText from "@/components/friends/friend-note-text";
import FriendReviewRow from "@/components/friends/friend-review-row";
import FriendsSince from "@/components/friends/friends-since";
import PickHikeDialog from "@/components/friends/pick-hike-dialog";
import PublishedTrailRow from "@/components/friends/published-trail-row";
import TogetherCard from "@/components/friends/together-card";
import UserAvatar from "@/components/friends/user-avatar";
import ListSection from "@/components/list-section";
import LoadingIndicator from "@/components/loading-indicator";
import SegmentedControl from "@/components/segmented-control";
import SentShareRow from "@/components/shared-hike/sent-share-row";
import SharedHikeRow from "@/components/shared-hike/shared-hike-row";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { OutgoingSharedHike, SharedHike } from "@/data/types";
import { useBlockMutations } from "@/hooks/friends/useBlockMutations";
import { useFriendMutations } from "@/hooks/friends/useFriendMutations";
import { useFriendProfile } from "@/hooks/friends/useFriendProfile";
import { useOutgoingShares } from "@/hooks/shared-hikes/useOutgoingShares";
import { useSharedHikes } from "@/hooks/shared-hikes/useSharedHikes";
import { guardedNavigate } from "@/utils/navigation";
import { sharesTo } from "@/utils/outgoing-shares";
import { sharesFrom } from "@/utils/shares-by-sender";
import { router, useLocalSearchParams } from "expo-router";
import { useAtomValue } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Icon, Text, useTheme } from "react-native-paper";

const PROFILE_AVATAR_SIZE = 88;

type ShareDirection = "from" | "to";

const withCount = (label: string, items: readonly unknown[] | undefined) =>
  items ? `${label} · ${items.length}` : label;

const tally = (lengths: readonly number[]) => ({
  count: lengths.length,
  km: lengths.reduce((sum, km) => sum + (Number.isFinite(km) ? km : 0), 0),
});

export default function FriendProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const { data: friends, isPending, isError, error, refetch } = useAtomValue(friendsAtom);
  const selectShares = useCallback((hikes: SharedHike[]) => sharesFrom(hikes, identifier), [identifier]);
  const shares = useSharedHikes(selectShares);
  const selectSent = useCallback((hikes: OutgoingSharedHike[]) => sharesTo(hikes, identifier), [identifier]);
  const sent = useOutgoingShares(selectSent);
  const profile = useFriendProfile(friends?.some((f) => f.identifier === identifier) ? identifier : undefined);
  const [direction, setDirection] = useState<ShareDirection>("from");
  const [pickingHike, setPickingHike] = useState(false);
  const { removeFriendMutation, setNoteMutation } = useFriendMutations();
  const { blockMutation } = useBlockMutations();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [userToBlock, setUserToBlock] = useState<UserRef | null>(null);

  const friend = friends?.find((f) => f.identifier === identifier);
  const fromFriend = useMemo(() => tally((shares.data ?? []).map((h) => h.hikeLength)), [shares.data]);
  const fromYou = useMemo(() => tally((sent.data ?? []).map((share) => share.hike.hikeLength)), [sent.data]);

  if (isPending) return <LoadingIndicator />;
  if (isError && !friends) return <ErrorView error={error} onRetry={refetch} />;

  const leave = { onSuccess: () => router.back() };

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.topBar}>
          <BackButton />
        </View>
        {!friend ? (
          <Text variant="bodyMedium" style={s.notFriend}>
            {t("friends.notFriend")}
          </Text>
        ) : (
          <View style={s.content}>
            <View style={s.identity}>
              <UserAvatar name={friend.nickName} seed={friend.identifier} size={PROFILE_AVATAR_SIZE} />
              <Text variant="headlineSmall" style={s.name}>
                {friend.nickName}
              </Text>
              {friend.friendsSince && <FriendsSince since={friend.friendsSince} />}
              {friend.note ? (
                <Pressable
                  testID="edit-note"
                  accessibilityRole="button"
                  accessibilityHint={t("friends.editNote")}
                  onPress={() => setEditingNote(true)}
                  style={({ pressed }) => [
                    s.noteChip,
                    { borderColor: theme.colors.outlineVariant },
                    pressed && s.pressed,
                  ]}
                >
                  <FriendNoteText note={friend.note} size="medium" />
                  <Icon source="pencil-outline" size={16} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              ) : (
                <Button testID="add-note" mode="text" icon="note-plus-outline" onPress={() => setEditingNote(true)}>
                  {t("friends.addNote")}
                </Button>
              )}
            </View>

            <Button
              testID="share-hike-with"
              mode="contained"
              icon="share-variant-outline"
              onPress={() => setPickingHike(true)}
            >
              {t("friends.shareHikeWith", { name: friend.nickName })}
            </Button>

            <TogetherCard name={friend.nickName} fromFriend={fromFriend} fromYou={fromYou} />

            <SegmentedControl
              testID="share-direction"
              value={direction}
              onChange={setDirection}
              options={[
                { value: "from", label: withCount(t("friends.tabFrom", { name: friend.nickName }), shares.data) },
                { value: "to", label: withCount(t("friends.tabTo"), sent.data) },
              ]}
            />

            {direction === "from" ? (
              <ListSection
                testID="friend-shares"
                title={t("friends.sharedByFriend", { name: friend.nickName })}
                icon="routes"
                items={shares.data}
                keyOf={(hike) => hike.hikeIdentifier}
                renderItem={(hike) => <SharedHikeRow hike={hike} showSharedBy={false} />}
                isPending={shares.isLoading}
                isError={shares.isError && !shares.data}
                errorText={t("friends.sharesError")}
                onRetry={() => shares.refetch()}
                emptyText={t("friends.noSharesFrom", { name: friend.nickName })}
              />
            ) : (
              <ListSection
                testID="sent-shares"
                title={t("friends.sharedWithFriend", { name: friend.nickName })}
                icon="send-outline"
                items={sent.data}
                keyOf={(share) => share.hike.hikeIdentifier}
                renderItem={(share) => <SentShareRow share={share} />}
                isPending={sent.isLoading}
                isError={sent.isError && !sent.data}
                errorText={t("friends.sharesError")}
                onRetry={() => sent.refetch()}
                emptyText={t("friends.noSharesTo", { name: friend.nickName })}
              />
            )}

            <ListSection
              testID="published-trails"
              title={t("friends.publishedTrails", { name: friend.nickName })}
              icon="map-outline"
              items={profile.data?.publishedTrails}
              keyOf={(trail) => trail.identifier}
              renderItem={(trail) => <PublishedTrailRow trail={trail} />}
              isPending={profile.isLoading}
              isError={profile.isError && !profile.data}
              errorText={t("friends.profileError")}
              onRetry={() => profile.refetch()}
            />

            <ListSection
              testID="friend-reviews"
              title={withCount(t("friends.reviewsBy", { name: friend.nickName }), profile.data?.reviews)}
              icon="star-outline"
              items={profile.data?.reviews}
              keyOf={(review) => review.identifier}
              renderItem={(review) => <FriendReviewRow review={review} />}
              isPending={profile.isLoading}
              isError={profile.isError && !profile.data}
              errorText={t("friends.profileError")}
              onRetry={() => profile.refetch()}
              emptyText={t("friends.noReviews", { name: friend.nickName })}
            />

            <View style={s.dangerZone}>
              <Button
                testID="remove-friend"
                mode="text"
                icon="account-remove-outline"
                textColor={theme.colors.error}
                onPress={() => setConfirmRemove(true)}
                disabled={removeFriendMutation.isPending}
              >
                {t("friends.removeFriend")}
              </Button>
              <Button
                testID="block-friend"
                mode="text"
                icon="cancel"
                textColor={theme.colors.error}
                onPress={() => setUserToBlock(friend)}
                disabled={blockMutation.isPending}
              >
                {t("friends.block")}
              </Button>
            </View>

            <AlertDialog
              visible={confirmRemove}
              onDismiss={() => setConfirmRemove(false)}
              onConfirm={() => {
                removeFriendMutation.mutate(friend.identifier, leave);
                setConfirmRemove(false);
              }}
              title={t("friends.removeTitle")}
              infoText={[t("friends.removeInfo", { name: friend.nickName }), t("friends.removeContinue")]}
              cancelText={t("common.cancel")}
              confirmText={t("friends.remove")}
              icon="account-remove-outline"
              tone="danger"
            />
            <FriendNoteDialog
              visible={editingNote}
              nickName={friend.nickName}
              note={friend.note}
              onDismiss={() => setEditingNote(false)}
              onSave={(note) => setNoteMutation.mutate({ identifier: friend.identifier, note })}
            />
            <PickHikeDialog
              visible={pickingHike}
              nickName={friend.nickName}
              onDismiss={() => setPickingHike(false)}
              onPick={(hike) => {
                setPickingHike(false);
                guardedNavigate(() =>
                  router.navigate({
                    pathname: "/(tabs)/(profile-stack)/hike/[identifier]",
                    params: { identifier: hike.identifier, shareWith: friend.nickName },
                  }),
                );
              }}
            />
            <BlockUserDialog
              user={userToBlock}
              onDismiss={() => setUserToBlock(null)}
              onConfirm={(user) => blockMutation.mutate(user.identifier, leave)}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
    gap: 8,
  },
  topBar: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 20,
  },
  identity: {
    alignItems: "center",
    gap: 10,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
  },
  noteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "90%",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
  },
  pressed: {
    opacity: 0.7,
  },
  notFriend: {
    textAlign: "center",
    padding: SCREEN_PADDING,
    opacity: 0.6,
  },
  dangerZone: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 16,
  },
});
