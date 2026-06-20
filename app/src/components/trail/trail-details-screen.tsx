import { getTrailObstaclesByTrailIdentifier } from "@/api/trail-obstacles";
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
import { guardedNavigate } from "@/utils/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import BackButton from "../back-button";
import ErrorView from "../error-view";
import LoadingIndicator from "../loading-indicator";
import MapSkeleton from "../skeletons/map-skeleton";
import TrailObstacleWarning from "./obstacle/trail-obstacle-warning";
import TrailObstacleModal from "./obstacle/trail-obstacles-modal";
import TrailMiscInfo from "./trail-misc-section/trail-misc-accordion";

// The trail detail screen is rendered inside four different tab stacks. Each
// stack's route file passes its own follow route, so tapping the embedded map
// opens the follow view in the *same* stack and back returns here.
export type FollowRoute =
  | "/(tabs)/(map)/follow/[identifier]"
  | "/(tabs)/(trails-tab)/follow/[identifier]"
  | "/(tabs)/(profile-stack)/follow/[identifier]"
  | "/(tabs)/(home)/follow/[identifier]";

export default function TrailDetailsScreen({ followRoute }: { followRoute: FollowRoute }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const normalizedIdentifier: string = Array.isArray(identifier) ? identifier[0] : identifier;
  const scrollViewRef = useRef<ScrollView>(null);
  const surfaceToScrollToRef = useRef<View>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [showObstacleModal, setShowObstacleModal] = useState(false);
  const [transitionComplete, setTransitionComplete] = useState(false);

  useEffect(() => {
    startTransition(() => setTransitionComplete(true));
  }, []);

  const handleReviewsLoaded = useCallback((loadedReviews: Review[], total: number) => {
    setReviewCount(total);
    setReviews(loadedReviews);
  }, []);

  const {
    data: trail,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["trail", normalizedIdentifier],
    queryFn: () => getTrailByIdentifier(normalizedIdentifier),
    enabled: !!normalizedIdentifier && typeof normalizedIdentifier === "string",
  });

  const { data: obstacles } = useQuery({
    queryKey: ["obstacles", normalizedIdentifier],
    queryFn: () => getTrailObstaclesByTrailIdentifier(normalizedIdentifier),
    enabled: !!normalizedIdentifier,
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
    return <ErrorView error={error} onRetry={refetch} />;
  }

  const images = trail?.trailImagesResponse || [];
  let coordinates: GeoJSON.Position[] = [];

  if (coords) {
    coordinates = CoordinateParser({ data: coords.coordinates, identifier: trail!.identifier });
  }

  const handleOpenFollowMap = () => {
    guardedNavigate(() =>
      router.navigate({ pathname: followRoute, params: { identifier: normalizedIdentifier } }),
    );
  };

  const onPressScrollToRatings = () => {
    surfaceToScrollToRef.current?.measure((_x, _y, _width, _height, _pageX, pageY) => {
      scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
    });
  };

  const onPressScrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={s.container}>
        <View style={s.header}>
          <BackButton />
          <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>{trail?.name}</Text>
        </View>
        <View style={s.content}>
          <View style={s.imageContainer}>
            <ImageGallery images={images} />
          </View>
          <View style={s.ratingSection}>
            <View style={s.rating}>
              <Rating trailReviews={reviews} starSize={20} starColor={theme.colors.secondary} />
              <Text style={[s.ratingNumber, { color: theme.colors.onBackground }]}>{`(${reviewCount})`}</Text>
            </View>
            <View style={s.paddingLeft}>
              <Pressable
                onPress={onPressScrollToRatings}
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <Text style={[s.text, { color: theme.colors.secondary }]}>{t("trail.readReviews")}</Text>
              </Pressable>
            </View>
          </View>
          {trail && <TrailInfo trail={trail} />}
          {obstacles && obstacles.length > 0 && <TrailObstacleWarning onPress={() => setShowObstacleModal(true)} />}
          {trail && <UserBar trail={trail} />}
          {trail?.description && <TrailDescription trail={trail} />}
          {coords?.coordinates && coordinates.length > 0 && transitionComplete ? (
            <TrailMap trail={coordinates} onPress={handleOpenFollowMap} />
          ) : (
            <MapSkeleton text={t("trail.loadingMap")} />
          )}
          {trail && <TrailMiscInfo trail={trail} />}

          {trail && (
            <TrailReviewsContainer
              trail={trail}
              surfaceToScrollToRef={surfaceToScrollToRef}
              onReviewsLoaded={handleReviewsLoaded}
            />
          )}
          <Pressable style={s.backToTop} onPress={onPressScrollToTop}>
            <Text style={[s.text, { color: theme.colors.secondary }]}>{t("trail.backToTop")}</Text>
          </Pressable>
          <TrailObstacleModal
            visible={showObstacleModal}
            onDismiss={() => setShowObstacleModal(false)}
            obstacles={obstacles}
            trailIdentifier={normalizedIdentifier}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: Platform.select({ ios: 0, default: 12 }),
  },
  container: {
    paddingTop: 4,
    paddingBottom: 20,
    gap: 4,
  },
  content: {
    paddingHorizontal: 12,
    gap: 15,
  },
  rating: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 3,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
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
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});

// TODO https://reactnative.dev/docs/the-new-architecture/layout-measurements
// TODO https://stackoverflow.com/questions/67250477/how-to-scroll-to-a-particular-view-inside-react-native-scrollview-hierarchy
// TODO https://stackoverflow.com/questions/31883211/scroll-to-top-of-scrollview
