// App-owned geographic coordinate in the device/wire format ({ latitude, longitude }).
// Used by GPS tracking, geolib distance and the hike-creation request payload.
// Map rendering uses GeoJSON Position ([lng, lat]) instead — see utils/geojson.ts.
export interface LatLng {
  latitude: number;
  longitude: number;
}

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
  city: string;
  tags?: string;
  isVerified: boolean;
  visitorInformation?: VisitorInformation;
  trailImagesResponse?: TrailImage[];
  trailLinksResponse?: TrailLink[];
}

export interface Coordinates {
  coordinates: string;
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

export interface User {
  identifier: string;
  nickName: string;
  email: string;
  myWishList: UserWishlistTrail[];
  myFavorites: UserFavoritesTrail[];
}

/**
 * Authenticated identity derived from a Keycloak token.
 * `id` is the Keycloak `sub` claim. Distinct from `User`, which is the
 * StigVidd profile stored in our own database.
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
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

export interface TrailMarkerResponse {
  identifier: string;
  name: string;
  isAccessible: boolean;
  startLatitude?: number;
  startLongitude?: number;
}

export interface TrailCard {
  identifier: string;
  name: string;
  trailLength: number;
  classification: number;
  isAccessible: boolean;
  averageRating: number;
  image?: TrailImage;
}

export interface Hike {
  identifier: string;
  name: string;
  hikeLength: number;
  duration: number;
  coordinates?: string;
  createdBy: string;
  gettingThere?: string;
  parkingInfo?: string;
  description?: string;
  createdAt: string;
}

export interface UpdateTrailObstacleRequest {
  description?: string;
  issueType?: string;
}

export interface CreateTrailObstacleRequest {
  description: string;
  issueType: string;
  trailIdentifier: string;
  incidentLongitude: number | null;
  incidentLatitude: number | null;
}

export interface TrailObstacle {
  identifier: string;
  userIdentifier: string;
  description: string;
  issueType: string;
  incidentLongitude?: number;
  incidentLatitude?: number;
  createdAt: string;
  solvedVotes?: TrailObstacleSolvedVote[];
}

export interface TrailObstacleSolvedVote {
  userIdentifier: string;
  trailObstacleIdentifier: string;
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

export interface CreateFacilityRequest {
  name: string;
  facilityType: number;
  isAccessible: boolean;
  latitude: number;
  longitude: number;
}

// Facility kinds. Mirrors the backend's [Flags] FacilityType enum: a facility can
// carry several flags at once (a combined fire pit + shelter is 3 = FirePit | Shelter),
// so test membership with hasFacilityType() (bitwise), never equality.
export const FacilityType = {
  None: 0,
  FirePit: 1,
  Shelter: 2,
} as const;

export interface Facility {
  identifier: string;
  name: string;
  facilityType: 0 | 1 | 2 | 3;
  isAccessible: boolean;
  latitude: number;
  longitude: number;
}

export function hasFacilityType(facilityType: number, type: (typeof FacilityType)[keyof typeof FacilityType]): boolean {
  return (facilityType & type) !== 0;
}

export interface SharedHike {
  hikeIdentifier: string;
  hikeName: string;
  hikeLength: number;
  duration: number;
  coordinates: string;
  createdByName: string;
  sharedByName: string;
  sharedByIdentifier: string;
  sharedAt: string;
  gettingThere?: string;
  parkingInfo?: string;
  description?: string;
}

export interface ReshareSharedHikeRequest {
  hikeIdentifier: string;
  reShareToName: string;
}

export interface ShareHikeRequest {
  hikeIdentifier: string;
  sharedWithName: string;
}

export interface UpdateHikeRequest {
  hikeIdentifier: string;
  parkingInfo: string | null;
  gettingThere: string | null;
  description: string | null;
}

export interface SearchFriendResult {
  identifier: string;
  nickName: string;
}

export interface FriendRequest {
  requesterIdentifier: string;
  requesterNickName: string;
  createdAt: string;
}

export interface OutgoingFriendRequest {
  receiverIdentifier: string;
  receiverNickName: string;
  createdAt: string;
}

export interface IncomingSharedHike {
  hikeIdentifier: string;
  hikeName: string;
  hikeLength: number;
  duration: number;
  sharedByName: string;
  sharedByIdentifier: string;
  createdByName: string;
  sharedAt: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateUserResult {
  success: boolean;
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

export type MapMarkerFilter = {
  trails: boolean;
  shelters: boolean;
  firePits: boolean;
  accessibility: boolean;
};
