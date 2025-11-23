import { ScrollView, StyleSheet, Text } from "react-native";
import { useTheme } from "react-native-paper";

export default function AboutScreen() {
  const theme = useTheme();
  return (
    <ScrollView
      contentContainerStyle={[
        s.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text style={{ color: theme.colors.onBackground }}>About</Text>
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
