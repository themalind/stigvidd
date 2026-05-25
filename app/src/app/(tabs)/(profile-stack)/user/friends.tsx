import { getOutgoingRequests } from "@/api/friends";
import { friendsAtom, incomingRequestsAtom, userSearchAtomFamily } from "@/atoms/friends-atoms";
import AlertDialog from "@/components/alert-dialog";
import BackButton from "@/components/back-button";
import { BORDER_RADIUS } from "@/constants/constants";
import { useFriendMutations } from "@/hooks/friends/useFriendMutations";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Avatar, Button, IconButton, Searchbar, Surface, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

const PREVIEW_COUNT = 5;

export default function FriendsScreen() {
  const [query, setQuery] = useState("");
  const { acceptMutation, rejectMutation, sendRequestMutation, removeFriendMutation } = useFriendMutations();
  const theme = useTheme();
  const { t } = useTranslation();
  const [friendToRemoveId, setFriendToRemoveId] = useState<string | null>(null);
  const [friendsExpanded, setFriendsExpanded] = useState(false);
  const [incomingExpanded, setIncomingExpanded] = useState(false);
  const [outgoingExpanded, setOutgoingExpanded] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const [{ data: incomingRequests, isPending: incomingPending, isError: incomingError, refetch: refetchIncoming }] =
    useAtom(incomingRequestsAtom);
  const [{ data: searchResults, isPending: searchPending, isError: searchError }] = useAtom(
    userSearchAtomFamily(query),
  );
  const [{ data: friends, isPending: friendsPending, isError: friendsError, refetch: refetchFriends }] =
    useAtom(friendsAtom);

  const {
    data: outgoingRequests,
    isPending: outgoingPending,
    isError: outgoingError,
    refetch: refetchOutgoing,
  } = useQuery({
    queryKey: ["friends", "outgoing"],
    queryFn: () => getOutgoingRequests(),
  });

  const showSearchResults = query.trim().length >= 3;

  function getInitials(name: string) {
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <BackButton />
          <MaterialCommunityIcons name="account-group" size={24} color={theme.colors.primary} />
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

          {showSearchResults && (
            <View style={s.section}>
              <SectionHeader icon="account-search" label={t("friends.searchResults")} color={theme.colors.primary} />
              <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={s.cardInner}>
                  {searchPending ? (
                    <ActivityIndicator style={s.loader} />
                  ) : searchError ? (
                    <EmptyState text={t("friends.searchError")} />
                  ) : searchResults?.length === 0 ? (
                    <EmptyState text={t("friends.noResults")} />
                  ) : (
                    <>
                      {(searchExpanded ? searchResults : searchResults?.slice(0, PREVIEW_COUNT))?.map(
                        (user, i, arr) => (
                          <View key={user.identifier}>
                            <Pressable hitSlop={12} onPress={() => {}}>
                              <View style={s.row}>
                                <Avatar.Text
                                  size={40}
                                  label={getInitials(user.nickName)}
                                  style={{ backgroundColor: theme.colors.primaryContainer }}
                                  labelStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 14 }}
                                />
                                <Text style={s.rowName} variant="bodyLarge">
                                  {user.nickName}
                                </Text>
                                {friends?.some((f) => f.identifier === user.identifier) ? (
                                  <MaterialCommunityIcons name="account-check" size={22} color={theme.colors.primary} />
                                ) : outgoingRequests?.some((r) => r.receiverIdentifier === user.identifier) ? (
                                  <MaterialCommunityIcons name="clock-outline" size={22} color={theme.colors.outline} />
                                ) : (
                                  <IconButton
                                    hitSlop={20}
                                    icon="account-plus"
                                    size={25}
                                    onPress={() => sendRequestMutation.mutate(user.nickName)}
                                    style={s.actionButton}
                                  />
                                )}
                              </View>
                            </Pressable>
                            {i < arr.length - 1 && (
                              <View style={[s.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                            )}
                          </View>
                        ),
                      )}
                      {(searchResults?.length ?? 0) > PREVIEW_COUNT && (
                        <Button mode="text" onPress={() => setSearchExpanded((v) => !v)} style={s.retryButton}>
                          {searchExpanded
                            ? t("friends.showLess")
                            : t("friends.showAll", { count: searchResults?.length })}
                        </Button>
                      )}
                    </>
                  )}
                </View>
              </Surface>
            </View>
          )}

          {!incomingPending && !incomingError && (incomingRequests?.length ?? 0) > 0 && (
            <View style={s.section}>
              <SectionHeader
                icon="account-arrow-down"
                label={t("friends.incomingCount", { count: incomingRequests?.length })}
                color={theme.colors.tertiary}
              />
              <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={s.cardInner}>
                  {(incomingExpanded ? incomingRequests : incomingRequests?.slice(0, PREVIEW_COUNT))?.map(
                    (req, i, arr) => (
                      <View key={req.requesterIdentifier}>
                        <View style={s.row}>
                          <Avatar.Text
                            size={40}
                            label={getInitials(req.requesterNickName)}
                            style={{ backgroundColor: theme.colors.tertiaryContainer }}
                            labelStyle={{ color: theme.colors.onTertiaryContainer, fontSize: 14 }}
                          />
                          <Text style={s.rowName} variant="bodyLarge">
                            {req.requesterNickName}
                          </Text>
                          <View style={s.rowActions}>
                            <IconButton
                              hitSlop={16}
                              icon="check"
                              size={25}
                              iconColor={theme.colors.primary}
                              onPress={() => acceptMutation.mutate(req.requesterIdentifier)}
                              disabled={acceptMutation.isPending || rejectMutation.isPending}
                              style={s.actionButton}
                            />
                            <IconButton
                              hitSlop={16}
                              icon="close"
                              size={25}
                              iconColor={theme.colors.error}
                              onPress={() => rejectMutation.mutate(req.requesterIdentifier)}
                              disabled={acceptMutation.isPending || rejectMutation.isPending}
                              style={s.actionButton}
                            />
                          </View>
                        </View>
                        {i < arr.length - 1 && (
                          <View style={[s.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                        )}
                      </View>
                    ),
                  )}
                  {(incomingRequests?.length ?? 0) > PREVIEW_COUNT && (
                    <Button mode="text" onPress={() => setIncomingExpanded((v) => !v)} style={s.retryButton}>
                      {incomingExpanded
                        ? t("friends.showLess")
                        : t("friends.showAll", { count: incomingRequests?.length })}
                    </Button>
                  )}
                </View>
              </Surface>
            </View>
          )}
          {incomingError && (
            <View style={s.section}>
              <SectionHeader
                icon="account-arrow-down"
                label={t("friends.incomingTitle")}
                color={theme.colors.tertiary}
              />
              <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={s.cardInner}>
                  <EmptyState text={t("friends.incomingError")} />
                  <Button mode="text" onPress={() => refetchIncoming()} style={s.retryButton}>
                    {t("friends.retry")}
                  </Button>
                </View>
              </Surface>
            </View>
          )}

          {!outgoingPending && !outgoingError && (outgoingRequests?.length ?? 0) > 0 && (
            <View style={s.section}>
              <SectionHeader
                icon="account-arrow-right"
                label={t("friends.outgoingCount", { count: outgoingRequests?.length })}
                color={theme.colors.secondary}
              />
              <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={s.cardInner}>
                  {(outgoingExpanded ? outgoingRequests : outgoingRequests?.slice(0, PREVIEW_COUNT))?.map(
                    (req, i, arr) => (
                      <View key={req.receiverIdentifier}>
                        <View style={s.row}>
                          <Avatar.Text
                            size={40}
                            label={getInitials(req.receiverNickName)}
                            style={{ backgroundColor: theme.colors.secondaryContainer }}
                            labelStyle={{ color: theme.colors.onSecondaryContainer, fontSize: 14 }}
                          />
                          <Text style={s.rowName} variant="bodyLarge">
                            {req.receiverNickName}
                          </Text>
                          <IconButton
                            hitSlop={16}
                            icon="close"
                            size={25}
                            iconColor={theme.colors.outline}
                            onPress={() => removeFriendMutation.mutate(req.receiverIdentifier)}
                            disabled={removeFriendMutation.isPending}
                            style={s.actionButton}
                          />
                        </View>
                        {i < arr.length - 1 && (
                          <View style={[s.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                        )}
                      </View>
                    ),
                  )}
                  {(outgoingRequests?.length ?? 0) > PREVIEW_COUNT && (
                    <Button mode="text" onPress={() => setOutgoingExpanded((v) => !v)} style={s.retryButton}>
                      {outgoingExpanded
                        ? t("friends.showLess")
                        : t("friends.showAll", { count: outgoingRequests?.length })}
                    </Button>
                  )}
                </View>
              </Surface>
            </View>
          )}
          {outgoingError && (
            <View style={s.section}>
              <SectionHeader
                icon="account-arrow-right"
                label={t("friends.outgoingTitle")}
                color={theme.colors.secondary}
              />
              <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={s.cardInner}>
                  <EmptyState text={t("friends.outgoingError")} />
                  <Button mode="text" onPress={() => refetchOutgoing()} style={s.retryButton}>
                    {t("friends.retry")}
                  </Button>
                </View>
              </Surface>
            </View>
          )}

          <View style={s.section}>
            <SectionHeader
              icon="account-group"
              label={friends ? t("friends.friendsCount", { count: friends.length }) : t("friends.friendsTitle")}
              color={theme.colors.primary}
            />
            <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={s.cardInner}>
                {friendsPending ? (
                  <ActivityIndicator style={s.loader} />
                ) : friendsError ? (
                  <>
                    <EmptyState text={t("friends.friendsError")} />
                    <Button mode="text" onPress={() => refetchFriends()} style={s.retryButton}>
                      {t("friends.retry")}
                    </Button>
                  </>
                ) : friends?.length === 0 ? (
                  <EmptyState text={t("friends.noFriends")} />
                ) : (
                  <>
                    {(friendsExpanded ? friends : friends?.slice(0, PREVIEW_COUNT))?.map((friend, i, arr) => (
                      <View key={friend.identifier}>
                        <View style={s.row}>
                          <Avatar.Text
                            size={40}
                            label={getInitials(friend.nickName)}
                            style={{ backgroundColor: theme.colors.primaryContainer }}
                            labelStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 14 }}
                          />
                          <Text style={s.rowName} variant="bodyLarge">
                            {friend.nickName}
                          </Text>
                          <IconButton
                            hitSlop={16}
                            icon="account-remove"
                            size={25}
                            iconColor={theme.colors.outline}
                            onPress={() => setFriendToRemoveId(friend.identifier)}
                            disabled={removeFriendMutation.isPending}
                            style={s.actionButton}
                          />
                        </View>
                        {i < arr.length - 1 && (
                          <View style={[s.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                        )}
                      </View>
                    ))}
                    {(friends?.length ?? 0) > PREVIEW_COUNT && (
                      <Button mode="text" onPress={() => setFriendsExpanded((v) => !v)} style={s.retryButton}>
                        {friendsExpanded ? t("friends.showLess") : t("friends.showAll", { count: friends?.length })}
                      </Button>
                    )}
                  </>
                )}
              </View>
            </Surface>
            <AlertDialog
              visible={friendToRemoveId !== null}
              onDismiss={() => setFriendToRemoveId(null)}
              onConfirm={() => {
                if (friendToRemoveId) removeFriendMutation.mutate(friendToRemoveId);
                setFriendToRemoveId(null);
              }}
              title={t("friends.removeTitle")}
              infoText={[
                t("friends.removeInfo", {
                  name: friends?.find((f) => f.identifier === friendToRemoveId)?.nickName ?? "",
                }),
                t("friends.removeContinue"),
              ]}
              cancelText={t("common.cancel")}
              confirmText={t("friends.remove")}
              backgroundColor={theme.colors.surface}
              textColor={theme.colors.onSurface}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={s.sectionHeader}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text variant="titleSmall" style={[s.sectionLabel, { color }]}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Text variant="bodyMedium" style={s.emptyText}>
      {text}
    </Text>
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
    paddingLeft: Platform.select({ ios: 0, default: 12 }),
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
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
    paddingHorizontal: 12,
    gap: 20,
  },
  searchbar: {
    borderRadius: BORDER_RADIUS,
    elevation: 0,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: BORDER_RADIUS,
  },
  cardInner: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  rowName: {
    flex: 1,
    fontWeight: "500",
  },
  rowActions: {
    flexDirection: "row",
    gap: 0,
  },
  actionButton: {
    margin: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    opacity: 0.55,
  },
  retryButton: {
    marginBottom: 8,
  },
  loader: {
    paddingVertical: 20,
  },
});
