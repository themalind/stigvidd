import {
  UserFavoritesTrailCollection,
  UserWishlistTrailCollection,
} from "@/data/types";
import { IP } from "../../ipconfig";

export async function getUserFavorites(
  userIdentifier: string,
): Promise<UserFavoritesTrailCollection[]> {
  try {
    const response = await fetch(
      "http://" + IP + `/api/v1/User/${userIdentifier}/favorites`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw new Error("Could not fetch data.");
  }
}

export async function getUserWishlist(
  userIdentifier: string,
): Promise<UserWishlistTrailCollection[]> {
  try {
    const response = await fetch(
      "http://" + IP + `/api/v1/User/${userIdentifier}/wishlist`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw new Error("Could not fetch data.");
  }
}

export async function addToUserFavorite(
  userIdentifier: string,
  trailIdentifier: string,
): Promise<UserFavoritesTrailCollection> {
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
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw new Error("Something went wrong");
  }
}

export async function addToUserWishlist(
  userIdentifier: string,
  trailIdentifier: string,
): Promise<UserFavoritesTrailCollection> {
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
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.log(error);
    throw new Error("Something went wrong");
  }
}

export async function removeUserFavorite(
  userIdentifier: string,
  trailIdentifier: string,
): Promise<void> {
  try {
    const response = await fetch(
      `http://${IP}/api/v1/users/${userIdentifier}/favorites/${trailIdentifier}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
  } catch (error) {
    console.log(error);
    throw new Error("Something went wrong!");
  }
}

export async function removeUserWishlist(
  userIdentifier: string,
  trailIdentifier: string,
): Promise<void> {
  try {
    const response = await fetch(
      `http://${IP}/api/v1/users/${userIdentifier}/wishlist/${trailIdentifier}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
  } catch (error) {
    console.log(error);
    throw new Error("Something went wrong!");
  }
}
