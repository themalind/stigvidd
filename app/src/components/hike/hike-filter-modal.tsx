import { BORDER_RADIUS } from "@/constants/constants";
import { HikeFilterOptions } from "@/hooks/hike/useHikeFilters";
import { Slider as RangeSlider } from "@miblanchard/react-native-slider";
import React from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import SelectInput from "../select-input";

interface HikeFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: HikeFilterOptions;
  sharedByNames: string[];
  onUpdateFilter: (key: keyof HikeFilterOptions, value: any) => void;
  onUpdateRangeFilter: (key: "length" | "duration", min: number, max: number) => void;
  onClearFilters: () => void;
}

const LENGTH_MAX = 50;
const DURATION_MAX = 600;

export const HikeFilterModal: React.FC<HikeFilterModalProps> = ({
  visible,
  onClose,
  filters,
  sharedByNames,
  onUpdateFilter,
  onUpdateRangeFilter,
  onClearFilters,
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
          {sharedByNames.length > 0 && (
            <>
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t("filter.sharedBy")}</Text>
                <SelectInput
                  selectedValue={filters.sharedBy ?? ""}
                  onValueChange={(value) => onUpdateFilter("sharedBy", value === "" ? undefined : value)}
                  options={[
                    { label: t("filter.allSharers"), value: "" },
                    ...sharedByNames.map((name) => ({ label: name, value: name })),
                  ]}
                />
              </View>
              <Divider />
            </>
          )}

          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {t("filter.hikeLength", { min: filters.minLength ?? 0, max: filters.maxLength ?? LENGTH_MAX })}
            </Text>
            <RangeSlider
              value={[filters.minLength ?? 0, filters.maxLength ?? LENGTH_MAX]}
              minimumValue={0}
              maximumValue={LENGTH_MAX}
              step={1}
              onValueChange={(values: number[]) => onUpdateRangeFilter("length", values[0], values[1])}
              minimumTrackTintColor={theme.colors.secondary}
              maximumTrackTintColor={theme.colors.outlineVariant}
              thumbTintColor={theme.colors.primary}
              containerStyle={s.rangeSliderContainer}
            />
          </View>
          <Divider />

          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {t("filter.durationRange", { min: filters.minDuration ?? 0, max: filters.maxDuration ?? DURATION_MAX })}
            </Text>
            <RangeSlider
              // Quarter-hour steps: 600 single-minute stops would be sub-pixel on a
              // thumb-width slider, and quarters are how hiking time is thought about.
              value={[filters.minDuration ?? 0, filters.maxDuration ?? DURATION_MAX]}
              minimumValue={0}
              maximumValue={DURATION_MAX}
              step={15}
              onValueChange={(values: number[]) => onUpdateRangeFilter("duration", values[0], values[1])}
              minimumTrackTintColor={theme.colors.secondary}
              maximumTrackTintColor={theme.colors.outlineVariant}
              thumbTintColor={theme.colors.primary}
              containerStyle={s.rangeSliderContainer}
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
  rangeSliderContainer: {
    marginTop: 10,
  },
});
