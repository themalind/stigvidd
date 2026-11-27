// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getReviewsByTrailIdentifier } from "@/api/reviews";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { REVIEWS_STALE_TIME } from "@/constants/cache";
import { Review, Trail } from "@/data/types";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type ComponentRef, RefObject, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import ErrorView from "@/components/status/error-view";
import LoadingIndicator from "@/components/status/loading-indicator";
import ReviewEditor from "./review-editor";
import ReviewSection from "./review-section";
import { useAuth } from "@/components/auth/auth-provider";
import { useHasReviewedTrail } from "@/hooks/review/useHasReviewedTrail";
import { useReviewEditor } from "@/hooks/review/useReviewEditor";

interface ReviewWrapperProps {
  trail: Trail;
  surfaceToScrollToRef: RefObject<ComponentRef<typeof View> | null>;
  onReviewsLoaded?: (reviews: Review[], total: number) => void;
}

export default function TrailReviewsContainer({ trail, surfaceToScrollToRef, onReviewsLoaded }: ReviewWrapperProps) {
  const { user } = useAuth();
  const editor = useReviewEditor(trail.identifier);
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: hasReviewed } = useHasReviewedTrail(trail.identifier);

  const {
    data: reviewResponse,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["reviews", trail.identifier, user?.id],
    queryFn: ({ pageParam }) => getReviewsByTrailIdentifier(trail.identifier, pageParam, 5), // pageParam is the page number
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length : undefined),
    initialPageParam: 0, // First page
    staleTime: REVIEWS_STALE_TIME,
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

  // A failed refetch keeps the cached data, so the error screen is only for having nothing to show. keep-comment: refetch-error semantics
  if (isError && !reviewResponse) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  if (isLoading || !reviewResponse) {
    return <LoadingIndicator />;
  }

  return (
    <View ref={surfaceToScrollToRef}>
      <Surface
        testID="reviews-surface"
        elevation={0}
        style={[s.surface, { backgroundColor: theme.colors.surface, gap: 10 }]}
      >
        <View style={{ flexDirection: "row" }}>
          <View style={s.ratingSection}>
            <Text style={[s.title, { color: theme.colors.onSurface }]}>{t("review.title")}</Text>
            <Text style={[s.ratingNumber, { color: theme.colors.onSurfaceVariant }]}>{`(${totalReviewsCount})`}</Text>
          </View>
          <View style={s.iconSection}>
            {!hasReviewed && (
              <Pressable testID="add-review-button" onPress={editor.openCreate}>
                <Ionicons name="create-outline" size={30} color={theme.colors.onBackground} />
              </Pressable>
            )}
          </View>
        </View>
        {reviews.length === 0 ? (
          <Surface elevation={0} style={[s.surface, { backgroundColor: theme.colors.surface }]}>
            <Text style={{ color: theme.colors.onBackground }}>{t("review.noReviews")}</Text>
          </Surface>
        ) : (
          <>
            <ReviewSection reviews={reviews} onEditOwn={() => void editor.openOwn()} />
            {(hasNextPage || isFetchingNextPage) && (
              <Button
                style={{ borderRadius: BORDER_RADIUS }}
                mode="outlined"
                onPress={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                labelStyle={{ color: theme.colors.onSurface }}
              >
                {isFetchingNextPage ? t("review.loadingMore") : t("review.loadMore")}
              </Button>
            )}
          </>
        )}
      </Surface>
      <ReviewEditor trail={trail} editor={editor} notAuthMessage={t("review.notAuthReview")} />
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
    fontSize: 16,
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
  ratingSection: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 15,
  },
});

// TODO: load the next page on scroll instead of a button. keep-comment: planned
