import { RatingResponse, Review } from "@/data/types";
import { useTheme } from "react-native-paper";
import { StarRatingDisplay } from "react-native-star-rating-widget";

interface RatingProps {
  trailReviews?: Review[]; // För traildetailssidan
  review?: Review; // För enskilda recensioner
  ratings?: RatingResponse[];
  starSize: number;
}

export const Rating = ({
  review,
  trailReviews,
  starSize,
  ratings,
}: RatingProps) => {
  const theme = useTheme();
  let rating = 0;

  if (trailReviews && trailReviews.length > 0) {
    rating =
      trailReviews.reduce((sum, r) => sum + r.grade, 0) / trailReviews.length;
  }
  if (ratings && ratings.length > 0) {
    rating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  } else if (review) {
    rating = review.grade;
  }

  return (
    <StarRatingDisplay
      starSize={starSize}
      color={theme.colors.tertiary}
      rating={rating}
    />
  );
};
