import { Trail } from "@/data/types";
import { Surface, useTheme } from "react-native-paper";
import { View, Text, StyleSheet } from "react-native";

interface TrailDescriptionProps {
  trail: Trail;
}

export default function TrailDescription({ trail }: TrailDescriptionProps) {
  const theme = useTheme();
  return (
    <Surface
      elevation={2}
      style={[s.container, { backgroundColor: theme.colors.surface }]}
    >
      <View style={s.descriptionContainer}>
        <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>
          Beskrivning
        </Text>
        <Text style={[s.description, { color: theme.colors.onSurface }]}>
          {trail.description}
        </Text>
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 15,
    padding: 20,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  descriptionContainer: {
    gap: 5,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  description: {
    flexDirection: "row",
    flexWrap: "wrap",
    fontSize: 15,
    lineHeight: 25,
  },
});
