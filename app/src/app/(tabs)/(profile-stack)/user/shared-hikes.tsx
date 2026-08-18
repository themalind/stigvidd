import { getIncomingSharedHike, getSharedHikes } from "@/api/shared-hikes";
import { incomingSharedHikesAtom } from "@/atoms/friends-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import { HikeFilterModal } from "@/components/hike/hike-filter-modal";
import RouteThumbnail from "@/components/hike/route-thumbnail";
import ListHeaderActions, { SortField } from "@/components/list-header-actions";
import LoadingIndicator from "@/components/loading-indicator";
import SharedHikeDetails from "@/components/shared-hike/shared-hike-details";
import SharedHikeStatsBanner from "@/components/shared-hike/shared-hike-stats-banner";
import { SHARED_HIKES_STALE_TIME } from "@/constants/cache";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { SharedHike } from "@/data/types";
import { HikeAccessors, HikeSortOption, useHikeFilters } from "@/hooks/hike/useHikeFilters";
import { useSharedHikeMutations } from "@/hooks/shared-hikes/useSharedHikeMutations";
import { formatDate } from "@/utils/format-date";
import FormattedTime from "@/utils/format-time-from-ms";
import { Fontisto, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, Icon, IconButton, Surface, Text, useTheme } from "react-native-paper";

const PREVIEW_COUNT = 5;

// Maps SharedHike's differently named fields onto the same filter hook my-hikes uses.
const ACCESSORS: HikeAccessors<SharedHike> = {
  name: (h) => h.hikeName,
  length: (h) => h.hikeLength,
  duration: (h) => h.duration,
  date: (h) => h.sharedAt,
  sharedBy: (h) => h.sharedByName,
};

const SORT_FIELDS: SortField[] = [
  { key: "name", labelKey: "filter.fieldName" },
  // The "date" sort key with its own label: here the date is when the hike was shared.
  { key: "date", labelKey: "filter.fieldShared", defaultDirection: "desc" },
  { key: "length", labelKey: "filter.fieldLength" },
  { key: "duration", labelKey: "filter.fieldDuration" },
];

