import { RatingResponse, Review } from "@/data/types";
import { useTranslation } from "react-i18next";
import { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native-paper";
import { StarRatingDisplay } from "react-native-star-rating-widget";

interface RatingProps {
  trailReviews?: Review[]; // For the trail details page
  review?: Review; // For a single review
  ratings?: RatingResponse[];
  averageRating?: number; // For an already-computed average rating (e.g. area/trail cards)
  variant?: "stars" | "compact"; // Default "compact" = numeric ★ 4.5. "stars" = star widget.
  starSize?: number; // Only used by the "stars" variant.
  starColor: string;
  textStyle?: StyleProp<TextStyle>; // Style for the compact / "no reviews" text
}

export const Rating = ({
  trailReviews,
  review,
  ratings,
  averageRating,
  variant = "compact",
  starSize = 15,
  starColor,
  textStyle,
}: RatingProps) => {
  const { t } = useTranslation();

  // Ratings are always 1–5, so averageRating === 0 means "no reviews".
  let value = 0;
  let hasReviews = false;

  if (trailReviews && trailReviews.length > 0) {
    value = trailReviews.reduce((sum, r) => sum + r.rating, 0) / trailReviews.length;
    hasReviews = true;
  } else if (ratings && ratings.length > 0) {
    value = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    hasReviews = true;
  } else if (review) {
    value = review.rating;
    hasReviews = true;
  } else if (typeof averageRating === "number" && averageRating > 0) {
    value = averageRating;
    hasReviews = true;
  }

  if (!hasReviews) {
    return <Text style={textStyle}>{t("review.noReviews")}</Text>;
  }

  if (variant === "compact") {
    return <Text style={[{ color: starColor }, textStyle]}>{`★ ${value.toFixed(1)}`}</Text>;
  }

  return <StarRatingDisplay starSize={starSize} color={starColor} rating={value} />;
};
