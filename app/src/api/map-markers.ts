import { Facility, TrailMarkerResponse } from "@/data/types";
import { BASE_URL } from "./api-config";

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
