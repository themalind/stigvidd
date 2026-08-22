import { BASE_URL } from "./api-config";
import { ApiError } from "./api-error";
import { getUserToken } from "./users";
import { logger } from "@/services/logger";

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
    logger.error("Register push token failed", {
      endpoint: "POST /notifications/tokens",
      errorMessage: String(error),
    });
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
    logger.error("Unregister push token failed", {
      endpoint: "DELETE /notifications/tokens/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}
