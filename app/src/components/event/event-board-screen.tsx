// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isApiStatus } from "@/api/api-error";
import AlertDialog from "@/components/alert-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import SignInPrompt from "@/components/auth/sign-in-prompt";
import BackButton from "@/components/back-button";
import CountedTextInput from "@/components/counted-text-input";
import ErrorScreen from "@/components/error-screen";
import LoadingIndicator from "@/components/loading-indicator";
import ReportContentForm from "@/components/report/report-content-form";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { EVENT_REQUEST_LIMITS } from "@/constants/event-limits";
import { EventPost } from "@/data/types";
import { eventBoardKey, firstUnreadPostId, useEventBoard, useEventBoardMutations } from "@/hooks/events/useEventBoard";
import { useEvent } from "@/hooks/events/useEventQueries";
import { eventErrorCode } from "@/utils/event-errors";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Platform, StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import EventGoneView from "./event-gone-view";
import EventPinnedPosts from "./event-pinned-posts";
import EventPinsToggle from "./event-pins-toggle";
import EventPostRow from "./event-post-row";

const COMPOSER_HEIGHT = 48;

export default function EventBoardScreen() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();

  if (!isAuthenticated) return <SignInPrompt message={t("events.signInToSee")} />;
  if (!identifier) return <EventGoneView />;
  return <EventBoard identifier={identifier} />;
}

