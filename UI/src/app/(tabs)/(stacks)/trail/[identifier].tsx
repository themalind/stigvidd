import { fetchTrailByIdentifier } from "@/api/trails";
import ImageCarousel from "@/components/image-carousel";
import ImageModal from "@/components/imageModal";
import LoadingIndicator from "@/components/loading-indicator";
import { Rating } from "@/components/trail/rating";
import TrailDescription from "@/components/trail/trail-description";
import TrailInfo from "@/components/trail/trail-info";
import TrailMap from "@/components/trail/trail-map";
import TrailReviews from "@/components/trail/trail-reviews";
import UserBar from "@/components/trail/user-action-bar/user-bar";
import { useImage } from "@/providers/image-atoms";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
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
import { Surface, useTheme } from "react-native-paper";

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
    queryFn: () => fetchTrailByIdentifier(normalizedIdentifier),
    enabled: !!normalizedIdentifier && typeof normalizedIdentifier === "string",
  });

  const images = trail?.trailImageDTO || [];

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
      <View style={s.rating}>
        <Rating trailReviews={trail?.reviewDTO} starSize={17} />
        <TouchableOpacity onPress={onPressScrollToRatings}>
          <Text style={[s.text, { color: theme.colors.tertiary }]}>
            Läs betyg och kommentarer
          </Text>
        </TouchableOpacity>
      </View>
      {trail ? <TrailInfo trail={trail} /> : null}
      <UserBar />
      {trail ? <TrailDescription trail={trail} /> : null}
      {trail ? <TrailMap trail={trail} /> : null}
      {trail?.reviewDTO?.length ? (
        <Surface
          ref={surfaceToScrollToRef}
          elevation={4}
          mode="elevated"
          style={[s.surface, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[s.title, { color: theme.colors.tertiary }]}>
            Recensioner
          </Text>
          <Rating trailReviews={trail?.reviewDTO} starSize={17} />
          <View
            style={{
              flexDirection: "row",
              gap: 15,
              justifyContent: "flex-end",
              alignItems: "flex-end",
            }}
          >
            <MaterialIcons
              name="filter-list"
              size={25}
              color={theme.colors.onBackground}
            />
            <Ionicons
              name="create-outline"
              size={25}
              color={theme.colors.onBackground}
            />
          </View>
          <TrailReviews reviews={trail.reviewDTO} />
        </Surface>
      ) : (
        <Surface
          elevation={4}
          mode="elevated"
          style={[s.surface, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={{ color: theme.colors.onBackground }}>
            Det finns inga recensioner här ännu.
          </Text>
        </Surface>
      )}
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
  surface: {
    justifyContent: "center",
    gap: 10,
    borderRadius: 20,
    padding: 15,
  },
  title: {
    fontWeight: 700,
    fontSize: 20,
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
});

// https://reactnative.dev/docs/the-new-architecture/layout-measurements
// https://stackoverflow.com/questions/67250477/how-to-scroll-to-a-particular-view-inside-react-native-scrollview-hierarchy
// https://stackoverflow.com/questions/31883211/scroll-to-top-of-scrollview
