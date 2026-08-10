import SelectInput from "@/components/select-input";
import { BORDER_RADIUS } from "@/constants/constants";
import { FilterOptions } from "@/data/types";
import { SortOption } from "@/hooks/trail/useTrailFilters";
import { classificationParser } from "@/utils/classification-parser";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Slider as RangeSlider } from "@miblanchard/react-native-slider";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface TrailFilterModalProps {
  visible: boolean;
  onClose: () => void;
  cities: string[];
  classifications: number[];
  filters: FilterOptions;
  sortBy: SortOption;
  onUpdateSort: (value: SortOption) => void;
  onUpdateFilter: (key: keyof FilterOptions, value: any) => void;
  onUpdateLengthFilter: (min: number, max: number) => void;
  onClearFilters: () => void;
  hasLocation: boolean;
  showSort?: boolean;
}

export const TrailFilterModal: React.FC<TrailFilterModalProps> = ({
  visible,
  onClose,
  cities,
  classifications,
  filters,
  sortBy,
  onUpdateFilter,
  onUpdateLengthFilter,
  onUpdateSort,
  onClearFilters,
  hasLocation,
  showSort = true,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // A slider's value lives here while it is being dragged; only the released value is
  // committed upwards. Dragging fires onValueChange every frame, so committing from there
  // re-filters and re-sorts the whole trail list at ~60 Hz. null means "not dragging".
  const [lengthDraft, setLengthDraft] = useState<[number, number] | null>(null);
  const [distanceDraft, setDistanceDraft] = useState<number | null>(null);

  const [minLength, maxLength] = lengthDraft ?? [filters.minLength ?? 0, filters.maxLength ?? 150];
  const maxDistance = distanceDraft ?? filters.maxDistance ?? 50;

  // Stable identities: a fresh array here rebuilds every option row on each render.
  const cityOptions = useMemo(
    () => [{ label: t("filter.allCities"), value: "" }, ...cities.map((city) => ({ label: city, value: city }))],
    [cities, t],
  );

  const classificationOptions = useMemo(
    () => [
      { label: t("filter.allDifficulties"), value: "" },
      ...classifications.map((c) => ({ label: classificationParser(c), value: String(c) })),
    ],
    [classifications, t],
  );

  const sortOptions = useMemo(
    () => [
      { label: t("filter.sortNameAsc"), value: "name-asc" },
      { label: t("filter.sortNameDesc"), value: "name-desc" },
      { label: t("filter.sortLengthAsc"), value: "length-asc" },
      { label: t("filter.sortLengthDesc"), value: "length-desc" },
      ...(hasLocation ? [{ label: t("filter.sortNearest"), value: "distance-asc" }] : []),
    ],
    [hasLocation, t],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[s.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={s.header}>
          <Pressable
            style={[s.clearButtonWrapper, { backgroundColor: theme.colors.secondary }]}
            onPress={onClearFilters}
          >
            <Text style={[s.clearButton, { color: theme.colors.onSecondary }]}>{t("filter.clear")}</Text>
          </Pressable>
          <Text style={s.headerTitle}>{t("filter.title")}</Text>
          <Pressable style={[s.doneButtonWrapper, { backgroundColor: theme.colors.primary }]} onPress={onClose}>
            <Text style={[s.doneButton, { color: theme.colors.onPrimary }]}>{t("filter.done")}</Text>
          </Pressable>
        </View>
        <Divider />
        <ScrollView style={s.content}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t("filter.city")}</Text>
            <SelectInput
              selectedValue={filters.city || ""}
              onValueChange={(value) => onUpdateFilter("city", value === "" ? undefined : value)}
              options={cityOptions}
            />
          </View>
          <Divider />
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t("filter.accessibility")}</Text>
            <View style={s.buttonGroup}>
              <Pressable
                style={[
                  s.filterButton,
                  filters.accessibility === undefined
                    ? { backgroundColor: theme.colors.primary }
                    : { backgroundColor: theme.colors.surface },
                ]}
                onPress={() => onUpdateFilter("accessibility", undefined)}
              >
                <Text
                  style={[
                    s.buttonText,
                    filters.accessibility === undefined
                      ? { color: theme.colors.onPrimary }
                      : { color: theme.colors.onSurface },
                  ]}
                >
                  {t("filter.all")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  s.filterButton,
                  filters.accessibility === true
                    ? { backgroundColor: theme.colors.primary }
                    : { backgroundColor: theme.colors.surface },
                ]}
                onPress={() => onUpdateFilter("accessibility", true)}
              >
                <View style={s.accessibilityButton}>
                  <Text style={s.buttonText}>
                    {
                      <MaterialCommunityIcons
                        name="wheelchair-accessibility"
                        size={18}
                        color={filters.accessibility === true ? theme.colors.onPrimary : theme.colors.onSurface}
                      />
                    }
                  </Text>
                  <Text
                    style={[
                      s.buttonText,
                      filters.accessibility === true
                        ? { color: theme.colors.onPrimary }
                        : { color: theme.colors.onSurface },
                    ]}
                  >
                    {t("filter.adapted")}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
          <Divider />

          {hasLocation && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t("filter.nearMe")}</Text>
              <View style={s.buttonGroup}>
                <Pressable
                  style={[
                    s.filterButton,
                    !filters.nearMe
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() => onUpdateFilter("nearMe", undefined)}
                >
                  <Text
                    style={[
                      s.buttonText,
                      filters.nearMe === true ? { color: theme.colors.onSurface } : { color: theme.colors.onPrimary },
                    ]}
                  >
                    {t("filter.all")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    s.filterButton,
                    filters.nearMe === true
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() => onUpdateFilter("nearMe", true)}
                >
                  <Text
                    style={[
                      s.buttonText,
                      filters.nearMe === true ? { color: theme.colors.onPrimary } : { color: theme.colors.onSurface },
                    ]}
                  >
                    {t("filter.nearMe")}
                  </Text>
                </Pressable>
              </View>
              {filters.nearMe && (
                <>
                  <Text style={[s.label, { marginTop: 15 }]}>{t("filter.maxDistance", { distance: maxDistance })}</Text>
                  <RangeSlider
                    value={[maxDistance]}
                    minimumValue={5}
                    maximumValue={200}
                    step={5}
                    onValueChange={(values: number[]) => setDistanceDraft(values[0])}
                    onSlidingComplete={(values: number[]) => {
                      setDistanceDraft(null);
                      onUpdateFilter("maxDistance", values[0]);
                    }}
                    minimumTrackTintColor={theme.colors.secondary}
                    maximumTrackTintColor={theme.colors.outlineVariant}
                    thumbTintColor={theme.colors.primary}
                    containerStyle={s.rangeSliderContainer}
                  />
                </>
              )}
            </View>
          )}
          <Divider />

          <View style={s.section}>
            <Text style={s.sectionTitle}>{t("filter.difficulty")}</Text>
            <SelectInput
              selectedValue={filters.classification !== undefined ? String(filters.classification) : ""}
              onValueChange={(value) => onUpdateFilter("classification", value === "" ? undefined : Number(value))}
              options={classificationOptions}
            />
          </View>
          <Divider />

          <View style={s.section}>
            <Text style={s.sectionTitle}>{t("filter.trailLength", { min: minLength, max: maxLength })}</Text>
            <RangeSlider
              value={[minLength, maxLength]}
              minimumValue={0}
              maximumValue={150}
              step={1}
              onValueChange={(values: number[]) => setLengthDraft([values[0], values[1]])}
              onSlidingComplete={(values: number[]) => {
                setLengthDraft(null);
                onUpdateLengthFilter(values[0], values[1]);
              }}
              minimumTrackTintColor={theme.colors.secondary}
              maximumTrackTintColor={theme.colors.outlineVariant}
              thumbTintColor={theme.colors.primary}
              containerStyle={s.rangeSliderContainer}
            />
          </View>
          <Divider />

          {/* Hidden where sorting lives in the list header's popover instead. */}
          {showSort && (
            <>
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t("filter.sortBy")}</Text>
                <SelectInput
                  selectedValue={sortBy}
                  onValueChange={(v) => onUpdateSort(v as SortOption)}
                  options={sortOptions}
                />
              </View>
              <Divider />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const s = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  clearButtonWrapper: {
    borderRadius: BORDER_RADIUS,
  },
  clearButton: {
    fontSize: 16,
    padding: 5,
  },
  doneButtonWrapper: {
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS,
  },
  doneButton: {
    padding: 5,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    marginTop: 10,
    marginBottom: 5,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  rangeSliderContainer: {
    marginTop: 10,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  accessibilityButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
});
