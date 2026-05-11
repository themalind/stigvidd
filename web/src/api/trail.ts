import { IP } from "@/../ipconfig";
import type {
  TrailResponse,
  TrailShortInfoResponse,
  UpdateTrailRequest,
} from "@/types/types";

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

export async function updateTrail(
  identifier: string,
  request: UpdateTrailRequest,
): Promise<TrailResponse> {
  const token = localStorage.getItem("access_token");
  try {
    const response = await fetch(`${BASE_URL}/${identifier}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return (await response.json()) as TrailResponse;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
