import { Trail, TrailOverviewViewModel } from "@/data/types";

export async function getTrails(): Promise<Trail[]> {
  try {
    const response = await fetch("http://10.10.240.140:5265/api/v1/Trail");

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return response.json();
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}

export async function getPopularTrails(): Promise<TrailOverviewViewModel[]> {
  try {
    const response = await fetch(
      "http://10.10.240.140:5265/api/v1/Trail/popular",
    );

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return response.json();
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}

export async function fetchTrailByIdentifier(
  identifier: string,
): Promise<Trail> {
  try {
    const response = await fetch(
      `http://10.10.240.140:5265/api/v1/Trail/${identifier}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}
