// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getAllHikesByUserId } from "@/api/hikes";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAuth } from "@/components/auth/auth-provider";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import { HikeFilterModal } from "@/components/hike/hike-filter-modal";
import RouteThumbnail from "@/components/hike/route-thumbnail";
import ListHeaderActions, { SortField } from "@/components/list-header-actions";
import LoadingIndicator from "@/components/loading-indicator";
import HikeDetails from "@/components/trail/trail-creator/hike-details";
import HikeStatsBanner from "@/components/user/hike-stats-banner";
import { HIKES_STALE_TIME } from "@/constants/cache";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { Hike } from "@/data/types";
import { HikeAccessors, HikeSortOption, useHikeFilters } from "@/hooks/hike/useHikeFilters";
import { formatDate } from "@/utils/format-date";
import FormattedTime from "@/utils/format-time-from-ms";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

// Module level: a fresh object literal each render would recompute the hook's memos.
const ACCESSORS: HikeAccessors<Hike> = {
  name: (h) => h.name,
  length: (h) => h.hikeLength,
  duration: (h) => h.duration,
  date: (h) => h.createdAt,
};

const SORT_FIELDS: SortField[] = [
  { key: "name", labelKey: "filter.fieldName" },
  // Dates sort newest first on the first tap.
  { key: "date", labelKey: "filter.fieldDate", defaultDirection: "desc" },
  { key: "length", labelKey: "filter.fieldLength" },
  { key: "duration", labelKey: "filter.fieldDuration" },
];

interface HikeRowProps {
  hike: Hike;
  onPress: (hike: Hike) => void;
}

// Memoized so a row keeps its parsed thumbnail while the screen re-renders around it.
const HikeRow = memo(function HikeRow({ hike, onPress }: HikeRowProps) {
  const theme = useTheme();

  return (
    <Pressable style={[s.hikePressable, { backgroundColor: theme.colors.surface }]} onPress={() => onPress(hike)}>
      <View style={s.hikeItem}>
        <RouteThumbnail coordinates={hike.coordinates} identifier={hike.identifier} />
        <View style={s.flex}>
          <Text style={s.name} numberOfLines={1}>
            {hike.name}
          </Text>
          <View style={s.info}>
            <Text>{hike.hikeLength} km</Text>
            <Text>{FormattedTime(hike.duration)}</Text>
            {/* The list shows the date it can be sorted by. */}
            <Text style={s.date}>{formatDate(hike.createdAt)}</Text>
          </View>
        </View>
        <Icon source="chevron-right" size={20} />
      </View>
    </Pressable>
  );
});

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

  const openHike = useCallback((selected: Hike) => {
    setSelectedhike(selected);
    setVisible(true);
  }, []);

  const renderHike = useCallback(({ item }: { item: Hike }) => <HikeRow hike={item} onPress={openHike} />, [openHike]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
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
          <Icon source="hiking" size={24} color={theme.colors.tertiary} />
          <Text style={s.titleTextBold}>{t("hike.myHikesTitle")}</Text>
        </ListHeaderActions>
      </View>
      <FlatList
        data={filteredHikes}
        renderItem={renderHike}
        // Identifier, not index: sorting reorders the list.
        keyExtractor={(item) => item.identifier}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        // Each row parses its own coordinate payload, so windowing is what keeps a long
        // collection off the first paint.
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        ListHeaderComponent={hikes && totalCount > 0 ? <HikeStatsBanner hikes={hikes} /> : null}
        ListEmptyComponent={
          totalCount === 0 ? (
            <Text style={s.emptyText}>{t("hike.noHikes")}</Text>
          ) : (
            <View style={s.noResults}>
              <Text style={s.emptyText}>{t("hike.noResults")}</Text>
              <Text variant="bodySmall" style={s.sectionSubtitle}>
                {t("trailList.noResultsHint")}
              </Text>
            </View>
          )
        }
      />
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
        ranges={ranges}
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
  // Trailing edge, so the date column lines up down the list.
  date: {
    marginLeft: "auto",
    opacity: 0.6,
  },
  stickyHeader: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  // Holds the stats banner too, which needs the padding to break back out of.
  listContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 20,
    gap: 10,
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
  sectionSubtitle: {
    opacity: 0.6,
    paddingHorizontal: 2,
  },
});