function EventBoard({ identifier }: { identifier: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const event = useEvent(identifier);
  const board = useEventBoard(identifier);
  const { createPostMutation, editPostMutation, deletePostMutation, pinMutation, muteMutation, markReadMutation } =
    useEventBoardMutations(identifier);
  const [draft, setDraft] = useState("");
  const [postToEdit, setPostToEdit] = useState<EventPost | null>(null);
  const [edited, setEdited] = useState("");
  const [postToDelete, setPostToDelete] = useState<EventPost | null>(null);
  const [postToReport, setPostToReport] = useState<EventPost | null>(null);
  const keyboardHeight = useKeyboardHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const lift = Platform.OS === "ios" ? Math.max(0, keyboardHeight - tabBarHeight) : 0;

  const { posts, pinned, muted, lastReadPostAt } = board;
  // Captured once per visit, so the divider stays put after the marker moves. keep-comment: the marker is moved on open
  const [unreadFrom, setUnreadFrom] = useState<string | undefined | null>(null);
  if (unreadFrom === null && board.data) setUnreadFrom(firstUnreadPostId(posts, lastReadPostAt));

  const markRead = markReadMutation.mutate;
  const newestAt = posts[0]?.createdAt;
  useEffect(() => {
    if (newestAt === undefined) return;
    if (lastReadPostAt !== null && Date.parse(newestAt) <= Date.parse(lastReadPostAt)) return;
    markRead(newestAt);
  }, [newestAt, lastReadPostAt, markRead]);

  const [pinsOpen, setPinsOpen] = useState(false);
  const listRef = useRef<FlatList<EventPost>>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = board;
  // An older pin may lie beyond the loaded pages, so pages are fetched until it appears. keep-comment: why the effect pages
  useEffect(() => {
    if (scrollTarget === null) return;
    const index = posts.findIndex((post) => post.identifier === scrollTarget);
    if (index >= 0) {
      setScrollTarget(null);
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5 });
    } else if (hasNextPage) {
      if (!isFetchingNextPage) void fetchNextPage();
    } else {
      setScrollTarget(null);
    }
  }, [scrollTarget, posts, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const canModerate = event.data?.permissions.canPinOrDeletePosts ?? false;
  const pin = pinMutation.mutate;

  const renderItem = useCallback(
    ({ item }: { item: EventPost }) => (
      <EventPostRow
        post={item}
        canModerate={canModerate}
        showUnreadDivider={item.identifier === unreadFrom}
        onEdit={(post) => {
          setPostToEdit(post);
          setEdited(post.body);
        }}
        onDelete={setPostToDelete}
        onPin={(post, pinned) => pin({ postIdentifier: post.identifier, pinned })}
        onReport={setPostToReport}
      />
    ),
    [canModerate, unreadFrom, pin],
  );

  if (board.isLoading || event.isLoading) return <LoadingIndicator />;
  if (isApiStatus(board.error, 404) || isApiStatus(event.error, 404)) return <EventGoneView />;
  if (board.isError && !board.data) return <ErrorScreen error={board.error} onRetry={() => void board.refetch()} />;

  const send = () => {
    const body = draft.trim();
    if (body === "") return;
    // The draft is cleared only on success. keep-comment: a refused post keeps its text
    createPostMutation.mutate(body, { onSuccess: () => setDraft("") });
  };

  const stopEditing = () => {
    setPostToEdit(null);
    setEdited("");
  };

  const saveEdit = () => {
    const body = edited.trim();
    if (!postToEdit || body === "") return;
    if (body === postToEdit.body) {
      stopEditing();
      return;
    }
    // A post that is gone ends the edit; any other failure keeps the text. keep-comment: post_gone has nothing left to save
    editPostMutation.mutate(
      { postIdentifier: postToEdit.identifier, body },
      {
        onSuccess: stopEditing,
        onError: (error) => {
          if (eventErrorCode(error) === "post_gone") stopEditing();
        },
      },
    );
  };

  const editing = postToEdit !== null;
  const value = editing ? edited : draft;
  const busy = editing ? editPostMutation.isPending : createPostMutation.isPending;

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View style={s.topBar}>
        <BackButton />
        <Text style={[s.title, { color: theme.colors.onBackground }]} numberOfLines={1}>
          {event.data?.title ?? t("events.board")}
        </Text>
        <EventPinsToggle count={pinned.length} open={pinsOpen} onToggle={() => setPinsOpen((open) => !open)} />
        <IconButton
          testID="event-board-mute"
          icon={muted ? "bell-off-outline" : "bell-outline"}
          accessibilityLabel={muted ? t("events.unmute") : t("events.mute")}
          disabled={muteMutation.isPending}
          onPress={() => muteMutation.mutate(!muted)}
        />
      </View>

      {pinsOpen ? <EventPinnedPosts pinned={pinned} onSelect={(post) => setScrollTarget(post.identifier)} /> : null}

      <FlatList
        ref={listRef}
        testID="event-board-posts"
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5 }), 100);
        }}
        inverted
        data={posts}
        keyExtractor={(item) => item.identifier}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (board.hasNextPage && !board.isFetchingNextPage) void board.fetchNextPage();
        }}
        ListFooterComponent={board.isFetchingNextPage ? <LoadingIndicator /> : null}
        ListEmptyComponent={
          <Text style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>{t("events.noPosts")}</Text>
        }
      />

      {event.data?.permissions.canPost ? (
        <View
          style={[
            s.composer,
            { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant, marginBottom: lift },
          ]}
        >
          <View style={s.input}>
            {editing ? (
              <View testID="event-post-editing" style={s.editingBar}>
                <Text style={[s.editingText, { color: theme.colors.primary }]}>{t("events.editingPost")}</Text>
                <IconButton
                  testID="event-post-edit-cancel"
                  icon="close"
                  size={18}
                  accessibilityLabel={t("common.cancel")}
                  onPress={stopEditing}
                  style={s.editingClose}
                />
              </View>
            ) : null}
            <CountedTextInput
              testID="event-post-input"
              mode="outlined"
              dense
              multiline
              value={value}
              onChangeText={editing ? setEdited : setDraft}
              placeholder={t("events.writePost")}
              maxLength={EVENT_REQUEST_LIMITS.postBody}
              contentStyle={s.inputText}
            />
          </View>
          <IconButton
            testID="event-post-send"
            icon={editing ? "check" : "send"}
            mode="contained"
            accessibilityLabel={editing ? t("common.save") : t("common.send")}
            disabled={value.trim() === "" || busy}
            onPress={editing ? saveEdit : send}
            style={s.send}
          />
        </View>
      ) : null}

      <AlertDialog
        testID="event-post-delete-dialog"
        visible={postToDelete !== null}
        onDismiss={() => setPostToDelete(null)}
        title={t("events.deletePostTitle")}
        icon="delete-outline"
        tone="danger"
        irreversible
        infoText={[t("events.deletePostBody")]}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        onConfirm={() => {
          if (postToDelete) deletePostMutation.mutate(postToDelete.identifier);
          setPostToDelete(null);
        }}
      />

      {postToReport ? (
        <ReportContentForm
          contentType="EventPost"
          contentIdentifier={postToReport.identifier}
          invalidateQueryKey={eventBoardKey(identifier)}
          visible
          onDismiss={() => setPostToReport(null)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: SCREEN_PADDING,
    gap: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 8,
    gap: 10,
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
  },
  // keep-comment: matches the 48 px dense outlined input beside it, which Paper draws from its top edge
  send: {
    width: COMPOSER_HEIGHT,
    height: COMPOSER_HEIGHT,
    margin: 0,
    borderRadius: BORDER_RADIUS,
  },
  // Paper pins multiline text to the top of its 48 px minimum, so one line sat high. keep-comment: why the override
  inputText: {
    textAlignVertical: "center",
  },
  editingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editingText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  editingClose: {
    margin: 0,
  },
});
