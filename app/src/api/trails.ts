import { IP } from "@/../ipconfig";
import { Trail, TrailOverview } from "@/data/types";

export async function getPopularTrails(): Promise<TrailOverview[]> {
  try {
    const response = await fetch("http://" + IP + "/api/v1/Trail/popular");

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getTrailByIdentifier(identifier: string): Promise<Trail> {
  try {
    const response = await fetch(
      "http://" + IP + `/api/v1/Trail/${identifier}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
