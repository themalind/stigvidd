import { SCREEN_PADDING } from "@/constants/constants";
import { Facility } from "@/data/types";
import { asTranslationKey } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface FacilitySectionProps {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: Facility[];
}

export default function FacilitySection({ title, icon, items }: FacilitySectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <MaterialIcons name={icon} size={20} color={theme.colors.primary} />
        <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>{title}</Text>
      </View>
      {items.map((item, index) => (
        <View
          key={index}
          style={[
            s.facilityCard,
            {
              backgroundColor: theme.colors.elevation.level1,
              borderColor: theme.colors.outlineVariant,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[s.facilityName, { color: theme.colors.onSurface }]}>{item.name}</Text>
          {item.location ? (
            <View style={s.locationRow}>
              <MaterialIcons name="place" size={14} color={theme.colors.onSurfaceVariant} />
              <Text style={[s.facilityMeta, { color: theme.colors.onSurfaceVariant }]}>{item.location}</Text>
            </View>
          ) : null}
          {item.description ? (
            <Text style={[s.facilityMeta, { color: theme.colors.onSurfaceVariant }]}>
              {t(asTranslationKey(item.description))}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  facilityCard: {
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  facilityName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  facilityMeta: {
    fontSize: 13,
  },
  section: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
