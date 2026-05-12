import { IP } from "@/../ipconfig";
import { auth } from "../../firebase-config";
import type { StigviddUser } from "@/types/types";
import { getIdToken } from "firebase/auth";

const BASE_URL = `http://${IP}/api/v1/users`;

export async function getStigviddUser(): Promise<StigviddUser> {
  const token = auth.currentUser ? await getIdToken(auth.currentUser) : null;

  const response = await fetch(BASE_URL, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) throw new Error(`HTTP error ${response.status}`);

  return (await response.json()) as StigviddUser;
}
