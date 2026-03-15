import { TrailObstacle } from "@/data/types";
import { IP } from "../../ipconfig";
import { ApiError } from "./users";

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
    console.log("getTrailObstaclesByTrailIdentifier", error);
    throw error;
  }
}
