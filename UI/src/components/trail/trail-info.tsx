import { Trail } from "@/data/types";
import { StyleSheet, Text, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";

interface TrailinfoProps {
  trail: Trail;
}

export default function TrailInfo({ trail }: TrailinfoProps) {
  const theme = useTheme();

  return (
    <Surface
      elevation={2}
      style={[s.container, { backgroundColor: theme.colors.surface }]}
    >
      <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>
        Information:
      </Text>
      <View style={s.infoDetailContainer}>
        <Text style={[s.title, { color: theme.colors.onSurface }]}>
          Markering:
        </Text>
        <Text style={{ color: theme.colors.onSurface }}>
          {trail.trailSymbol}
        </Text>
      </View>
      <View style={s.infoDetailContainer}>
        <Text style={[s.title, { color: theme.colors.onSurface }]}>Längd:</Text>
        <Text style={{ color: theme.colors.onSurface }}>
          {trail.trailLenght} km.
        </Text>
      </View>
      <View style={s.infoDetailContainer}>
        <Text style={[s.title, { color: theme.colors.onSurface }]}>
          Svårighetsgrad:
        </Text>
        <Text style={{ color: theme.colors.onSurface }}>
          {trail.classification}
        </Text>
      </View>
      <View style={s.infoDetailContainer}>
        <Text style={[s.title, { color: theme.colors.onSurface }]}>
          Tillgänglighet:
        </Text>
        <Text style={{ color: theme.colors.onSurface }}>
          {trail.accessability
            ? "Tillgänglighetsanpassad"
            : "Ej tillgänglighetsanpassad."}
        </Text>
      </View>
      <View style={s.infoDetailContainer}>
        <Text style={[s.title, { color: theme.colors.onSurface }]}>
          Variation:
        </Text>
        <Text style={{ color: theme.colors.onSurface }}>
          {trail.accessabilityInfo}
        </Text>
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 20,
    gap: 5,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  title: {
    fontWeight: 700,
  },
  infoDetailContainer: {
    flexDirection: "row",
    gap: 5,
    flexWrap: "wrap",
  },
});
