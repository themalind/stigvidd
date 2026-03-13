import { getCoordinatesByTrailIdentifier, getTrailByIdentifier } from "@/api/trails";
import { Rating } from "@/components/review/rating";
import TrailReviewsContainer from "@/components/review/trail-reviews-container";
import ImageGallery from "@/components/trail/image-gallery";
import TrailDescription from "@/components/trail/trail-description";
import TrailInfo from "@/components/trail/trail-info";
import TrailMap from "@/components/trail/trail-map";
import UserBar from "@/components/trail/user-action-bar/user-bar";
import { Review } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LatLng } from "react-native-maps";
import { useTheme } from "react-native-paper";
import LoadingIndicator from "../loading-indicator";
import MapSkeleton from "../skeletons/map-skeleton";
import TrailMiscInfo from "./trail-misc-section/trail-misc-accordion";

export default function TrailDetailsScreen() {
  const theme = useTheme();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const normalizedIdentifier: string = Array.isArray(identifier) ? identifier[0] : identifier;

  const scrollViewRef = useRef<ScrollView>(null);
  const surfaceToScrollToRef = useRef<View>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(0);

  const {
    data: trail,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["trail", normalizedIdentifier],
    queryFn: () => getTrailByIdentifier(normalizedIdentifier),
    enabled: !!normalizedIdentifier && typeof normalizedIdentifier === "string",
  });

  const { data: coords } = useQuery({
    queryKey: ["cords", normalizedIdentifier],
    queryFn: () => getCoordinatesByTrailIdentifier(normalizedIdentifier),
    enabled: !!normalizedIdentifier,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <Text style={{ padding: 20, color: theme.colors.error }}>{error?.message}</Text>;
  }

  const images = trail?.trailImagesResponse || [];
  let coordinates: LatLng[] = [];
  if (coords) {
    coordinates = CoordinateParser({ data: coords.coordinates, identifier: trail!.identifier });
  }

  const onPressScrollToRatings = () => {
    surfaceToScrollToRef.current?.measure((_x, _y, _width, _height, _pageX, pageY) => {
      scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
    });
  };

  const onPressScrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <ScrollView ref={scrollViewRef} contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>{trail?.name}</Text>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <ImageGallery images={images} />
      </View>
      <View style={s.ratingSection}>
        <View style={s.rating}>
          <Rating trailReviews={reviews} starSize={20} starColor={theme.colors.secondary} />
          <Text style={[s.ratingNumber, { color: theme.colors.onBackground }]}>{`(${reviewCount})`}</Text>
        </View>
        <View style={s.paddingLeft}>
          <TouchableOpacity onPress={onPressScrollToRatings}>
            <Text style={[s.text, { color: theme.colors.secondary }]}>Läs recensioner</Text>
          </TouchableOpacity>
        </View>
      </View>
      {trail && <TrailInfo trail={trail} />}
      {trail && <UserBar trail={trail} />}
      {trail?.description && <TrailDescription trail={trail} />}
      {coords?.coordinates ? (
        coordinates.length > 0 && <TrailMap trail={coordinates} />
      ) : (
        <MapSkeleton text="Laddar karta..." />
      )}
      {trail && <TrailMiscInfo trail={trail} />}

      {trail && (
        <TrailReviewsContainer
          trail={trail}
          surfaceToScrollToRef={surfaceToScrollToRef}
          onReviewsLoaded={(reviews, total) => {
            setReviewCount(total);
            setReviews(reviews);
          }}
        />
      )}
      <Pressable style={s.backToTop} onPress={onPressScrollToTop}>
        <Text style={[s.text, { color: theme.colors.secondary }]}>Tillbaka till toppen</Text>
      </Pressable>
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
    justifyContent: "flex-start",
    gap: 3,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 18,
  },
  backToTop: {
    alignSelf: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  text: {
    textDecorationLine: "underline",
    fontSize: 15,
  },
  ratingNumber: {
    fontSize: 15,
  },
  ratingSection: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paddingLeft: {
    paddingRight: 10,
  },
});

// TODO https://reactnative.dev/docs/the-new-architecture/layout-measurements
// TODO https://stackoverflow.com/questions/67250477/how-to-scroll-to-a-particular-view-inside-react-native-scrollview-hierarchy
// TODO https://stackoverflow.com/questions/31883211/scroll-to-top-of-scrollview
