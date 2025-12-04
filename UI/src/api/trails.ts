import { Trail } from "@/data/types";

export async function getTrails() {
  const response = await fetch("http://10.10.240.153:5265/api/Trail");

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  try {
    return response.json();
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}

export async function getPopularTrails() {
  const response = await fetch("http://10.10.240.153:5265/api/Trail/popular");

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  try {
    return response.json();
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}

export async function fetchTrailByIdentifier(
  identifier: string,
): Promise<Trail> {
  const response = await fetch(
    `http://10.10.240.153:5265/api/Trail/${identifier}`,
  );
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}
