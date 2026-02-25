import { IP } from "@/../ipconfig";
import type { TrailShortInfoResponse } from "@/types/types";

const BASE_URL = `http://${IP}/api/v1/trail`;

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
