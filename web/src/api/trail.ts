import { IP } from "@/../ipconfig";
import type { TrailResponse, TrailShortInfoResponse } from "@/types/types";

const BASE_URL = `http://${IP}/api/v1/trails`;

export async function getAllTrails(): Promise<TrailShortInfoResponse[]> {
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return (await response.json()) as TrailShortInfoResponse[];
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getTrailByIdentifier({
  identifier,
}: {
  identifier: string;
}): Promise<TrailResponse> {
  try {
    const response = await fetch(`${BASE_URL}/${identifier}`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return (await response.json()) as TrailResponse;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
