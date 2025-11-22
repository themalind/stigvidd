import ImageCarousel from "@/components/image-carousel";
import { mockTrails } from "@/data/mock-data";
import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useTheme } from "react-native-paper";

export default function HomeScreen() {
  const theme = useTheme();
  return (
    <ScrollView
      contentContainerStyle={[
        s.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>
        Populära promenader nära dig
      </Text>
      <ImageCarousel data={mockTrails} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 10,
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 15,
  },
});
