import { getReviewsByTrailIdentifier } from "@/api/reviews";
import { authStateAtom } from "@/atoms/auth-atoms";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Review, Trail } from "@/data/types";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import React, { RefObject, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Surface, useTheme } from "react-native-paper";
import NotAuthenticatedDialog from "../auth/not-authenticated-msg-dialog";
import LoadingIndicator from "../loading-indicator";
import AddReview from "./add/add-review-modal";
import ReviewSection from "./review-section ";

interface ReviewWrapperProps {
  trail: Trail;
  surfaceToScrollToRef: RefObject<View | null>;
  onReviewsLoaded?: (reviews: Review[], total: number) => void;
}

export default function TrailReviewsContainer({ trail, surfaceToScrollToRef, onReviewsLoaded }: ReviewWrapperProps) {
  const [authState] = useAtom(authStateAtom);
  const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
  const [isAuthDialogVisible, setIsAuthDialogVisible] = useState(false);
  const theme = useTheme();

  const {
    data: reviewResponse,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["reviews", trail.identifier],
    queryFn: ({ pageParam }) => getReviewsByTrailIdentifier(trail.identifier, pageParam, 5), // pageParam är vilken omgång av hämtningar
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length : undefined),
    initialPageParam: 0, // Startparamvärde
  });

  const reviews = useMemo(() => {
    return reviewResponse?.pages.flatMap((page) => page.reviews) ?? [];
  }, [reviewResponse]);

  const totalReviewsCount: number = reviewResponse?.pages[0]?.total ?? 0;

  useEffect(() => {
    if (onReviewsLoaded) {
      onReviewsLoaded(reviews, totalReviewsCount);
    }
  }, [reviews, totalReviewsCount, onReviewsLoaded]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <Text style={{ padding: 20, color: theme.colors.error }}>{error?.message}</Text>;
  }

  const handleAddReviewPress = () => {
    if (!authState.isAuthenticated) {
      setIsAuthDialogVisible(true);
      return;
    }
    setIsReviewModalVisible(true);
  };

  const handleReviewAdded = () => {
    setIsReviewModalVisible(false);
  };

  return (
    <View ref={surfaceToScrollToRef}>
      <Surface elevation={4} mode="elevated" style={[s.surface, { backgroundColor: theme.colors.surface, gap: 10 }]}>
        <View style={{ flexDirection: "row" }}>
          <View style={s.ratingSection}>
            <Text style={[s.title, { color: theme.colors.onSurface }]}>Recensioner</Text>
            <Text style={[s.ratingNumber, { color: theme.colors.tertiary }]}>{`(${totalReviewsCount})`}</Text>
          </View>
          <View style={s.iconSection}>
            <Pressable onPress={handleAddReviewPress}>
              <Ionicons name="create-outline" size={30} color={theme.colors.onBackground} />
              <AddReview
                trailIdentifier={trail.identifier}
                trailName={trail.name}
                trailLenght={trail.trailLenght}
                visible={isReviewModalVisible}
                onDismiss={handleReviewAdded}
              />
            </Pressable>
          </View>
        </View>
        {reviews.length === 0 ? (
          <Surface
            elevation={4}
            ref={surfaceToScrollToRef}
            mode="elevated"
            style={[s.surface, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={{ color: theme.colors.onBackground }}>Det finns inga recensioner här ännu.</Text>
          </Surface>
        ) : (
          <>
            <ReviewSection reviews={reviews} />
            {(hasNextPage || isFetchingNextPage) && (
              <Button
                style={{ borderRadius: BORDER_RADIUS }}
                mode="elevated"
                onPress={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                <Text style={{ color: theme.colors.onSurface }}>
                  {isFetchingNextPage ? "Laddar fler..." : "Ladda fler"}
                </Text>
              </Button>
            )}
          </>
        )}
      </Surface>
      <NotAuthenticatedDialog
        visible={isAuthDialogVisible}
        onDissmiss={() => setIsAuthDialogVisible(false)}
        infoMessage="Du behöver vara inloggad för att skriva en recension."
      />
    </View>
  );
}

const s = StyleSheet.create({
  surface: {
    justifyContent: "center",
    borderRadius: SURFACE_BORDER_RADIUS,
    padding: 25,
  },
  title: {
    fontWeight: 700,
    fontSize: 20,
  },
  iconSection: {
    gap: 15,
    paddingRight: 5,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    flex: 1,
  },
  ratingNumber: {
    fontSize: 15,
  },
  ratingContainer: {
    transform: [{ translateX: -5 }],
    paddingTop: 10,
  },
  ratingSection: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 15,
  },
});

//TODO https://tanstack.com/query/v5/docs/framework/react/examples/load-more-infinite-scroll
// TODO https://tanstack.com/query/v5/docs/framework/react/guides/infinite-queries
