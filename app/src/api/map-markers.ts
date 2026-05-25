import { Facility, TrailMarkerResponse, TrailPathResponse } from "@/data/types";
import { BASE_URL } from "./api-config";

export interface TrailPathBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export async function getTrailMarkers(): Promise<TrailMarkerResponse[]> {
  try {
    const response = await fetch(`${BASE_URL}/trails/markers`);

    if (!response.ok) {
      throw new Error(`getTrailMarkers: HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getTrailPaths(bounds: TrailPathBounds): Promise<TrailPathResponse[]> {
  try {
    const { minLat, minLon, maxLat, maxLon } = bounds;

    const response = await fetch(
      `${BASE_URL}/trails/paths?minLat=${minLat}&minLon=${minLon}&maxLat=${maxLat}&maxLon=${maxLon}`,
    );

    if (!response.ok) {
      throw new Error(`getTrailPaths: HTTP error ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getFacilityMarkers(): Promise<Facility[]> {
  try {
    const response = await fetch(`${BASE_URL}/facilities`);

    if (!response.ok) {
      throw new Error(`getFacilityMarkers: HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
