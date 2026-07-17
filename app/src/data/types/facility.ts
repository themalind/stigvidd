import { TrailImage } from "./trail";

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
  FishingArea: 4,
  SwimmingArea: 8,
  NatureReserve: 16,
} as const;

export interface Facility {
  identifier: string;
  name: string;
  facilityType: number;
  isAccessible: boolean;
  latitude?: number;
  longitude?: number;
  location?: string;
  description?: string;
  url?: string;
}

export function hasFacilityType(facilityType: number, type: (typeof FacilityType)[keyof typeof FacilityType]): boolean {
  return (facilityType & type) !== 0;
}

export interface CityArea {
  identifier: string;
  name: string;
  location: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  facilities: Facility[];
  trails: CityAreaTrail[];
}

export interface CityAreaTrail {
  identifier: string;
  name: string;
  trailLength: number;
  classification: number;
  description?: string;
  averageRating: number;
  image?: TrailImage;
}
