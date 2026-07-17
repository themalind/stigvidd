export interface Review {
  identifier: string;
  trailReview?: string;
  rating: number;
  userName: string;
  createdAt: string;
  userIdentifier: string;
  trailIdentifier: string;
  reviewImages?: ReviewImage[];
}

export interface ReviewImage {
  identifier: string;
  imageUrl: string;
}

export interface RatingResponse {
  identifier: string;
  rating: number;
}

export interface PagedReviewResponse {
  reviews: Review[];
  hasMore: boolean;
  page: number;
  total?: number;
}

export interface CreateReviewRequest {
  review: string;
  rating: number;
  trailIdentifier: string;
  imageUris?: string[];
}

export interface DeleteReviewRequest {
  reviewIdentifier: string;
  userIdentifier: string;
}
