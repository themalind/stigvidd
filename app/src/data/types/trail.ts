export interface Trail {
  identifier: string;
  name: string;
  trailLength: number;
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

export interface FilterOptions {
  city?: string;
  minLength?: number;
  maxLength?: number;
  accessibility?: boolean;
  classification?: number;
  nearMe?: boolean;
  maxDistance?: number;
}
