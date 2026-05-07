import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Trail } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { StyleSheet, Text, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";

interface TrailinfoProps {
  trail: Trail;
}

export default function TrailInfo({ trail }: TrailinfoProps) {
  const theme = useTheme();

  return (
    <Surface elevation={2} style={[s.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>Information</Text>
      <View style={s.grid}>
        <View style={s.item}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>Markering</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>{trail.trailSymbol}</Text>
        </View>
        <View style={s.item}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>Längd</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>{trail.trailLenght} km</Text>
        </View>
        <View style={s.item}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>Svårighetsgrad</Text>
          <View style={s.iconRow}>
            {getDifficultyIcon(classificationParser(trail.classification))}
            <Text style={[s.value, { color: theme.colors.onSurface }]}>
              {classificationParser(trail.classification)}
            </Text>
          </View>
        </View>
        <View style={s.item}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>Tillgänglighet</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>
            {trail.accessibility ? "Anpassad" : "Ej anpassad"}
          </Text>
        </View>
        <View style={s.itemFull}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>Variation</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>{trail.accessibilityInfo}</Text>
        </View>
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: SURFACE_BORDER_RADIUS,
    gap: 12,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  item: {
    flexBasis: "45%",
    flexGrow: 1,
    gap: 2,
  },
  itemFull: {
    flexBasis: "100%",
    gap: 2,
  },
  label: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  value: {
    fontSize: 14,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
