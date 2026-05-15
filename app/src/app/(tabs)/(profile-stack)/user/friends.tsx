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
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Avatar, Button, IconButton, Searchbar, Surface, Text, useTheme } from "react-native-paper";

const PREVIEW_COUNT = 5;

export default function FriendsScreen() {
  const [query, setQuery] = useState("");
  const { acceptMutation, rejectMutation, sendRequestMutation, removeFriendMutation } = useFriendMutations();
  const theme = useTheme();
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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <BackButton />
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.scrollContent}>
        <Searchbar
          placeholder="Sök användare"
          value={query}
          onChangeText={setQuery}
          style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
          inputStyle={{ fontSize: 15 }}
        />

        {showSearchResults && (
          <View style={styles.section}>
            <SectionHeader icon="account-search" label="Sökresultat" color={theme.colors.primary} />
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={styles.cardInner}>
                {searchPending ? (
                  <ActivityIndicator style={styles.loader} />
                ) : searchError ? (
                  <EmptyState text="Något gick fel vid sökning" />
                ) : searchResults?.length === 0 ? (
                  <EmptyState text="Inga användare hittades" />
                ) : (
                  <>
                    {(searchExpanded ? searchResults : searchResults?.slice(0, PREVIEW_COUNT))?.map((user, i, arr) => (
                      <View key={user.identifier}>
                        <Pressable hitSlop={12} onPress={() => {}}>
                          <View style={styles.row}>
                            <Avatar.Text
                              size={40}
                              label={getInitials(user.nickName)}
                              style={{ backgroundColor: theme.colors.primaryContainer }}
                              labelStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 14 }}
                            />
                            <Text style={styles.rowName} variant="bodyLarge">
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
                                style={styles.actionButton}
                              />
                            )}
                          </View>
                        </Pressable>
                        {i < arr.length - 1 && (
                          <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                        )}
                      </View>
                    ))}
                    {(searchResults?.length ?? 0) > PREVIEW_COUNT && (
                      <Button mode="text" onPress={() => setSearchExpanded((v) => !v)} style={styles.retryButton}>
                        {searchExpanded ? "Visa färre" : `Visa alla (${searchResults?.length})`}
                      </Button>
                    )}
                  </>
                )}
              </View>
            </Surface>
          </View>
        )}

        {!incomingPending && !incomingError && (incomingRequests?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionHeader
              icon="account-arrow-down"
              label={`Inkommande (${incomingRequests?.length})`}
              color={theme.colors.tertiary}
            />
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={styles.cardInner}>
                {(incomingExpanded ? incomingRequests : incomingRequests?.slice(0, PREVIEW_COUNT))?.map(
                  (req, i, arr) => (
                    <View key={req.requesterIdentifier}>
                      <View style={styles.row}>
                        <Avatar.Text
                          size={40}
                          label={getInitials(req.requesterNickName)}
                          style={{ backgroundColor: theme.colors.tertiaryContainer }}
                          labelStyle={{ color: theme.colors.onTertiaryContainer, fontSize: 14 }}
                        />
                        <Text style={styles.rowName} variant="bodyLarge">
                          {req.requesterNickName}
                        </Text>
                        <View style={styles.rowActions}>
                          <IconButton
                            hitSlop={16}
                            icon="check"
                            size={25}
                            iconColor={theme.colors.primary}
                            onPress={() => acceptMutation.mutate(req.requesterIdentifier)}
                            disabled={acceptMutation.isPending || rejectMutation.isPending}
                            style={styles.actionButton}
                          />
                          <IconButton
                            hitSlop={16}
                            icon="close"
                            size={25}
                            iconColor={theme.colors.error}
                            onPress={() => rejectMutation.mutate(req.requesterIdentifier)}
                            disabled={acceptMutation.isPending || rejectMutation.isPending}
                            style={styles.actionButton}
                          />
                        </View>
                      </View>
                      {i < arr.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                      )}
                    </View>
                  ),
                )}
                {(incomingRequests?.length ?? 0) > PREVIEW_COUNT && (
                  <Button mode="text" onPress={() => setIncomingExpanded((v) => !v)} style={styles.retryButton}>
                    {incomingExpanded ? "Visa färre" : `Visa alla (${incomingRequests?.length})`}
                  </Button>
                )}
              </View>
            </Surface>
          </View>
        )}
        {incomingError && (
          <View style={styles.section}>
            <SectionHeader icon="account-arrow-down" label="Inkommande" color={theme.colors.tertiary} />
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={styles.cardInner}>
                <EmptyState text="Kunde inte hämta förfrågningar" />
                <Button mode="text" onPress={() => refetchIncoming()} style={styles.retryButton}>
                  Försök igen
                </Button>
              </View>
            </Surface>
          </View>
        )}

        {!outgoingPending && !outgoingError && (outgoingRequests?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionHeader
              icon="account-arrow-right"
              label={`Skickade (${outgoingRequests?.length})`}
              color={theme.colors.secondary}
            />
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={styles.cardInner}>
                {(outgoingExpanded ? outgoingRequests : outgoingRequests?.slice(0, PREVIEW_COUNT))?.map(
                  (req, i, arr) => (
                    <View key={req.receiverIdentifier}>
                      <View style={styles.row}>
                        <Avatar.Text
                          size={40}
                          label={getInitials(req.receiverNickName)}
                          style={{ backgroundColor: theme.colors.secondaryContainer }}
                          labelStyle={{ color: theme.colors.onSecondaryContainer, fontSize: 14 }}
                        />
                        <Text style={styles.rowName} variant="bodyLarge">
                          {req.receiverNickName}
                        </Text>
                        <IconButton
                          hitSlop={16}
                          icon="close"
                          size={25}
                          iconColor={theme.colors.outline}
                          onPress={() => removeFriendMutation.mutate(req.receiverIdentifier)}
                          disabled={removeFriendMutation.isPending}
                          style={styles.actionButton}
                        />
                      </View>
                      {i < arr.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                      )}
                    </View>
                  ),
                )}
                {(outgoingRequests?.length ?? 0) > PREVIEW_COUNT && (
                  <Button mode="text" onPress={() => setOutgoingExpanded((v) => !v)} style={styles.retryButton}>
                    {outgoingExpanded ? "Visa färre" : `Visa alla (${outgoingRequests?.length})`}
                  </Button>
                )}
              </View>
            </Surface>
          </View>
        )}
        {outgoingError && (
          <View style={styles.section}>
            <SectionHeader icon="account-arrow-right" label="Skickade" color={theme.colors.secondary} />
            <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <View style={styles.cardInner}>
                <EmptyState text="Kunde inte hämta förfrågningar" />
                <Button mode="text" onPress={() => refetchOutgoing()} style={styles.retryButton}>
                  Försök igen
                </Button>
              </View>
            </Surface>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader
            icon="account-group"
            label={`Vänner${friends ? ` (${friends.length})` : ""}`}
            color={theme.colors.primary}
          />
          <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.cardInner}>
              {friendsPending ? (
                <ActivityIndicator style={styles.loader} />
              ) : friendsError ? (
                <>
                  <EmptyState text="Kunde inte hämta vänner" />
                  <Button mode="text" onPress={() => refetchFriends()} style={styles.retryButton}>
                    Försök igen
                  </Button>
                </>
              ) : friends?.length === 0 ? (
                <EmptyState text="Du har inga vänner än — sök ovan för att lägga till någon!" />
              ) : (
                <>
                  {(friendsExpanded ? friends : friends?.slice(0, PREVIEW_COUNT))?.map((friend, i, arr) => (
                    <View key={friend.identifier}>
                      <View style={styles.row}>
                        <Avatar.Text
                          size={40}
                          label={getInitials(friend.nickName)}
                          style={{ backgroundColor: theme.colors.primaryContainer }}
                          labelStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 14 }}
                        />
                        <Text style={styles.rowName} variant="bodyLarge">
                          {friend.nickName}
                        </Text>
                        <IconButton
                          hitSlop={16}
                          icon="account-remove"
                          size={25}
                          iconColor={theme.colors.outline}
                          onPress={() => setFriendToRemoveId(friend.identifier)}
                          disabled={removeFriendMutation.isPending}
                          style={styles.actionButton}
                        />
                      </View>
                      {i < arr.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                      )}
                    </View>
                  ))}
                  {(friends?.length ?? 0) > PREVIEW_COUNT && (
                    <Button mode="text" onPress={() => setFriendsExpanded((v) => !v)} style={styles.retryButton}>
                      {friendsExpanded ? "Visa färre" : `Visa alla (${friends?.length})`}
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
            title="Ta bort vän"
            infoText={[
              `Du håller på att ta avsluta din vänskap med ${friends?.find((f) => f.identifier === friendToRemoveId)?.nickName ?? ""}`,
              "Vill du fortsätta?",
            ]}
            cancelText="Avbryt"
            confirmText="Ta bort"
            backgroundColor={theme.colors.surface}
            textColor={theme.colors.onSurface}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text variant="titleSmall" style={[styles.sectionLabel, { color }]}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Text variant="bodyMedium" style={styles.emptyText}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
