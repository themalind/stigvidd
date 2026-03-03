import { CreateStigViddUserCredentials, User, UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import { getAuth, getIdToken } from "@firebase/auth";
import { IP } from "../../ipconfig";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message); // Super är samma som base i c#. Så det blir errors message som används.
    this.name = "ApiError";
    this.status = status;
  }
}

export async function getUserToken(): Promise<string | null> {
  const auth = getAuth();
  return auth.currentUser ? await getIdToken(auth.currentUser) : null;
}

export async function createStigViddUser({ email, nickname }: CreateStigViddUserCredentials): Promise<User> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`http://${IP}/api/v1/users/create`, {
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

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(`createStigViddUser: ${error}`);
    throw error;
  }
}

export async function getStigViddUser(): Promise<User> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`http://${IP}/api/v1/users`, {
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
    console.log(`getStigViddUser: ${error}`);
    throw error;
  }
}

export async function getUserFavorites(): Promise<UserFavoritesTrail[]> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`http://${IP}/api/v1/users/favorites`, {
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
    console.log(error);
    throw error;
  }
}

export async function getUserWishlist(): Promise<UserWishlistTrail[]> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch("http://" + IP + `/api/v1/users/wishlist`, {
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
    console.log(error);
    throw error;
  }
}

export async function addToUserFavorite(trailIdentifier: string): Promise<UserFavoritesTrail> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`http://${IP}/api/v1/users/favorites`, {
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
    console.log(error);
    throw error;
  }
}

export async function addToUserWishlist(trailIdentifier: string): Promise<UserFavoritesTrail> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`http://${IP}/api/v1/users/wishlist`, {
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
    console.log(error);
    throw error;
  }
}

export async function removeUserFavorite(trailIdentifier: string): Promise<void> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`http://${IP}/api/v1/users/favorites/${trailIdentifier}`, {
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
    console.log(error);
    throw error;
  }
}

export async function removeUserWishlist(trailIdentifier: string): Promise<void> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  try {
    const response = await fetch(`http://${IP}/api/v1/users/wishlist/${trailIdentifier}`, {
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
    console.log(error);
    throw error;
  }
}
