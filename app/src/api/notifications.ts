import { BASE_URL } from "./api-config";
import { ApiError } from "./api-error";
import { getUserToken } from "./users";

export async function registerPushToken(expoToken: string, platform: string): Promise<void> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/notifications/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ expoToken, platform }),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: registerPushToken: ${response.status}`, response.status);
    }
  } catch (error) {
    console.log("registerPushToken -> Error while registering push token:", error);
    throw error;
  }
}

export async function unregisterPushToken(expoToken: string): Promise<void> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/notifications/tokens/${encodeURIComponent(expoToken)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: unregisterPushToken: ${response.status}`, response.status);
    }
  } catch (error) {
    console.log("unregisterPushToken -> Error while unregistering push token:", error);
    throw error;
  }
}
