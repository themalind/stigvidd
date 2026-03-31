import { IP } from "@/../ipconfig";
import {
  Coordinates,
  CreateTrailRequest,
  Trail,
  TrailMarkerResponse,
  TrailOverview,
  TrailShortInfoResponse,
} from "@/data/types";
import uuid from "react-native-uuid";
import { getUserToken } from "./users";

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
    const url = `http://${IP}/api/v1/trails/popular${query ? `?${query}` : ""}`;
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
    const response = await fetch("http://" + IP + `/api/v1/trails`);
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
    const response = await fetch("http://" + IP + `/api/v1/trails/${identifier}`);

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

export async function getCoordinatesByTrailIdentifier(identifier: string): Promise<Coordinates> {
  try {
    const response = await fetch("http://" + IP + `/api/v1/trails/${identifier}/coordinates`);

    if (!response.ok) {
      throw new Error(`getCordsTrailByIdentifier: HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getTrailMarkers(): Promise<TrailMarkerResponse[]> {
  try {
    const response = await fetch("http://" + IP + `/api/v1/trails/markers`);

    if (!response.ok) {
      throw new Error(`getTrailMarkers: HTTP error ${response.status}`);
    }
    const json = await response.json();

    return json;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function addTrail(request: CreateTrailRequest): Promise<{ success: boolean }> {
  const token = await getUserToken();

  if (!token) throw new Error("User not authenticated!");

  const formData = new FormData();

  request.images?.forEach((uri) => {
    const fileName = `${uuid.v4()}.jpg`;

    formData.append("images", {
      uri: uri,
      type: "image/jpeg",
      name: fileName,
    } as any);
  });

  formData.append("trailSymbolImage", {
    uri: request.trailSymbolImage,
    type: "image/jpeg",
    name: `${uuid.v4()}.jpg`,
  } as any);

  formData.append("name", request.name);
  formData.append("trailLength", `${request.trailLength}`);
  formData.append("classification", `${request.classification}`);
  formData.append("accessibility", `${request.accessibility}`);
  formData.append("accessibilityInfo", `${request.accessibilityInfo}`);
  formData.append("trailSymbol", `${request.trailSymbol}`);
  formData.append("description", `${request.description}`);
  formData.append("fullDescription", `${request.fullDescription}`);
  formData.append("coordinates", `${request.coordinates}`);
  formData.append("tags", `${request.tags}`);
  formData.append("isVerified", `${request.isVerified}`);
  formData.append("city", `${request.city}`);

  try {
    const response = await fetch(`http://${IP}/api/v1/trails/create`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.log(response.body);
    }

    return { success: true };
  } catch (error) {
    console.error("Trail creation failed.", error);
    throw error;
  }
}
