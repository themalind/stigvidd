import ImageCarousel from "@/components/image-carousel";
import { mockTrails } from "@/data/mock-data";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TrailDetailsScreen() {
  const { id } = useLocalSearchParams();
  const trail = mockTrails.find((t) => t.id === id);
  const images = trail?.trailImages || [];

  return (
    <SafeAreaView>
      <View style={s.container}>
        <Text>{`${trail?.name}`}</Text>
        <ImageCarousel data={images} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 10,
  },
});
