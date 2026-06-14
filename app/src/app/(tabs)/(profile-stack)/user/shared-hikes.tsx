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
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Divider, Icon, IconButton, Surface, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

const PREVIEW_COUNT = 5;

export default function SharedHikesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
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
          <Icon source="hiking" size={24} color={theme.colors.onSurfaceVariant} />
          <Text style={s.headerText}>{t("hike.sharedHikesTitle")}</Text>
        </View>
        <View style={s.content}>
          <Divider bold={true} />

          {!incomingPending && !incomingError && (incomingRequests?.length ?? 0) > 0 && (
            <>
              <View style={s.section}>
                <SectionHeader
                  icon="map-marker-plus"
                  label={t("friends.incomingCount", { count: incomingRequests?.length })}
                  color={theme.colors.onSurfaceVariant}
                  subtitle={t("hike.tapForDetails")}
                />
                <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={0}>
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
                            <View style={[s.iconCircle, { backgroundColor: theme.colors.secondaryContainer }]}>
                              <Fontisto name="map" size={15} color={theme.colors.secondary} />
                            </View>
                            <View style={s.rowLeft}>
                              <Text style={s.rowName} variant="bodyLarge" numberOfLines={1}>
                                {req.hikeName}
                              </Text>
                              <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                                {t("hike.sharedByLabel", { name: req.sharedByName })}
                              </Text>
                            </View>
                            <View style={s.rowActions}>
                              <IconButton
                                hitSlop={16}
                                icon="check-circle-outline"
                                size={30}
                                iconColor={theme.colors.primary}
                                onPress={() => acceptMutation.mutate(req.hikeIdentifier)}
                                disabled={acceptMutation.isPending || rejectMutation.isPending}
                                style={s.actionButton}
                              />
                              <IconButton
                                hitSlop={16}
                                icon="close-circle-outline"
                                size={30}
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
                      <Button mode="text" onPress={() => setIncomingExpanded((v) => !v)} style={s.showMoreButton}>
                        {incomingExpanded
                          ? t("friends.showLess")
                          : t("friends.showAll", { count: incomingRequests?.length })}
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
              <SectionHeader
                icon="account-arrow-down"
                label={t("friends.incomingTitle")}
                color={theme.colors.onSurfaceVariant}
              />
              <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={0}>
                <View style={s.cardInner}>
                  <EmptyState text={t("friends.incomingError")} />
                  <Button mode="text" onPress={() => refetchIncoming()} style={s.showMoreButton}>
                    {t("common.retry")}
                  </Button>
                </View>
              </Surface>
            </View>
          )}

          <View style={s.section}>
            <SectionHeader
              icon="routes"
              label={t("hike.receivedHikes")}
              subtitle={t("hike.tapForDetails")}
              color={theme.colors.onSurfaceVariant}
            />
            <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={0}>
              <View style={s.cardInner}>
                {(hikes?.length ?? 0) === 0 ? (
                  <EmptyState text={t("hike.noShared")} />
                ) : (
                  hikes?.map((hike, index) => (
                    <View key={index}>
                      <TouchableOpacity
                        style={s.row}
                        activeOpacity={0.6}
                        onPress={() => {
                          setSelectedSharedHike(hike);
                          setVisible(true);
                        }}
                      >
                        <View style={[s.iconCircle, { backgroundColor: theme.colors.surfaceVariant }]}>
                          <Fontisto name="map" size={15} color={theme.colors.onSurfaceVariant} />
                        </View>
                        <View style={s.rowLeft}>
                          <Text style={s.rowName} numberOfLines={1}>
                            {hike.hikeName}
                          </Text>
                          <View style={s.metaRow}>
                            <Text variant="bodySmall">{hike.hikeLength} km</Text>
                            <Text variant="bodySmall">{FormattedTime(hike.duration)}</Text>
                          </View>
                          <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                            {t("hike.sharedByLabel", { name: hike.sharedByName })}
                          </Text>
                        </View>
                        <Icon source="chevron-right" size={20} />
                      </TouchableOpacity>
                      {index < hikes.length - 1 && (
                        <View style={[s.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                      )}
                    </View>
                  ))
                )}
              </View>
            </Surface>
          </View>
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

function SectionHeader({
  icon,
  label,
  color,
  subtitle,
}: {
  icon: string;
  label: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionHeaderRow}>
        <MaterialCommunityIcons name={icon as any} size={18} color={color} />
        <Text variant="titleSmall" style={[s.sectionLabel, { color }]}>
          {label}
        </Text>
      </View>
      {subtitle && (
        <Text variant="bodySmall" style={s.sectionSubtitle}>
          {subtitle}
        </Text>
      )}
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
    paddingVertical: 6,
  },
  headerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: BORDER_RADIUS,
    justifyContent: "center",
    alignItems: "center",
  },
  infoBox: {
    borderRadius: BORDER_RADIUS,
    padding: 12,
    gap: 6,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
    gap: 5,
  },
  content: {
    paddingHorizontal: 10,
    gap: 10,
  },
  sectionHeader: {
    gap: 2,
    paddingHorizontal: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontWeight: "600",
    alignSelf: "flex-start",
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    opacity: 0.6,
    paddingHorizontal: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  rowLeft: {
    flex: 1,
  },
  rowName: {
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: "row",
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
  showMoreButton: {
    marginBottom: 8,
  },
});
