import { getAllHikesByUserId } from "@/api/hikes";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import { HikeFilterModal } from "@/components/hike/hike-filter-modal";
import ListHeaderActions, { SortField } from "@/components/list-header-actions";
import LoadingIndicator from "@/components/loading-indicator";
import HikeDetails from "@/components/trail/trail-creator/hike-details";
import { HIKES_STALE_TIME } from "@/constants/cache";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { Hike } from "@/data/types";
import { HikeAccessors, HikeSortOption, useHikeFilters } from "@/hooks/hike/useHikeFilters";
import { formatDate } from "@/utils/format-date";
import FormattedTime from "@/utils/format-time-from-ms";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Icon, Text, useTheme } from "react-native-paper";

// Declared at module level on purpose: a fresh object literal on every render would be a
// new dependency for the hook's memos, and they would recompute on every pass.
const ACCESSORS: HikeAccessors<Hike> = {
  name: (h) => h.name,
  length: (h) => h.hikeLength,
  duration: (h) => h.duration,
  date: (h) => h.createdAt,
};

const SORT_FIELDS: SortField[] = [
  { key: "name", labelKey: "filter.fieldName" },
  // Newest first is what you want from a date the first time you tap it.
  { key: "date", labelKey: "filter.fieldDate", defaultDirection: "desc" },
  { key: "length", labelKey: "filter.fieldLength" },
  { key: "duration", labelKey: "filter.fieldDuration" },
];

export default function MyHikesScreen() {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const user = useAtomValue(stigviddUserAtom);
  const [visible, setVisible] = useState(false);
  const [hike, setSelectedhike] = useState<Hike | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const {
    data: hikes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["hikes", user.data?.identifier],
    queryFn: () => getAllHikesByUserId(user.data!.identifier),
    enabled: isAuthenticated && !!user?.data,
    staleTime: HIKES_STALE_TIME,
  });

  const {
    filteredHikes,
    filters,
    updateFilter,
    updateRangeFilter,
    clearFilters,
    sortBy,
    setSortBy,
    totalCount,
    filteredCount,
    searchQuery,
    setSearchQuery,
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

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <ErrorView error={error} />;
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      {/* Outside the ScrollView so the sort popover stays anchored to the screen
          rather than scrolling away with the list. */}
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
          <Icon source="hiking" size={24} color={theme.colors.tertiary} />
          <Text style={s.titleTextBold}>{t("hike.myHikesTitle")}</Text>
        </ListHeaderActions>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={s.content}>
          <Divider bold={true} />

          {/* Gives up its slot to the header's counter, which matters more while filtering. */}
          {totalCount > 0 && activeFilterCount === 0 && !searchQuery && (
            <Text variant="bodySmall" style={s.sectionSubtitle}>
              {t("hike.tapForDetails")}
            </Text>
          )}

          {totalCount === 0 ? (
            <Text style={s.emptyText}>{t("hike.noHikes")}</Text>
          ) : filteredHikes.length === 0 ? (
            <View style={s.noResults}>
              <Text style={s.emptyText}>{t("hike.noResults")}</Text>
              <Text variant="bodySmall" style={s.sectionSubtitle}>
                {t("trailList.noResultsHint")}
              </Text>
            </View>
          ) : (
            filteredHikes.map((hike) => (
              <Pressable
                style={[s.hikePressable, { backgroundColor: theme.colors.surface }]}
                // Identifier, not index: sorting reorders the list, and index keys would
                // make React reuse the wrong row.
                key={hike.identifier}
                onPress={() => {
                  setSelectedhike(hike);
                  setVisible(true);
                }}
              >
                <View style={s.hikeItem}>
                  <View style={[s.iconCircle, { backgroundColor: theme.colors.secondaryContainer }]}>
                    <MaterialCommunityIcons name="map-legend" size={24} color={theme.colors.secondary} />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.name} numberOfLines={1}>
                      {hike.name}
                    </Text>
                    <View style={s.info}>
                      <Text>{hike.hikeLength} km</Text>
                      <Text>{FormattedTime(hike.duration)}</Text>
                      {/* Sorting by date is meaningless if the date is only on the
                          details page — the list has to show what it is ordered by. */}
                      <Text style={s.date}>{formatDate(hike.createdAt)}</Text>
                    </View>
                  </View>
                  <Icon source="chevron-right" size={20} />
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
      {hike && (
        <HikeDetails
          visible={visible}
          hike={hike}
          onDismiss={() => {
            setVisible(false);
            setSelectedhike(null);
          }}
        />
      )}
      <HikeFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        sharedByNames={[]}
        onUpdateFilter={updateFilter}
        onUpdateRangeFilter={updateRangeFilter}
        onClearFilters={clearFilters}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  titleTextBold: {
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
  hikePressable: {
    padding: 10,
    borderRadius: BORDER_RADIUS,
  },
  hikeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
  },
  info: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  // Pushed to the trailing edge so the date column lines up down the list.
  date: {
    marginLeft: "auto",
    opacity: 0.6,
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
  stickyHeader: {
    paddingTop: 8,
    // Replaces the gap the header used to get from scrollContent.
    paddingBottom: 16,
  },
  scrollContent: {
    paddingBottom: 20,
    gap: 16,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 20,
    opacity: 0.55,
  },
  noResults: {
    alignItems: "center",
    gap: 4,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 10,
  },
  sectionSubtitle: {
    opacity: 0.6,
    paddingHorizontal: 2,
  },
});
