import { userLocationAtom } from "@/atoms/location-atoms";
import ExampleImageOverlay from "@/components/example-image-overlay";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import { SortOption, useTrailFilters } from "@/hooks/trail/useTrailFilters";
import { classificationParser } from "@/utils/classification-parser";
import { formatDistanceKm } from "@/utils/format-distance";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { guardedNavigate } from "@/utils/navigation";
import { Entypo } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import BackButton from "../back-button";
import ListHeaderActions from "../list-header-actions";
import { Rating } from "../review/rating";
import { TrailFilterModal } from "../trail/trail-list/trail-filter-modal";

interface UserTrailCollectionProps {
  title: string;
  noTrailsSavedInfo: string;
  trails: UserFavoritesTrail[] | UserWishlistTrail[];
  onDelete: (identifier: string) => void;
  icon?: React.ReactNode;
}

export default function UserTrailCollection({
  title,
  trails,
  noTrailsSavedInfo,
  onDelete,
  icon,
}: UserTrailCollectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const userLocation = useAtomValue(userLocationAtom);

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

  // Length is set as two keys but is one choice to the user; maxDistance is a
  // modifier on "near me" rather than a filter of its own.
  const activeFilterCount = useMemo(() => {
    const { minLength, maxLength, maxDistance, ...rest } = filters;
    const hasLengthRange = minLength !== undefined || maxLength !== undefined;
    return Object.values(rest).filter((v) => v !== undefined).length + (hasLengthRange ? 1 : 0);
  }, [filters]);

  // Sorting by distance only means something once we know where the user is.
  const sortFields = useMemo(
    () => [
      { key: "name", labelKey: "filter.fieldName" },
      { key: "length", labelKey: "filter.fieldLength" },
      ...(userLocation ? [{ key: "distance", labelKey: "filter.fieldDistance" }] : []),
    ],
    [userLocation],
  );

  return (
    <View style={[s.wrapper, { backgroundColor: theme.colors.background }]}>
      <View style={s.stickyHeader}>
        <ListHeaderActions
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t("collection.searchPlaceholder")}
          sortFields={sortFields}
          sortBy={sortBy}
          onSortChange={(v) => setSortBy(v as SortOption)}
          onOpenFilters={() => setFilterModalVisible(true)}
          activeFilterCount={activeFilterCount}
          showingLabel={t("trailList.showing", { count: totalCount, shown: filteredCount })}
          onClearFilters={clearFilters}
        >
          <BackButton />
          {icon}
          <Text style={s.title}>{title}</Text>
        </ListHeaderActions>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.container]}
      >
        <View style={s.content}>
          {/* Gives up its slot to the header's result counter, which occupies the same
              line and matters more while filtering. */}
          {activeFilterCount === 0 && !searchQuery && (
            <Text variant="bodySmall" style={s.sectionSubtitle}>
              {t("collection.tapInfo")}
            </Text>
          )}
          <Divider bold={true} />

          {filteredTrails.length ? (
            filteredTrails.map((trail) => (
              <Pressable
                key={trail.identifier}
                onPress={() =>
                  guardedNavigate(() =>
                    router.navigate({
                      pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
                      params: { identifier: trail.identifier },
                    }),
                  )
                }
              >
                <View style={s.trailContainer}>
                  {/* Length, not existence: the API returns [] for a trail without images. */}
                  {trail.trailImages?.length ? (
                    <View>
                      <Image style={s.trailImage} source={trail.trailImages[0].imageUrl} contentFit="cover" />
                      <ExampleImageOverlay source={trail.trailImages[0].imageUrl} />
                    </View>
                  ) : null}
                  <View style={s.cardBody}>
                    <View style={s.titleRatingContainer}>
                      <Text style={s.trailName} numberOfLines={1}>
                        {trail.name}
                      </Text>
                      {trail.ratingResponse?.length ? (
                        <Rating ratings={trail.ratingResponse} starColor={theme.colors.tertiary} />
                      ) : null}
                    </View>
                    <View style={s.metaRow}>
                      <Text style={[s.metaText, s.metaLeft]} numberOfLines={1}>
                        {trail.city}
                      </Text>
                      <Text style={s.metaText}>{trail.trailLength} km</Text>
                    </View>

                    <View style={s.metaRow}>
                      <View style={[s.difficulty, s.metaLeft]}>
                        {trail.classification != null && trail.classification !== 0 && (
                          <>
                            <Text>{getDifficultyIcon(classificationParser(trail.classification))}</Text>
                            <Text style={s.metaText} numberOfLines={1}>
                              {classificationParser(trail.classification)}
                            </Text>
                          </>
                        )}
                      </View>
                      {trail.distanceKm != null && (
                        <Text style={s.metaText}>
                          {t("filter.distanceAway", { distance: formatDistanceKm(trail.distanceKm) })}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Pressable onPress={() => onDelete(trail.identifier)} style={s.trash}>
                    <Entypo name="cross" size={24} color={theme.colors.onBackground} />
                  </Pressable>
                </View>
                <Divider bold={true} />
              </Pressable>
            ))
          ) : totalCount === 0 ? (
            <View style={s.noTrailMsgContainer}>
              <Text style={s.noTrailMsg}>{noTrailsSavedInfo}</Text>
            </View>
          ) : (
            <View style={s.noTrailMsgContainer}>
              <Text style={s.noTrailMsg}>{t("trailList.noResults")}</Text>
              <Text variant="bodySmall">{t("trailList.noResultsHint")}</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <TrailFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        cities={cities}
        classifications={classifications}
        filters={filters}
        sortBy={sortBy}
        onUpdateSort={setSortBy}
        onUpdateFilter={updateFilter}
        onUpdateLengthFilter={updateLengthFilter}
        onClearFilters={clearFilters}
        hasLocation={userLocation != null}
        showSort={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  stickyHeader: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  wrapper: {
    flex: 1,
  },
  container: {
    paddingTop: 0,
    paddingBottom: 32,
    gap: 16,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 0,
  },
  sectionSubtitle: {
    opacity: 0.6,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  trash: {
    alignSelf: "flex-start",
  },
  trailContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  titleRatingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  trailName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
    flexShrink: 1,
  },
  trailImage: {
    height: 72,
    aspectRatio: 0.7,
    borderRadius: BORDER_RADIUS,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaLeft: {
    flex: 1,
  },
  metaText: {
    fontSize: 12,
  },
  difficulty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  noTrailMsgContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  noTrailMsg: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
