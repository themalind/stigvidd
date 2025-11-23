import ImageCarousel from "@/components/image-carousel";
import ImageModal from "@/components/imageModal";
import { mockTrails } from "@/data/mock-data";
import { useImage } from "@/providers/image-atoms";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { BackHandler, ScrollView, StyleSheet, Text } from "react-native";
import { useTheme } from "react-native-paper";

export default function TrailDetailsScreen() {
  const { id } = useLocalSearchParams();
  const theme = useTheme();
  const { showImage } = useImage();

  const trail = mockTrails.find((t) => t.id === id);
  const images = trail?.trailImages || [];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.replace("/");
        return true;
      },
    );
    return () => backHandler.remove();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={[
        s.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <ImageModal />
      <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>
        {trail?.name}
      </Text>
      <ImageCarousel
        data={images}
        onItemPress={(image) => {
          showImage(image.imageUrl); // Fungerar oavsett om url är string eller number
        }}
      />
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
    fontWeight: "700",
    fontSize: 15,
  },
});
