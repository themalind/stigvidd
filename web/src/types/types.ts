export type TrailShortInfoResponse = {
  identifier: string;
  name: string;
  trailLength: number;
  accessibility: boolean;
  classification: number;
  city: string;
  startLatitude?: number;
  startLongitude?: number;
};

export type StigviddUser = {
  identifier: string;
  nickName: string;
  email: string;
};

/**
 * Authenticated identity derived from a Keycloak token. `id` is the `sub` claim.
 * Distinct from StigviddUser, which is the profile stored in our own database.
 */
export type AuthUser = {
  id: string;
  email: string;
  username: string;
};

export type VisitorInformation = {
  identifier: string;
  gettingThere: string;
  publicTransport: string;
  parking: string;
  illumination: boolean;
  illuminationText: string;
  maintainedBy: string;
  winterMaintenance: boolean;
};

export type TrailImageResponse = {
  identifier: string;
  imageUrl: string;
};

export type TrailResponse = {
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
  coordinates?: string;
  tags: string;
  createdBy: string;
  isVerified: boolean;
  city: string;
  visitorInformation?: VisitorInformation;
  trailImagesResponse?: TrailImageResponse[];
};

export type TableColumn<T> = {
  label: string;
  key: keyof T;
  type: string;
  width?: number;
};

export type UpdateVisitorInformationRequest = {
  gettingThere?: string;
  publicTransport?: string;
  parking?: string;
  illumination?: boolean;
  illuminationText?: string;
  maintainedBy?: string;
  winterMaintenance?: boolean;
};

export type UpdateTrailRequest = {
  name: string;
  trailLength: number;
  classification?: number;
  accessibility?: boolean;
  accessibilityInfo?: string;
  trailSymbol?: string;
  description?: string;
  fullDescription?: string;
  tags?: string;
  city?: string;
  visitorInformation?: UpdateVisitorInformationRequest;
};

export const CLASSIFICATION: Record<number, string> = {
  0: "Unclassified",
  1: "Easy",
  2: "Medium",
  3: "Hard",
};
