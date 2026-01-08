import {
  CreateStigViddUserCredentials,
  User,
  UserFavoritesTrail,
  UserWishlistTrail,
} from "@/data/types";
import { IP } from "../../ipconfig";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message); // Super är samma som base i c#. Så det blir errors message som används.
    this.name = "ApiError";
    this.status = status;
  }
}

export async function createStigViddUser({
  email,
  nickname,
  firebaseUid,
}: CreateStigViddUserCredentials): Promise<User> {
  try {
    const response = await fetch(`http://${IP}/api/v1/user/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        nickname,
        firebaseUid,
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

export async function getStigViddUser(firebaseUid: string): Promise<User> {
  try {
    const response = await fetch(`http://${IP}/api/v1/user/${firebaseUid}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getUserFavorites(
  userIdentifier: string,
): Promise<UserFavoritesTrail[]> {
  try {
    const response = await fetch(
      `http://${IP}/api/v1/user/${userIdentifier}/favorites`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getUserWishlist(
  userIdentifier: string,
): Promise<UserWishlistTrail[]> {
  try {
    const response = await fetch(
      "http://" + IP + `/api/v1/user/${userIdentifier}/wishlist`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function addToUserFavorite(
  userIdentifier: string,
  trailIdentifier: string,
): Promise<UserFavoritesTrail> {
  try {
    const response = await fetch(`http://${IP}/api/v1/user/favorites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Matchar request i backenden
      body: JSON.stringify({
        userIdentifier,
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

export async function addToUserWishlist(
  userIdentifier: string,
  trailIdentifier: string,
): Promise<UserFavoritesTrail> {
  try {
    const response = await fetch(`http://${IP}/api/v1/user/wishlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userIdentifier,
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

export async function removeUserFavorite(
  userIdentifier: string,
  trailIdentifier: string,
): Promise<void> {
  try {
    const response = await fetch(
      `http://${IP}/api/v1/user/${userIdentifier}/favorites/${trailIdentifier}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function removeUserWishlist(
  userIdentifier: string,
  trailIdentifier: string,
): Promise<void> {
  try {
    const response = await fetch(
      `http://${IP}/api/v1/user/${userIdentifier}/wishlist/${trailIdentifier}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}`, response.status);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
}
