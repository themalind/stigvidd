import { IncomingSharedHike, ReshareSharedHikeRequest, SharedHike } from "@/data/types";
import { BASE_URL } from "./api-config";
import { ApiError, getUserToken } from "./users";

export async function getSharedHikes(): Promise<SharedHike[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getSharedHikes: ${response.status}`, response.status);
    }

    return response.json();
  } catch (error) {
    console.log("Error while fetching shared hikes:", error);
    throw error;
  }
}

export async function reshareHike(request: ReshareSharedHikeRequest): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/re-share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: reshareHike: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    console.log("reshareHike -> Error while resharing hike:", error);
    throw error;
  }
}

export async function removeSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/${hikeIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: removeSharedHike: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    console.log("removeSharedHike -> Error while removing shared hike:", error);
    throw error;
  }
}

export async function getIncomingSharedHike(hikeIdentifier: string): Promise<SharedHike> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/incoming/${hikeIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getIncomingSharedHike: ${response.status}`, response.status);
    }
    return await response.json();
  } catch (error) {
    console.log("getIncomingSharedHike -> Error while fetching incoming shared hike", error);
    throw error;
  }
}

export async function getIncomingSharedHikes(): Promise<IncomingSharedHike[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/incoming`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getIncomingSharedHikes: ${response.status}`, response.status);
    }
    return await response.json();
  } catch (error) {
    console.log("getIncomingSharedHikes -> ErrorWhile retrieving incoming hike shares", error);
    throw error;
  }
}

export async function acceptSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/accept/${hikeIdentifier}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: acceptSharedHike: ${response.status}`, response.status);
    }
    return { success: true };
  } catch (error) {
    console.log("acceptSharedHike -> Something went wrong while accepting shared hike", error);
    throw error;
  }
}

export async function rejectSharedHike(hikeIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/hikesharerecipient/reject/${hikeIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: rejectSharedHike: ${response.status}`, response.status);
    }
    return { success: true };
  } catch (error) {
    console.log("rejectSharedHike -> Something went wrong when rejecting hike", error);
    throw error;
  }
}
