import { CityArea } from "@/data/types";
import { BASE_URL } from "./api-config";
import { ApiError } from "./api-error";

export async function getAreas(): Promise<CityArea[]> {
  try {
    const response = await fetch(`${BASE_URL}/cityareas`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getAreas: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getAreaByIdentifier(areaIdentifier: string): Promise<CityArea> {
  try {
    const response = await fetch(`${BASE_URL}/cityareas/${areaIdentifier}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getAreaByIdentifier: ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}
