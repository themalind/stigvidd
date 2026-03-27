import BackButton from "@/components/back-button";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

export default function AboutScreen() {
  const theme = useTheme();
  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <BackButton />
      <ScrollView contentContainerStyle={s.container}>
        <Text style={{ color: theme.colors.onBackground }}>About</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 10,
  },
});
