import ImageCarousel from "@/components/image-carousel";
import ImageModal from "@/components/imageModal";
import TrailDescription from "@/components/trail/trail-description";
import TrailInfo from "@/components/trail/trail-info";
import TrailMap from "@/components/trail/trail-map";
import UserBar from "@/components/trail/user-bar";
import { mockReviews, mockTrails } from "@/data/mock-data";
import { useImage } from "@/providers/image-atoms";
import { Link, router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { BackHandler, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { StarRatingDisplay } from "react-native-star-rating-widget";

export default function TrailDetailsScreen() {
  const { id } = useLocalSearchParams();
  const theme = useTheme();
  const { showImage } = useImage();

  const trail = mockTrails.find((t) => t.id === id);
  const images = trail?.trailImages || [];
  const review = mockReviews.filter((r) => r.trailId === trail?.id);

  const Rating = () => {
    const average = review.reduce((sum, r) => sum + r.grade, 0) / review.length;

    return (
      <StarRatingDisplay
        starSize={17}
        color={theme.colors.tertiary}
        rating={average}
      />
    );
  };

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
          showImage(image.imageUrl);
        }}
      />
      <View style={s.rating}>
        <Rating />
        <Link href={"/"}>
          <Text style={[s.ratingLink, { color: theme.colors.tertiary }]}>
            Läs betyg och kommentarer
          </Text>
        </Link>
      </View>
      {trail ? <TrailInfo trail={trail} /> : null}
      <UserBar />
      {trail ? <TrailDescription trail={trail} /> : null}
      {trail ? <TrailMap trail={trail} /> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    gap: 15,
  },
  rating: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  ratingLink: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