export default function SharedHikesScreen() {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { acceptMutation, rejectMutation } = useSharedHikeMutations();
  const [incomingExpanded, setIncomingExpanded] = useState(false);
  const user = useAtomValue(stigviddUserAtom);
  const [visible, setVisible] = useState(false);
  const [sharedHike, setSelectedSharedHike] = useState<SharedHike | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
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
    enabled: isAuthenticated && !!user?.data,
    staleTime: SHARED_HIKES_STALE_TIME,
  });

  // Filtering covers received hikes only. Incoming requests are an action list, and keep
  // their preview cap and their own order.
  const {
    filteredHikes,
    filters,
    updateFilter,
    updateRangeFilter,
    clearFilters,
    sortBy,
    setSortBy,
    sharedByNames,
    totalCount,
    filteredCount,
    searchQuery,
    setSearchQuery,
    ranges,
  } = useHikeFilters(hikes, ACCESSORS);

  // Each range is one choice to the user even though it is stored as two keys.
  const activeFilterCount = useMemo(() => {
    const { minLength, maxLength, minDuration, maxDuration, ...rest } = filters;
    return (
      Object.values(rest).filter((v) => v !== undefined).length +
      (minLength !== undefined || maxLength !== undefined ? 1 : 0) +
      (minDuration !== undefined || maxDuration !== undefined ? 1 : 0)
    );
  }, [filters]);

  if (isLoading || incomingPending) {
    return <LoadingIndicator />;
  }

  if (getSharedHikesError) {
    return <ErrorView error={error} />;
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View style={s.stickyHeader}>
        <ListHeaderActions
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t("hike.searchPlaceholder")}
          sortFields={SORT_FIELDS}
          sortBy={sortBy}
          onSortChange={(v) => setSortBy(v as HikeSortOption)}
          onOpenFilters={() => setFilterModalVisible(true)}
          activeFilterCount={activeFilterCount}
          showingLabel={t("hike.showing", { count: totalCount, shown: filteredCount })}
          onClearFilters={clearFilters}
        >
          <BackButton />
          <Icon source="hiking" size={24} color={theme.colors.onSurfaceVariant} />
          <Text style={s.headerText}>{t("hike.sharedHikesTitle")}</Text>
        </ListHeaderActions>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={s.content}>
          {hikes && totalCount > 0 && <SharedHikeStatsBanner hikes={hikes} />}

          {!incomingPending && !incomingError && (incomingRequests?.length ?? 0) > 0 && (
            <>
              <View style={s.section}>
                <SectionHeader
                  icon="map-marker-plus"
                  label={t("friends.incomingCount", { count: incomingRequests?.length })}
                  color={theme.colors.onSurfaceVariant}
                  subtitle={t("hike.tapBeforeDeciding")}
                />
                <Surface style={[s.card, { backgroundColor: theme.colors.surface }]} elevation={0}>
                  <View style={s.cardInner}>
                    {(incomingExpanded ? incomingRequests : incomingRequests?.slice(0, PREVIEW_COUNT))?.map(
                      (req, i, arr) => (
                        <View key={req.hikeIdentifier}>
                          <Pressable
                            style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
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
                          </Pressable>
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

          {totalCount === 0 && <EmptyState text={t("hike.noShared")} />}

          {totalCount > 0 && (
            <View style={s.section}>
              <SectionHeader icon="routes" label={t("hike.receivedHikes")} color={theme.colors.onSurfaceVariant} />
              <View style={[s.card, { backgroundColor: theme.colors.surface }]}>
                <View style={s.cardInner}>
                  {filteredHikes.length === 0 && <EmptyState text={t("hike.noResults")} />}
                  {filteredHikes.map((hike, index) => (
                    // Identifier, not index: sorting reorders the list.
                    <View key={hike.hikeIdentifier}>
                      <Pressable
                        style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
                        onPress={() => {
                          setSelectedSharedHike(hike);
                          setVisible(true);
                        }}
                      >
                        {/* Neutral tint: the accent stays with the incoming rows above,
                            which are the ones asking for a decision. */}
                        <RouteThumbnail
                          coordinates={hike.coordinates}
                          identifier={hike.hikeIdentifier}
                          background={theme.colors.surfaceVariant}
                          stroke={theme.colors.onSurfaceVariant}
                        />
                        <View style={s.rowLeft}>
                          <Text style={s.rowName} numberOfLines={1}>
                            {hike.hikeName}
                          </Text>
                          <View style={s.metaRow}>
                            <Text variant="bodySmall">{hike.hikeLength} km</Text>
                            <Text variant="bodySmall">{FormattedTime(hike.duration)}</Text>
                          </View>
                          {/* Who and when on one line — the list shows the date it can be
                              sorted by. */}
                          <View style={s.sharedRow}>
                            <Text
                              variant="bodySmall"
                              style={[s.sharedBy, { color: theme.colors.secondary }]}
                              numberOfLines={1}
                            >
                              {t("hike.sharedByLabel", { name: hike.sharedByName })}
                            </Text>
                            <Text variant="bodySmall" style={s.sharedDate}>
                              {formatDate(hike.sharedAt)}
                            </Text>
                          </View>
                        </View>
                        <Icon source="chevron-right" size={20} />
                      </Pressable>
                      {index < filteredHikes.length - 1 && (
                        <View style={[s.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </View>
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
      <HikeFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        sharedByNames={sharedByNames}
        ranges={ranges}
        onUpdateFilter={updateFilter}
        onUpdateRangeFilter={updateRangeFilter}
        onClearFilters={clearFilters}
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
  stickyHeader: {
    paddingTop: 8,
    paddingBottom: 8,
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
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
    gap: 5,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
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
  sharedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Flexible, so a long sharer name truncates instead of pushing the date off the row.
  sharedBy: {
    flex: 1,
  },
  sharedDate: {
    opacity: 0.6,
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
