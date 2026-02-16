import { classificationParser } from "@/utils/classification-parser";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface FilterOptions {
  city?: string;
  minLength?: number;
  maxLenght?: number;
  accessibility?: boolean;
  classification?: number;
  nearMe?: boolean;
  maxDistance?: number;
}

interface TrailFilterModalProps {
  visible: boolean;
  onClose: () => void;
  cities: string[];
  classifications: number[];
  filters: FilterOptions;
  sortBy: string;
  onUpdateFilter: (key: keyof FilterOptions, value: any) => void;
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
          <Pressable onPress={onClearFilters}>
            <Text style={s.clearButton}>Rensa</Text>
          </Pressable>
          <Text style={s.headerTitle}>Filter & Sortering</Text>
          <Pressable onPress={onClose}>
            <Text style={s.doneButton}>Klar</Text>
          </Pressable>
        </View>
        <Divider />
        <ScrollView style={s.content}>
          {/* City Filter */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Orter</Text>

            <Picker
              dropdownIconColor={theme.colors.onSurface}
              style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
              selectedValue={filters.city || ""}
              onValueChange={(value) => onUpdateFilter("city", value === "" ? undefined : value)}
              mode="dropdown"
            >
              <Picker.Item
                style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                label="Alla orter"
                value=""
              />
              {cities.map((city) => (
                <Picker.Item
                  key={city}
                  label={city}
                  value={city}
                  style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                />
              ))}
            </Picker>
          </View>
          <Divider />
          {/* Accessibility Filter */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Tillgänglighet</Text>
            <View style={s.buttonGroup}>
              <Pressable
                style={[s.filterButton, filters.accessibility === undefined && s.activeButton]}
                onPress={() => onUpdateFilter("accessibility", undefined)}
              >
                <Text style={s.buttonText}>Alla</Text>
              </Pressable>

              <Pressable
                style={[s.filterButton, filters.accessibility === true && s.activeButton]}
                onPress={() => onUpdateFilter("accessibility", true)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={s.buttonText}>
                    {
                      <MaterialCommunityIcons
                        name="wheelchair-accessibility"
                        size={18}
                        color={theme.colors.onPrimary}
                      />
                    }
                  </Text>
                  <Text style={s.buttonText}>Anpassad</Text>
                </View>
              </Pressable>
            </View>
          </View>
          <Divider />

          {/* Sort Options */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Sortera efter</Text>
            <Picker
              mode="dropdown"
              dropdownIconColor={theme.colors.onSurface}
              style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
              selectedValue={sortBy}
              onValueChange={onUpdateSort}
            >
              <Picker.Item
                style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                label="Namn (A-Ö)"
                value="name-asc"
              />
              <Picker.Item
                style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                label="Namn (Ö-A)"
                value="name-desc"
              />
              <Picker.Item
                style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                label="Längd (Kortast först)"
                value="length-asc"
              />
              <Picker.Item
                style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                label="Längd (Längst först)"
                value="length-desc"
              />
              {hasLocation && (
                <Picker.Item
                  style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                  label="Närmast först"
                  value="distance-asc"
                />
              )}
            </Picker>
          </View>
          <Divider />

          {/* Near Me Filter*/}
          {hasLocation && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Nära mig</Text>
              <View style={s.buttonGroup}>
                <Pressable
                  style={[s.filterButton, !filters.nearMe && s.activeButton]}
                  onPress={() => onUpdateFilter("nearMe", undefined)}
                >
                  <Text style={s.buttonText}>Alla</Text>
                </Pressable>
                <Pressable
                  style={[s.filterButton, filters.nearMe === true && s.activeButton]}
                  onPress={() => onUpdateFilter("nearMe", true)}
                >
                  <Text style={s.buttonText}>Nära mig</Text>
                </Pressable>
              </View>
              {filters.nearMe && (
                <>
                  <Text style={[s.label, { marginTop: 15 }]}>Max avstånd: {filters.maxDistance || 50} km</Text>
                  <Slider
                    style={s.slider}
                    minimumValue={5}
                    maximumValue={200}
                    step={5}
                    value={filters.maxDistance || 50}
                    onValueChange={(value) => onUpdateFilter("maxDistance", value)}
                    minimumTrackTintColor="#007AFF"
                    maximumTrackTintColor="#d3d3d3"
                  />
                </>
              )}
            </View>
          )}
          <Divider />

          {/* Trail Length Filter */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              Ledlängd: {filters.minLength || 0} - {filters.maxLenght || 50} km
            </Text>
            <Text style={s.label}>Min längd</Text>
            <Slider
              style={s.slider}
              minimumValue={0}
              maximumValue={50}
              step={1}
              value={filters.minLength || 0}
              onValueChange={(value) => onUpdateFilter("minLength", value)}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#d3d3d3"
            />

            <Text style={s.label}>Max längd</Text>
            <Slider
              style={s.slider}
              minimumValue={0}
              maximumValue={50}
              step={1}
              value={filters.maxLenght || 50}
              onValueChange={(value) => onUpdateFilter("maxLenght", value)}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#d3d3d3"
            />
          </View>
          <Divider />
          {/* Classification Filter */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Svårighetsgrad</Text>
            <Picker
              dropdownIconColor={theme.colors.onSurface}
              style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
              selectedValue={filters.classification || ""}
              onValueChange={(value) => onUpdateFilter("classification", value === "" ? undefined : value)}
              mode="dropdown"
            >
              <Picker.Item
                style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                label="Alla svårighetsgrader"
                value=""
              />
              {classifications.map((classification, index) => (
                <Picker.Item
                  key={index}
                  label={classificationParser(classification)}
                  value={classification}
                  style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surface }}
                />
              ))}
            </Picker>
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
  clearButton: {
    fontSize: 18,
    padding: 5,
    color: "#ff3b30",
  },
  doneButton: {
    padding: 5,
    fontSize: 18,
    color: "#007AFF",
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
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
  buttonGroup: {
    flexDirection: "row",
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "grey",
  },
  activeButton: {
    backgroundColor: "#007AFF",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
