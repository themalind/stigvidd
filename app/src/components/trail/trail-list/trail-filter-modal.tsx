import { BORDER_RADIUS } from "@/constants/constants";
import { FilterOptions } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Slider as RangeSlider } from "@miblanchard/react-native-slider";
import SelectInput from "@/components/select-input";
import React from "react";
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
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[s.modalContainer, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable
            style={[s.clearButtonWrapper, { backgroundColor: theme.colors.secondary }]}
            onPress={onClearFilters}
          >
            <Text style={[s.clearButton, { color: theme.colors.onSecondary }]}>Rensa</Text>
          </Pressable>
          <Text style={s.headerTitle}>Filter & Sortering</Text>
          <Pressable style={[s.doneButtonWrapper, { backgroundColor: theme.colors.primary }]} onPress={onClose}>
            <Text style={[s.doneButton, { color: theme.colors.onPrimary }]}>Klar</Text>
          </Pressable>
        </View>
        <Divider />
        <ScrollView style={s.content}>
          {/* City Filter */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Orter</Text>
            <SelectInput
              selectedValue={filters.city || ""}
              onValueChange={(value) => onUpdateFilter("city", value === "" ? undefined : value)}
              options={[{ label: "Alla orter", value: "" }, ...cities.map((city) => ({ label: city, value: city }))]}
            />
          </View>
          <Divider />

          {/* Accessibility Filter */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Tillgänglighet</Text>
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
                  Alla
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
                    Anpassad
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
          <Divider />

          {/* Near Me Filter*/}
          {hasLocation && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Nära mig</Text>
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
                    Alla
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
                    Nära mig
                  </Text>
                </Pressable>
              </View>
              {filters.nearMe && (
                <>
                  <Text style={[s.label, { marginTop: 15 }]}>Max avstånd: {filters.maxDistance || 50} km</Text>
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

          {/* Classification Filter */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Svårighetsgrad</Text>
            <SelectInput
              selectedValue={filters.classification !== undefined ? String(filters.classification) : ""}
              onValueChange={(value) => onUpdateFilter("classification", value === "" ? undefined : value)}
              options={[
                { label: "Alla svårighetsgrader", value: "" },
                ...classifications.map((c) => ({ label: classificationParser(c), value: String(c) })),
              ]}
            />
          </View>
          <Divider />

          {/* Trail Length Filter */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              Ledlängd: {filters.minLength || 0} - {filters.maxLength || 150} km
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

          {/* Sort Options */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Sortera efter</Text>
            <SelectInput
              selectedValue={sortBy}
              onValueChange={onUpdateSort}
              options={[
                { label: "Namn (A-Ö)", value: "name-asc" },
                { label: "Namn (Ö-A)", value: "name-desc" },
                { label: "Längd (Kortast först)", value: "length-asc" },
                { label: "Längd (Längst först)", value: "length-desc" },
                ...(hasLocation ? [{ label: "Närmast först", value: "distance-asc" }] : []),
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
    fontWeight: "700",
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
    fontWeight: "700",
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
