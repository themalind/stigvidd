import { userThemeAtom } from "@/atoms/user-theme-atom";
import LoadingIndicator from "@/components/loading-indicator";
import { TrailFilterModal } from "@/components/trail/trail-filter-modal";
import { TrailShortInfoResponse } from "@/data/types";
import { useTrailFilters } from "@/hooks/trail/useTrailFilters";
import { useTrails } from "@/hooks/trail/useTrails";
import { classificationParser } from "@/utils/classification-parser";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useAtom } from "jotai";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Appearance, FlatList, Pressable, RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const TrailItem = React.memo(function TrailItem({
  item,
  handlePress,
}: {
  item: TrailShortInfoResponse;
  handlePress: (identifier: string) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => handlePress(item.identifier)}
      style={[s.trailCard, { backgroundColor: theme.colors.surface }]}
    >
      <View>
        <Text style={s.trailName}>{item.name}</Text>
        {item.accessibility ? <Text style={s.accessibilityBadge}>♿</Text> : null}
      </View>
      <View style={s.trailInfo}>
        <Text style={s.infoText}> {item.city}</Text>
        <Text style={s.infoText}> {item.trailLength} km</Text>
        {item.classification != null && <Text style={s.infoText}>{classificationParser(item.classification)}</Text>}
      </View>
    </Pressable>
  );
});

export default function TrailsScreen() {
  const theme = useTheme();
  const listRef = useRef<FlatList>(null);
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = Appearance.getColorScheme();
  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;
  const hikers =
    finalTheme === "dark"
      ? require("../../assets/images/mrHike-light.png")
      : require("../../assets/images/mrHike-dark.png");

  // Scrolla till toppen när skärmen fokuseras (vid tab-tryck)
  useFocusEffect(
    React.useCallback(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []),
  );

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  const { data: trails, isLoading, isError, refetch, isFetching } = useTrails();
  const onRefresh = () => {
    refetch();
  };

  const {
    filteredTrails,
    filters,
    updateFilter,
    clearFilters,
    sortBy,
    setSortBy,
    cities,
    classifications,
    totalCount,
    filteredCount,
  } = useTrailFilters(trails, userLocation);

  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const handlePress = useCallback((identifier: string) => {
    router.navigate({
      pathname: "/(tabs)/(stacks)/trail/[identifier]",
      params: { identifier: identifier },
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
        <TouchableOpacity onPress={() => refetch()} style={s.retryButton}>
          <Text>Försök igen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: theme.colors.background, flex: 1 }]}>
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
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: 20,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Image contentFit="contain" source={hikers} style={s.hikers} />
                <Text style={{ fontSize: 20, color: theme.colors.onBackground }}>Vandringsleder</Text>
              </View>

              <Pressable onPress={() => setFilterModalVisible(true)} style={s.filterButton}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    backgroundColor: theme.colors.surface,
                    padding: 10,
                    borderRadius: 8,
                  }}
                >
                  <MaterialIcons name="filter-list" size={24} color={theme.colors.onBackground} />
                  <Text style={{ color: theme.colors.onBackground, fontWeight: "600", fontSize: 16 }}>Filtrera</Text>
                </View>
              </Pressable>
            </View>
            <View style={s.filterContainer}>
              <Text style={s.resultText}>
                Visar {filteredCount} av {totalCount} leder
              </Text>
              {Object.keys(filters).length > 0 ? (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={s.clearFilters}>Rensa filter</Text>
                </TouchableOpacity>
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
        onUpdateSort={setSortBy}
        onClearFilters={clearFilters}
        hasLocation={userLocation !== null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  hikers: {
    height: 25,
    width: 25,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  trailCard: {
    borderRadius: 12,
    padding: 15,
    gap: 10,
  },
  trailName: {
    fontSize: 15,
    fontWeight: "700",
  },
  accessibilityBadge: {
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "#E8F8ED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trailInfo: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 15,
  },
  infoText: {
    fontSize: 14,
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultText: {
    fontSize: 14,
  },
  clearFilters: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
  listContent: {
    padding: 10,
    gap: 10,
  },
});
