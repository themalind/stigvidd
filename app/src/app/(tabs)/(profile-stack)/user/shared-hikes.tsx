import { getIncomingSharedHike, getSharedHikes } from "@/api/shared-hikes";
import { authStateAtom } from "@/atoms/auth-atoms";
import { incomingSharedHikesAtom } from "@/atoms/friends-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import SharedHikeDetails from "@/components/shared-hike/shared-hike-details";
import { BORDER_RADIUS } from "@/constants/constants";
import { SharedHike } from "@/data/types";
import { useSharedHikeMutations } from "@/hooks/shared-hikes/useSharedHikeMutations";
import FormattedTime from "@/utils/format-time-from-ms";
import { Fontisto, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Divider, Icon, IconButton, Surface, Text, useTheme } from "react-native-paper";

const PREVIEW_COUNT = 5;

export default function SharedHikesScreen() {
  const theme = useTheme();
  const { acceptMutation, rejectMutation } = useSharedHikeMutations();
  const [incomingExpanded, setIncomingExpanded] = useState(false);
  const [authState] = useAtom(authStateAtom);
  const user = useAtomValue(stigviddUserAtom);
  const [visible, setVisible] = useState(false);
  const [sharedHike, setSelectedSharedHike] = useState<SharedHike | null>(null);
  const [selectedIncomingId, setSelectedIncomingId] = useState<string | null>(null);
  const [incomingDetailVisible, setIncomingDetailVisible] = useState(false);
  const [{ data: incomingRequests, isPending: incomingPending, isError: incomingError, refetch: refetchIncoming }] =
    useAtom(incomingSharedHikesAtom);

  const {
    data: incomingHikeDetail,
    isLoading: incomingDetailLoading,
    isError: incomingDetailError,
  } = useQuery({
    queryKey: ["incoming-hike-detail", selectedIncomingId],
    queryFn: () => getIncomingSharedHike(selectedIncomingId!),
    enabled: !!selectedIncomingId,
  });

  const {
    data: hikes,
    isLoading,
    isError: getSharedHikesError,
    error,
  } = useQuery({
    queryKey: ["shared-hikes", user.data?.identifier],
    queryFn: () => getSharedHikes(),
    enabled: !!authState.isAuthenticated && !!user?.data,
  });

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading || incomingPending) {
    return <LoadingIndicator />;
  }

  if (getSharedHikesError) {
    return <ErrorView error={error} />;
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <BackButton />
          <Icon source="hiking" size={24} color={theme.colors.tertiary} />
          <Text style={s.headerText}>Delade promenader</Text>
        </View>
        <View style={s.content}>
          <View style={[s.infoBox, { backgroundColor: theme.colors.outlineVariant }]}>
            <Text>Tryck på en promenad för att se mer information eller ta bort den.</Text>
          </View>
          <Divider bold={true} />

          {!incomingPending && !incomingError && (incomingRequests?.length ?? 0) > 0 && (
            <>
              <View style={s.section}>
                <SectionHeader
                  icon="map-marker-plus"
                  label={`Inkommande (${incomingRequests?.length})`}
                  color={theme.colors.tertiary}
                />
                <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
                  <View style={s.cardInner}>
                    {(incomingExpanded ? incomingRequests : incomingRequests?.slice(0, PREVIEW_COUNT))?.map(
                      (req, i, arr) => (
                        <View key={req.hikeIdentifier}>
                          <TouchableOpacity
                            style={s.row}
                            activeOpacity={0.6}
                            onPress={() => {
                              setSelectedIncomingId(req.hikeIdentifier);
                              setIncomingDetailVisible(true);
                            }}
                          >
                            <View style={s.rowLeft}>
                              <View style={s.rowNameRow}>
                                <Fontisto name="map" size={15} color={theme.colors.secondary} />
                                <Text style={s.rowName} variant="bodyLarge" numberOfLines={1}>
                                  {req.hikeName}
                                </Text>
                              </View>
                              <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                                Delad av: {req.sharedByName}
                              </Text>
                            </View>
                            <View style={s.rowActions}>
                              <IconButton
                                hitSlop={16}
                                icon="check"
                                size={25}
                                iconColor={theme.colors.primary}
                                onPress={() => acceptMutation.mutate(req.hikeIdentifier)}
                                disabled={acceptMutation.isPending || rejectMutation.isPending}
                                style={s.actionButton}
                              />
                              <IconButton
                                hitSlop={16}
                                icon="close"
                                size={25}
                                iconColor={theme.colors.error}
                                onPress={() => rejectMutation.mutate(req.hikeIdentifier)}
                                disabled={acceptMutation.isPending || rejectMutation.isPending}
                                style={s.actionButton}
                              />
                            </View>
                          </TouchableOpacity>
                          {i < arr.length - 1 && (
                            <View style={[s.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                          )}
                        </View>
                      ),
                    )}
                    {(incomingRequests?.length ?? 0) > PREVIEW_COUNT && (
                      <Button mode="text" onPress={() => setIncomingExpanded((v) => !v)} style={s.retryButton}>
                        {incomingExpanded ? "Visa färre" : `Visa alla (${incomingRequests?.length})`}
                      </Button>
                    )}
                  </View>
                </Surface>
              </View>
              <Divider />
            </>
          )}
          {incomingError && (
            <View style={s.section}>
              <SectionHeader icon="account-arrow-down" label="Inkommande" color={theme.colors.tertiary} />
              <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={s.cardInner}>
                  <EmptyState text="Kunde inte hämta förfrågningar" />
                  <Button mode="text" onPress={() => refetchIncoming()} style={s.retryButton}>
                    Försök igen
                  </Button>
                </View>
              </Surface>
            </View>
          )}

          {hikes?.length === 0 ? (
            <Text style={[s.emptyHikes, { color: theme.colors.onBackground }]}>
              Inga delade promenader här än
            </Text>
          ) : (
            hikes?.map((hike, index) => (
              <Pressable
                style={[s.hikePressable, { backgroundColor: theme.colors.surface }]}
                key={index}
                onPress={() => {
                  setSelectedSharedHike(hike);
                  setVisible(true);
                }}
              >
                <View style={s.hikeInfo}>
                  <View style={[s.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Fontisto name="map" size={24} color={theme.colors.secondary} />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.name} numberOfLines={1}>
                      {hike.hikeName}
                    </Text>
                    <View style={s.info}>
                      <Text variant="bodySmall">{hike.hikeLength} km</Text>
                      <Text variant="bodySmall">{FormattedTime(hike.duration)}</Text>
                    </View>
                    <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                      Delad av: {hike.sharedByName}
                    </Text>
                  </View>
                  <Icon source="chevron-right" size={20} />
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
      {sharedHike && (
        <SharedHikeDetails
          visible={visible}
          sharedHike={sharedHike}
          onDismiss={() => {
            setVisible(false);
            setSelectedSharedHike(null);
          }}
        />
      )}
      <SharedHikeDetails
        visible={incomingDetailVisible}
        sharedHike={incomingHikeDetail ?? null}
        isLoading={incomingDetailLoading}
        isError={incomingDetailError}
        onDismiss={() => {
          setIncomingDetailVisible(false);
          setSelectedIncomingId(null);
        }}
        onAccept={() => {
          acceptMutation.mutate(selectedIncomingId!);
          setIncomingDetailVisible(false);
          setSelectedIncomingId(null);
        }}
        onReject={() => {
          rejectMutation.mutate(selectedIncomingId!);
          setIncomingDetailVisible(false);
          setSelectedIncomingId(null);
        }}
        isPending={acceptMutation.isPending || rejectMutation.isPending}
      />
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
    paddingLeft: Platform.select({ ios: 0, default: 10 }),
  },
  headerText: {
    fontSize: 17,
    fontWeight: "700",
  },
  hikePressable: {
    padding: 10,
    borderRadius: BORDER_RADIUS,
  },
  hikeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: BORDER_RADIUS,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontWeight: "bold",
  },
  info: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 2,
  },
  infoBox: {
    borderRadius: BORDER_RADIUS,
    padding: 12,
    gap: 6,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
  },
  content: {
    paddingHorizontal: 10,
    gap: 10,
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
  section: {
    gap: 8,
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  rowName: {
    flex: 1,
    fontWeight: "500",
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  actionButton: {
    margin: 0,
  },
  rowActions: {
    flexDirection: "row",
    gap: 0,
  },
  rowLeft: {
    flex: 1,
  },
  rowNameRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  emptyHikes: {
    textAlign: "center",
    paddingVertical: 20,
  },
});
