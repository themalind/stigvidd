import { userLocationAtom } from "@/atoms/location-atoms";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import LoadingIndicator from "@/components/loading-indicator";
import { TrailFilterModal } from "@/components/trail/trail-list/trail-filter-modal";
import TrailItem from "@/components/trail/trail-list/trail-item";
import { TrailShortInfoResponse } from "@/data/types";
import { useTrailFilters } from "@/hooks/trail/useTrailFilters";
import { useTrails } from "@/hooks/trail/useTrails";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import React, { useCallback, useRef, useState } from "react";
import { Appearance, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Text, TextInput, useTheme } from "react-native-paper";

export default function TrailsScreen() {
  const theme = useTheme();
  const listRef = useRef<FlatList>(null);
  const [userTheme] = useAtom(userThemeAtom);
  const userLocation = useAtomValue(userLocationAtom);
  const colorScheme = Appearance.getColorScheme();
  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;
  const hikers =
    finalTheme === "dark"
      ? require("../../assets/images/mrHike-light.png")
      : require("../../assets/images/mrHike-dark.png");

  const { data: trails, isLoading, isError, refetch, isFetching } = useTrails();
  const onRefresh = () => {
    refetch();
  };

  const {
    filteredTrails,
    filters,
    updateFilter,
    updateLengthFilter,
    clearFilters,
    sortBy,
    setSortBy,
    cities,
    classifications,
    totalCount,
    filteredCount,
    searchQuery,
    setSearchQuery,
  } = useTrailFilters(trails, userLocation);

  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const handlePress = useCallback((identifier: string) => {
    router.navigate({
      pathname: "/(tabs)/(stacks)/trail/[identifier]",
      params: { identifier, returnTo: "/(tabs)/trails" },
    });
  }, []);

  const renderTrailItem = useCallback(
    ({ item }: { item: TrailShortInfoResponse }) => <TrailItem item={item} handlePress={handlePress} />,
    [handlePress],
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <View>
        <Text>Kunde inte ladda leder</Text>
        <Pressable onPress={() => refetch()} style={s.retryButton}>
          <Text>Försök igen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        ref={listRef}
        data={filteredTrails}
        renderItem={renderTrailItem}
        keyExtractor={(item) => item.identifier}
        contentContainerStyle={s.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        ListHeaderComponent={
          <>
            <View style={s.headerRow}>
              <View style={s.titleRow}>
                <Image contentFit="contain" source={hikers} style={s.hikers} />
                <Text style={[s.titleText, { color: theme.colors.onBackground }]}>Vandringsleder</Text>
              </View>
              <Pressable onPress={() => setFilterModalVisible(true)}>
                <View style={[s.filterButtonInner, { backgroundColor: theme.colors.primary }]}>
                  <MaterialIcons name="filter-list" size={24} color={theme.colors.onPrimary} />
                  <Text style={[s.filterButtonText, { color: theme.colors.onPrimary }]}>Filtrera</Text>
                </View>
              </Pressable>
            </View>
            <TextInput
              mode="outlined"
              placeholder="Sök efter led eller ort..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              left={<TextInput.Icon icon="magnify" />}
              right={searchQuery ? <TextInput.Icon icon="close" onPress={() => setSearchQuery("")} /> : undefined}
              style={[s.searchInput, { backgroundColor: theme.colors.surface }]}
              theme={{
                colors: {
                  primary: theme.colors.outlineVariant,
                },
              }}
            />
            <View style={s.filterContainer}>
              <Text style={s.resultText}>
                Visar {filteredCount} av {totalCount} leder
              </Text>
              {Object.values(filters).some((v) => v !== undefined) || searchQuery ? (
                <Pressable onPress={clearFilters}>
                  <Text style={[s.clearFilters, { color: theme.colors.tertiary }]}>Rensa filter</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={onRefresh}
            tintColor="#007AFF"
            title="Uppdaterar leder..."
          />
        }
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>Inga leder hittades</Text>
            <Text style={s.emptySubtext}>Prova att ändra dina filter</Text>
          </View>
        }
      />

      <TrailFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        cities={cities}
        classifications={classifications}
        filters={filters}
        sortBy={sortBy}
        onUpdateFilter={updateFilter}
        onUpdateLengthFilter={updateLengthFilter}
        onUpdateSort={setSortBy}
        onClearFilters={clearFilters}
        hasLocation={userLocation !== null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  hikers: {
    height: 25,
    width: 25,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleText: {
    fontSize: 20,
  },
  filterButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: 5,
    paddingRight: 10,
    borderRadius: 8,
  },
  filterButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
  },
  filterContainer: {
    padding: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultText: {
    fontSize: 14,
  },
  clearFilters: {
    fontSize: 16,
    fontWeight: "600",
  },
  searchInput: {
    marginBottom: 5,
    height: 40,
  },
  listContent: {
    padding: 10,
    gap: 10,
  },
});
