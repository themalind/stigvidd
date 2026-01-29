import TrailCreator from "@/components/trail/trail-creator/trail-creator";
import { ScrollView, Text, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

export default function TrailsScreen() {
  const theme = useTheme();
  return (
    <ScrollView
      contentContainerStyle={[
        s.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text style={{ color: theme.colors.onBackground }}>trails</Text>

      <TrailCreator />

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 10,
  },
});
