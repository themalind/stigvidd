import { borasAreas, FacilityItem, FacilityType } from "@/data/areas-data";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Divider, Text, useTheme } from "react-native-paper";
import BackButton from "../back-button";

interface FacilitySectionProps {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: FacilityItem[];
}

function FacilitySection({ title, icon, items }: FacilitySectionProps) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <MaterialIcons name={icon} size={20} color={theme.colors.primary} />
        <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>{title}</Text>
      </View>
      {items.map((item, index) => (
        <View key={index} style={[s.facilityCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text style={[s.facilityName, { color: theme.colors.onSurface }]}>{item.name}</Text>
          {item.location ? (
            <View style={s.locationRow}>
              <MaterialIcons name="place" size={14} color={theme.colors.onSurfaceVariant} />
              <Text style={[s.facilityMeta, { color: theme.colors.onSurfaceVariant }]}>{item.location}</Text>
            </View>
          ) : null}
          {item.description ? (
            <Text style={[s.facilityMeta, { color: theme.colors.onSurfaceVariant }]}>{item.description}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function AreaDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ identifier: string }>();
  const identifier = Array.isArray(params.identifier) ? params.identifier[0] : params.identifier;
  const area = borasAreas.find((i) => i.identifier === identifier);

  if (!area) return <ActivityIndicator style={{ flex: 1 }} />;

  const firePits = area.facilities[FacilityType.Firepit];
  const fishing = area.facilities[FacilityType.FishingArea];
  const shelter = area.facilities[FacilityType.Shelter];
  const swimming = area.facilities[FacilityType.SwimmingArea];

  const hasFacilities = firePits.length > 0 || fishing.length > 0 || shelter.length > 0 || swimming.length > 0;

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <BackButton />
      <ScrollView contentContainerStyle={s.container}>
        <Image source={area.image} style={s.heroImage} resizeMode="cover" />
        <View style={s.header}>
          <Text style={[s.title, { color: theme.colors.onBackground }]}>{area.name}</Text>
          <View style={s.locationRow}>
            <MaterialIcons name="place" size={16} color={theme.colors.primary} />
            <Text style={[s.locationText, { color: theme.colors.onSurfaceVariant }]}>{area.location}</Text>
          </View>
        </View>
        <Text style={[s.description, { color: theme.colors.onBackground }]}>{area.description}</Text>

        {hasFacilities && (
          <>
            <Divider />
            <Text style={[s.facilitiesHeading, { color: theme.colors.onBackground }]}>Faciliteter</Text>
            <FacilitySection title="Grillplatser" icon="outdoor-grill" items={firePits} />
            <FacilitySection title="Vindskydd" icon="cabin" items={shelter} />
            <FacilitySection title="Fiske" icon="set-meal" items={fishing} />
            <FacilitySection title="Badplatser" icon="pool" items={swimming} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    gap: 16,
    paddingBottom: 32,
  },
  heroImage: {
    width: "100%",
    height: 220,
  },
  header: {
    paddingHorizontal: 20,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 14,
  },
  description: {
    paddingHorizontal: 20,
    fontSize: 15,
    lineHeight: 22,
  },
  facilitiesHeading: {
    paddingHorizontal: 20,
    fontSize: 17,
    fontWeight: "700",
  },
  section: {
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  facilityCard: {
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  facilityName: {
    fontWeight: "600",
    fontSize: 14,
  },
  facilityMeta: {
    fontSize: 13,
  },
});
