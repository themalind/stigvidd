import { CreateHikeRequest, Hike } from "@/data/types";
import { ApiError, getUserToken } from "./users";
import { BASE_URL } from "./api-config";

export async function createHike(request: CreateHikeRequest): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/hikes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...request,
        coordinates: JSON.stringify(request.coordinates),
      }),
    });

    console.log(response.body);

    if (!response.ok) {
      throw new ApiError(`HTTP error: createHike: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    console.log("Fel vid skapandet av promenad:", error);
    throw error;
  }
}

export async function getAllHikes(): Promise<Hike[]> {
  try {
    const response = await fetch(`${BASE_URL}/hikes`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getAllHikes: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getAllHikesByUserId(userIdentifier: string): Promise<Hike[]> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }
  try {
    const response = await fetch(`${BASE_URL}/hikes?createdBy=${userIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getAllHikesByUserId: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getHikeByIdentifier(hikeIdentifier: string): Promise<Hike> {
  try {
    const response = await fetch(`${BASE_URL}/hikes/${hikeIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getHikeByIOdentifier: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function deleteHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/hikes/${hikeIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: deleteHike: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    console.log(error);
    throw error;
  }
}
