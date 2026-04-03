import { CreateTrailObstacleRequest, TrailObstacle } from "@/data/types";
import { ApiError, getUserToken } from "./users";
import { BASE_URL } from "./api-config";

export async function getTrailObstaclesByTrailIdentifier(trailIdentifier: string): Promise<TrailObstacle[]> {
  try {
    const response = await fetch(`${BASE_URL}/trailobstacles/trail/${trailIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getTrailObstaclesByTrailIdentifier:  ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log("getTrailObstaclesByTrailIdentifier: ", error);
    throw error;
  }
}

export async function addSolvedVote(obstacleIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    const response = await fetch(`${BASE_URL}/trailobstacles/solve/${obstacleIdentifier}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: addSolvedVote:  ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    console.log("addSolvedVote: ", error);
    throw error;
  }
}

export async function deleteSolvedVote(obstacleIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    const response = await fetch(`${BASE_URL}/trailobstacles/solve/${obstacleIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: addSolvedVote:  ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    console.log("deleteSolvedVote", error);
    throw error;
  }
}

export async function createTrailObstacle(request: CreateTrailObstacleRequest): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/trailobstacles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: addSolvedVote:  ${response.status}`, response.status);
    }
    return { success: true };
  } catch (error) {
    console.log("createTrailObstacle: ", error);
    throw error;
  }
}
