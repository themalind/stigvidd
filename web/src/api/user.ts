import type { StigviddUser } from "@/types/types";
import { getValidAccessToken } from "@/services/keycloak-auth";

const BASE_URL = `http://${import.meta.env.VITE_API_HOST}/api/v1/users`;

export async function getStigviddUser(): Promise<StigviddUser> {
  const token = await getValidAccessToken();

  const response = await fetch(BASE_URL, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) throw new Error(`HTTP error ${response.status}`);

  return (await response.json()) as StigviddUser;
}
