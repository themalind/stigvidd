import { CreateStigViddUserCredentials, User, UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import { getValidAccessToken } from "@/services/keycloak-auth";
import { BASE_URL } from "./api-config";
import { ApiError } from "./api-error";
import { logger } from "@/services/logger";

export async function getUserToken(): Promise<string | null> {
  return getValidAccessToken();
}

export async function createStigViddUser({ email, nickname }: CreateStigViddUserCredentials): Promise<User> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email,
        nickname,
      }),
    });

    if (response.status === 409) {
      throw new ApiError("nickname-taken", 409);
    }

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Create stig vidd user failed", {
      endpoint: "POST /users/create",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getStigViddUser(): Promise<User> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/users`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get stig vidd user failed", {
      endpoint: "GET /users",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getUserFavorites(): Promise<UserFavoritesTrail[]> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/users/favorites`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get user favorites failed", {
      endpoint: "GET /users/favorites",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function getUserWishlist(): Promise<UserWishlistTrail[]> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/users/wishlist`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Get user wishlist failed", {
      endpoint: "GET /users/wishlist",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function addToUserFavorite(trailIdentifier: string): Promise<UserFavoritesTrail> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/users/favorites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      // Matchar request i backenden
      body: JSON.stringify({
        trailIdentifier,
      }),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Add to user favorite failed", {
      endpoint: "POST /users/favorites",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function addToUserWishlist(trailIdentifier: string): Promise<UserFavoritesTrail> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/users/wishlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        trailIdentifier,
      }),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    logger.error("Add to user wishlist failed", {
      endpoint: "POST /users/wishlist",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function removeUserFavorite(trailIdentifier: string): Promise<void> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/users/favorites/${trailIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }
  } catch (error) {
    logger.error("Remove user favorite failed", {
      endpoint: "DELETE /users/favorites/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}

export async function deleteStigViddUser(): Promise<void> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(`${BASE_URL}/users/delete`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(`HTTP error ${response.status}`, response.status);
  }
}

export async function removeUserWishlist(trailIdentifier: string): Promise<void> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`${BASE_URL}/users/wishlist/${trailIdentifier}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }
  } catch (error) {
    logger.error("Remove user wishlist failed", {
      endpoint: "DELETE /users/wishlist/{param}",
      errorMessage: String(error),
    });
    throw error;
  }
}
