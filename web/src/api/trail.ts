import type {
  TrailImageResponse,
  TrailResponse,
  TrailShortInfoResponse,
  UpdateTrailRequest,
} from "@/types/types";
import { getValidAccessToken } from "@/services/keycloak-auth";

const BASE_URL = `http://${import.meta.env.VITE_API_HOST}/api/v1/trails`;

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
  const token = await getValidAccessToken();
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

export async function addTrailImages(
  identifier: string,
  images: File[],
): Promise<TrailImageResponse[]> {
  const token = await getValidAccessToken();
  const formData = new FormData();
  images.forEach((file) => formData.append("images", file));
  try {
    const response = await fetch(`${BASE_URL}/${identifier}/images`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return (await response.json()) as TrailImageResponse[];
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function deleteTrailImage(imageIdentifier: string): Promise<void> {
  const token = await getValidAccessToken();
  try {
    const response = await fetch(`${BASE_URL}/images/${imageIdentifier}`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
}
