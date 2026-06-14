import { BORDER_RADIUS } from "@/constants/constants";
import { FilterOptions } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Slider as RangeSlider } from "@miblanchard/react-native-slider";
import SelectInput from "@/components/select-input";
import React from "react";
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
  sortBy: string;
  onUpdateFilter: (key: keyof FilterOptions, value: any) => void;
  onUpdateLengthFilter: (min: number, max: number) => void;
  onUpdateSort: (value: string) => void;
  onClearFilters: () => void;
  hasLocation: boolean;
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
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
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
              options={[
                { label: t("filter.allCities"), value: "" },
                ...cities.map((city) => ({ label: city, value: city })),
              ]}
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
                  <Text style={[s.label, { marginTop: 15 }]}>
                    {t("filter.maxDistance", { distance: filters.maxDistance || 50 })}
                  </Text>
                  <RangeSlider
                    value={[filters.maxDistance || 50]}
                    minimumValue={5}
                    maximumValue={200}
                    step={5}
                    onValueChange={(values: number[]) => onUpdateFilter("maxDistance", values[0])}
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
              options={[
                { label: t("filter.allDifficulties"), value: "" },
                ...classifications.map((c) => ({ label: classificationParser(c), value: String(c) })),
              ]}
            />
          </View>
          <Divider />

          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {t("filter.trailLength", { min: filters.minLength || 0, max: filters.maxLength || 150 })}
            </Text>
            <RangeSlider
              value={[filters.minLength || 0, filters.maxLength || 150]}
              minimumValue={0}
              maximumValue={150}
              step={1}
              onValueChange={(values: number[]) => onUpdateLengthFilter(values[0], values[1])}
              minimumTrackTintColor={theme.colors.secondary}
              maximumTrackTintColor={theme.colors.outlineVariant}
              thumbTintColor={theme.colors.primary}
              containerStyle={s.rangeSliderContainer}
            />
          </View>
          <Divider />

          <View style={s.section}>
            <Text style={s.sectionTitle}>{t("filter.sortBy")}</Text>
            <SelectInput
              selectedValue={sortBy}
              onValueChange={onUpdateSort}
              options={[
                { label: t("filter.sortNameAsc"), value: "name-asc" },
                { label: t("filter.sortNameDesc"), value: "name-desc" },
                { label: t("filter.sortLengthAsc"), value: "length-asc" },
                { label: t("filter.sortLengthDesc"), value: "length-desc" },
                ...(hasLocation ? [{ label: t("filter.sortNearest"), value: "distance-asc" }] : []),
              ]}
            />
          </View>
          <Divider />
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
