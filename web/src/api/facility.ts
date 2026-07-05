import type {
  FacilityResponse,
  ImageProcessingOptions,
  TrailImageResponse,
} from "@/types/types";
import { getValidAccessToken } from "@/services/keycloak-auth";
import { appendProcessingOptions } from "./image-options";

const BASE_URL = `http://${import.meta.env.VITE_API_HOST}/api/v1/facilities`;

export async function getAllFacilities(): Promise<FacilityResponse[]> {
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return (await response.json()) as FacilityResponse[];
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function uploadFacilityImages(
  identifier: string,
  images: File[],
  options?: ImageProcessingOptions,
): Promise<TrailImageResponse[]> {
  const token = await getValidAccessToken();
  const formData = new FormData();
  images.forEach((file) => formData.append("images", file));
  appendProcessingOptions(formData, options);
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

export async function deleteFacilityImage(
  imageIdentifier: string,
): Promise<void> {
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
