import { FriendRequest, FriendResponse, OutgoingFriendRequest, SearchFriendResult } from "@/data/types";
import { BASE_URL } from "./api-config";
import { ApiError } from "./api-error";
import { getUserToken } from "./users";
import { logger } from "@/services/logger";

export async function sendFriendRequest(receiverNickName: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/friends/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ receiverNickName }),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: sendFirendRequest: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Send friend request failed", {
      endpoint: "POST /friends/requests",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function acceptFriendRequest(requesterIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/friends/requests/accept/${requesterIdentifier}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: acceptFriendRequest: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Accept friend request failed", {
      endpoint: "PUT /friends/requests/accept/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function rejectFriendRequest(otherIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/friends/reject/${otherIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: rejectFriendRequest: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Reject friend request failed", {
      endpoint: "DELETE /friends/reject/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getFriends(): Promise<FriendResponse[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/friends`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getFriends: ${response.status}`, response.status);
    }

    return response.json();
  } catch (error) {
    logger.error("Get friends failed", {
      endpoint: "GET /friends",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getIncomingRequests(): Promise<FriendRequest[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/friends/requests/incoming`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getIncomingRequests: ${response.status}`, response.status);
    }

    return response.json();
  } catch (error) {
    logger.error("Get incoming requests failed", {
      endpoint: "GET /friends/requests/incoming",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getOutgoingRequests(): Promise<OutgoingFriendRequest[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/friends/requests/outgoing`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: getOutgoingRequests: ${response.status}`, response.status);
    }

    return response.json();
  } catch (error) {
    logger.error("Get outgoing requests failed", {
      endpoint: "GET /friends/requests/outgoing",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function removeFriend(friendIdentifier: string): Promise<{ success: boolean }> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/friends/${friendIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error: removeFriend: ${response.status}`, response.status);
    }

    return { success: true };
  } catch (error) {
    logger.error("Remove friend failed", {
      endpoint: "DELETE /friends/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function searchUsers(query: string): Promise<SearchFriendResult[]> {
  try {
    const token = await getUserToken();

    if (!token) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${BASE_URL}/users/search?username=${encodeURIComponent(query)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) return [];

    if (!response.ok) {
      throw new ApiError(`HTTP error: searchUsers: ${response.status}`, response.status);
    }

    const result: SearchFriendResult[] = await response.json();
    return result;
  } catch (error) {
    logger.error("Search users failed", {
      endpoint: "GET /users/search",
      errorMessage: String(error),
    });
    throw error;
  }
}
