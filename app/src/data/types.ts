import { User as firebaseUser } from "firebase/auth";
import { LatLng } from "react-native-maps";

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
  tags?: string;
  isVerified: boolean;
  visitorInformation?: VisitorInformation;
  trailImagesResponse?: TrailImage[];
  trailLinksResponse?: TrailLink[];
}

export interface TrailOverview {
  identifier: string;
  name?: string;
  trailLength: number;
  averageRating: number;
  trailImagesResponse?: TrailImage[];
}

export interface TrailImage {
  identifier: string;
  imageUrl: string;
}

export interface TrailLink {
  identifier: string;
  link: string;
  title: string;
}

export interface VisitorInformation {
  identifier: string;
  gettingThere: string;
  publicTransport: string;
  parking: string;
  illumination: boolean; // byt till isIlluminated
  illuminationText: string;
  maintainedBy: string;
  winterMaintenance: boolean;
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

export interface UserName {
  identifier: string;
  nickName: string;
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
  startLatitude?: number;
  startLongitude?: number;
}

export interface Hike {
  identifier: string;
  name: string;
  hikeLength: number;
  duration: number;
  coordinates?: string;
  createdBy: string;
}

// Frontend types
export interface FilterOptions {
  city?: string;
  minLength?: number;
  maxLength?: number;
  accessibility?: boolean;
  classification?: number;
  nearMe?: boolean;
  maxDistance?: number;
}

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

export interface CreateTrailRequest {
  name: string;
  trailLength: number;
  classification: 0 | 1 | 2 | 3;
  accessibility: boolean;
  accessibilityInfo: string;
  trailSymbol: string;
  trailSymbolImage: string;
  description: string;
  fullDescription: string;
  coordinates: string;
  tags: string[];
  createdBy: UserName;
  city: string;
  isVerified: boolean;
  images: TrailImage[];
}

export interface CreateHikeRequest {
  name: string;
  hikeLength: number;
  duration: number;
  coordinates: LatLng[];
}

export interface DeleteHikeRequest {
  hikeIdentifier: string;
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

export type LocationData = {
  data: LatLng;
  timeStamp: number;
};

export type Segment = {
  coordinates: LocationData[];
  distance: number;
  startTime: number;
  endTime?: number;
};

export type ActiveHike = {
  segments: Segment[];
  totalDistance: number;
  totalTime: number;
};
