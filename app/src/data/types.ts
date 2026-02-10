import { User as firebaseUser } from "firebase/auth";

// Response types
export interface Trail {
  identifier: string;
  name: string;
  trailLenght: number;
  classification: number;
  accessibility: boolean;
  accessibilityInfo: string;
  trailSymbol: string;
  trailSymbolImage: string;
  description: string;
  fullDescription: string;
  coordinates: string;
  city: string;
  trailImagesResponse?: TrailImage[];
  trailLinksResponse?: TrailLink[];
}

export interface TrailOverview {
  identifier: string;
  name?: string;
  trailLength: number;
  trailImagesResponse?: TrailImage[];
}

export interface TrailImage {
  identifier: string;
  imageUrl: string;
}

export interface TrailLink {
  identifier: string;
  link: string;
}

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

export interface UserFavoritesTrail {
  identifier: string;
  name: string;
  trailLength: number;
  description: string;
  ratingResponse?: RatingResponse[];
  trailImages?: TrailImage[];
}

export interface UserWishlistTrail {
  identifier: string;
  name: string;
  trailLength: number;
  description: string;
  ratingResponse?: RatingResponse[];
  trailImages?: TrailImage[];
}

export interface RatingResponse {
  identifier: string;
  rating: number;
}

export interface Coordinate {
  Latitude: number;
  Longitude: number;
}

export interface User {
  identifier: string;
  nickName: string;
  email: string;
  myWishList: UserWishlistTrail[];
  myFavorites: UserFavoritesTrail[];
}

export interface PagedReviewResponse {
  reviews: Review[];
  hasMore: boolean;
  page: number;
  total?: number;
}

export interface TrailShortInfoResponse {
  identifier: string;
  name: string;
  trailLength: number;
  accessibility: boolean;
  classification: number;
  city: string;
}

// Frontend types
export interface CreateStigViddUserCredentials {
  email: string;
  nickname: string;
}

export interface RegisterData {
  nickName: string;
  email: string;
  password: string;
  confirmPassword: string;
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

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user: firebaseUser | null;
  error: { code: string; message: string } | null;
}
