import { Facility, TrailMarkerResponse } from "@/data/types";
import { BASE_URL } from "./api-config";
import { logger } from "@/services/logger";

export async function getTrailMarkers(): Promise<TrailMarkerResponse[]> {
  try {
    const response = await fetch(`${BASE_URL}/trails/markers`);

    if (!response.ok) {
      throw new Error(`getTrailMarkers: HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    logger.error("Get trail markers failed", {
      endpoint: "GET /trails/markers",
      errorMessage: String(error),
    });
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
    logger.error("Get facility markers failed", {
      endpoint: "GET /facilities",
      errorMessage: String(error),
    });
    throw error;
  }
}
