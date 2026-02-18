import { IP } from "@/../ipconfig";
import { Trail, TrailOverview, TrailShortInfoResponse } from "@/data/types";

export async function getPopularTrails(latitude?: number, longitude?: number): Promise<TrailOverview[]> {
  try {
    const params = new URLSearchParams();
    if (latitude !== undefined && longitude !== undefined) {
      params.append("latitude", latitude.toString());
      params.append("longitude", longitude.toString());
    }
    // Se över om vi ska ha någon API-nyckel här för att autentisera appen
    // och för att undvika att någon kan spamma och döda servern?
    const query = params.toString();
    const url = `http://${IP}/api/v1/Trail/popular${query ? `?${query}` : ""}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getAllTrails(): Promise<TrailShortInfoResponse[]> {
  try {
    const response = await fetch("http://" + IP + `/api/v1/trail`);
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
    const response = await fetch("http://" + IP + `/api/v1/Trail/${identifier}`);

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
