import { fetchTrailByIdentifier } from "@/api/trails";
import ImageCarousel from "@/components/image-carousel";
import ImageModal from "@/components/imageModal";
import TrailDescription from "@/components/trail/trail-description";
import TrailInfo from "@/components/trail/trail-info";
import TrailMap from "@/components/trail/trail-map";
import UserBar from "@/components/trail/user-action-bar/user-bar";
import { Review } from "@/data/types";
import { useImage } from "@/providers/image-atoms";
import { useQuery } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { BackHandler, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { StarRatingDisplay } from "react-native-star-rating-widget";

export default function TrailDetailsScreen() {
  const theme = useTheme();
  const { showImage } = useImage();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const normalizedIdentifier = Array.isArray(identifier)
    ? identifier[0]
    : identifier;

  const {
    data: trail,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["trail", normalizedIdentifier],
    queryFn: () => fetchTrailByIdentifier(normalizedIdentifier),
    enabled: !!normalizedIdentifier && typeof normalizedIdentifier === "string",
  });

  const images = trail?.trailImageDTO || [];

  const Rating = () => {
    if (!trail?.reviewDTO || trail.reviewDTO.length === 0) {
      return (
        <StarRatingDisplay
          starSize={17}
          color={theme.colors.tertiary}
          rating={0}
        />
      );
    }
    const average =
      trail.reviewDTO.reduce((sum: number, r: Review) => sum + r.grade, 0) /
      trail.reviewDTO.length;

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

  if (isLoading) {
    return <Text style={{ padding: 20 }}>Laddar…</Text>;
  }

  if (isError) {
    return (
      <Text style={{ padding: 20, color: "red" }}>
        Fel: {(error as Error).message}
      </Text>
    );
  }

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
