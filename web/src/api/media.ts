import type { MediaItemResponse } from "@/types/types";
import { getValidAccessToken } from "@/services/keycloak-auth";

const BASE_URL = `http://${import.meta.env.VITE_API_HOST}/api/v1/media`;

export async function getAllMedia(): Promise<MediaItemResponse[]> {
  const token = await getValidAccessToken();
  try {
    const response = await fetch(BASE_URL, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return (await response.json()) as MediaItemResponse[];
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function updateImageMetadata(
  imageIdentifier: string,
  metadata: { altText?: string | null; caption?: string | null },
): Promise<void> {
  const token = await getValidAccessToken();
  try {
    const response = await fetch(`${BASE_URL}/${imageIdentifier}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
}
