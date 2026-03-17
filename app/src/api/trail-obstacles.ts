import { TrailObstacle } from "@/data/types";
import { IP } from "../../ipconfig";
import { ApiError, getUserToken } from "./users";

export async function getTrailObstaclesByTrailIdentifier(trailIdentifier: string): Promise<TrailObstacle[]> {
  try {
    const response = await fetch(`http://${IP}/api/v1/trailobstacles/trail/${trailIdentifier}`, {
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

    const response = await fetch(`http://${IP}/api/v1/trailobstacles/solve/${obstacleIdentifier}`, {
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
