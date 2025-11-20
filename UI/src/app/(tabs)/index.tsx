import ImageCarousel from "@/components/image-carousel";
import { mockTrails } from "@/data/mock-data";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={s.container}>
      <View>
        <ImageCarousel data={mockTrails} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
});
