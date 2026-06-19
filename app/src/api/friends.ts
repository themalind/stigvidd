import { Friend, FriendRequest, OutgoingFriendRequest } from "@/data/types";
import { BASE_URL } from "./api-config";
import { getUserToken } from "./users";
import { ApiError } from "./api-error";

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
    console.log("sendFirendRequest -> Error while sending friend request:", error);
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
    console.log("acceptFriendRequest -> Error while sending accept friend request:", error);
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
    console.log("rejectFriendRequest -> Error while sending reject friend request:", error);
    throw error;
  }
}

export async function getFriends(): Promise<Friend[]> {
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
    console.log("getFriends -> Error while fetching friends:", error);
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
    console.log("getIncomingRequests -> Error while fetching incoming friend requests:", error);
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
    console.log("getOutgoingRequests -> Error while fetching outgoing friend requests:", error);
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
    console.log("removeFriend -> Error while removing friend:", error);
    throw error;
  }
}

export async function searchUsers(query: string): Promise<Friend[]> {
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

    const result: Friend = await response.json();
    return [result];
  } catch (error) {
    console.log("searchUsers -> Error while searching users:", error);
    throw error;
  }
}
