import { getTrailByIdentifier } from "@/api/trails";
import { useImage } from "@/atoms/image-atoms";
import ImageCarousel from "@/components/image-carousel";
import ImageModal from "@/components/imageModal";
import LoadingIndicator from "@/components/loading-indicator";
import { Rating } from "@/components/rating";
import ReviewWrapper from "@/components/review/review-wrapper";
import TrailDescription from "@/components/trail/trail-description";
import TrailInfo from "@/components/trail/trail-info";
import TrailMap from "@/components/trail/trail-map";
import UserBar from "@/components/trail/user-action-bar/user-bar";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

export default function TrailDetailsScreen() {
  const theme = useTheme();
  const { showImage } = useImage();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const normalizedIdentifier = Array.isArray(identifier)
    ? identifier[0]
    : identifier;

  const scrollViewRef = useRef<ScrollView>(null);
  const surfaceToScrollToRef = useRef<View>(null);

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

  const images = trail?.trailImagesResponse || [];

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
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <Text style={{ padding: 20, color: "red" }}>
        Fel: {(error as Error).message}
      </Text>
    );
  }

  const onPressScrollToRatings = () => {
    surfaceToScrollToRef.current?.measure(
      (_x, _y, _width, _height, _pageX, pageY) => {
        scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
      },
    );
  };

  const onPressScrollToTop = () => {
    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  };

  return (
    <ScrollView
      ref={scrollViewRef}
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
      <View style={s.ratingSection}>
        <View style={s.rating}>
          <Rating
            trailReviews={trail?.reviewsResponse}
            starSize={17}
            starColor={theme.colors.secondary}
          />
          <Text
            style={[s.ratingNumber, { color: theme.colors.onPrimary }]}
          >{`(${trail?.reviewsResponse?.length})`}</Text>
        </View>
        <TouchableOpacity onPress={onPressScrollToRatings}>
          <Text style={[s.text, { color: theme.colors.secondary }]}>
            Läs betyg och kommentarer
          </Text>
        </TouchableOpacity>
      </View>
      {trail ? <TrailInfo trail={trail} /> : null}
      {trail?.identifier ? (
        <UserBar trailIdentifier={trail?.identifier} />
      ) : null}
      {trail ? <TrailDescription trail={trail} /> : null}
      {trail ? <TrailMap trail={trail} /> : null}
      {trail?.reviewsResponse ? (
        <ReviewWrapper
          trail={trail}
          surfaceToScrollToRef={surfaceToScrollToRef}
        />
      ) : null}
      <Pressable style={s.backToTop} onPress={onPressScrollToTop}>
        <Text style={[s.text, { color: theme.colors.tertiary }]}>
          Tillbaka till toppen
        </Text>
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
    fontSize: 15,
  },
  ratingLink: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
  backToTop: {
    alignSelf: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  text: {
    textDecorationLine: "underline",
    fontSize: 13,
  },
  ratingNumber: {
    fontSize: 13,
  },
  ratingSection: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

// TODO https://reactnative.dev/docs/the-new-architecture/layout-measurements
// TODO https://stackoverflow.com/questions/67250477/how-to-scroll-to-a-particular-view-inside-react-native-scrollview-hierarchy
// TODO https://stackoverflow.com/questions/31883211/scroll-to-top-of-scrollview
