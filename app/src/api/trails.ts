import { IP } from "@/../ipconfig";
import { CreateTrailRequest, Trail, TrailOverview, TrailShortInfoResponse } from "@/data/types";
import { getUserToken } from "./users";
import uuid from "react-native-uuid";

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
  formData.append("createdBy", `${request.createdBy.identifier}`);
  formData.append("isVerified", `${request.isVerified}`);
  formData.append("city", `${request.city}`);

  try {
    const response = await fetch(`http://${IP}/api/v1/trail/create`, {
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
