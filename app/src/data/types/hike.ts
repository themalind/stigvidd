import { LatLng } from "./geo";

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

export interface UpdateHikeRequest {
  hikeIdentifier: string;
  parkingInfo: string | null;
  gettingThere: string | null;
  description: string | null;
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
