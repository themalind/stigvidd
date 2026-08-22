import { CityArea } from "@/data/types";
import { BASE_URL } from "./api-config";
import { ApiError } from "./api-error";
import { logger } from "@/services/logger";

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
    logger.error("Get areas failed", {
      endpoint: "GET /cityareas",
      errorMessage: String(error),
    });
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
    logger.error("Get area by identifier failed", {
      endpoint: "GET /cityareas/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}
