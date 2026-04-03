import { CreateReviewRequest, PagedReviewResponse } from "@/data/types";
import uuid from "react-native-uuid";
import { ApiError, getUserToken } from "./users";
import { BASE_URL } from "./api-config";

export async function getReviewsByTrailIdentifier(
  trailIdentifier: string,
  page: number,
  limit: number,
): Promise<PagedReviewResponse> {
  try {
    const response = await fetch(`${BASE_URL}/reviews/trail/${trailIdentifier}?page=${page}&limit=${limit}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getReviewsByTrailIdentifier:  ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function createReview(request: CreateReviewRequest): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const formData = new FormData();

  // Skapa filobjekten
  request.imageUris?.forEach((uri) => {
    const fileName = `${uuid.v4()}.jpg`;

    formData.append("images", {
      uri: uri,
      type: "image/jpeg",
      name: fileName,
    } as any); // Hittar vi ett annat sätt att typa så byter vi.
  });

  formData.append("trailIdentifier", request.trailIdentifier);
  formData.append("trailReview", request.review);
  formData.append("rating", `${request.rating}`);

  try {
    const response = await fetch(`${BASE_URL}/reviews/create`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    console.error("Fel vid uppladdning:", error);
    throw error;
  }
}

export async function deleteReview(reviewIdentifier: string): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/reviews/${reviewIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    console.log(error);
    throw error;
  }
}
