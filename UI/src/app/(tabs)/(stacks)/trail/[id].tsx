import ImageCarousel from "@/components/image-carousel";
import { mockTrails } from "@/data/mock-data";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

export default function TrailDetailsScreen() {
  const { id } = useLocalSearchParams();
  const trail = mockTrails.find((t) => t.id === id);
  const images = trail?.trailImages || [];
  // TODO Fixa android-bakåtknappen, när man backar med den härifrån hamnar man på tokiga ställen!
  // TODO När man trycker på en bild i karusellen ska man få upp en förstoring i en modal.
  return (
    <ScrollView style={s.container}>
      <Text style={s.sectionTitle}>{`${trail?.name}`}</Text>
      <ImageCarousel data={images} />
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
