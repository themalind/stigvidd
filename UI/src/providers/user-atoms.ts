import {
  addToUserFavorite,
  addToUserWishlist,
  ApiError,
  getUserFavorites,
  getUserWishlist,
  removeUserFavorite,
  removeUserWishlist,
} from "@/api/users";
import {
  UserFavoritesTrailCollection,
  UserWishlistTrailCollection,
} from "@/data/types";
import { atom } from "jotai";
import { atomWithQuery, queryClientAtom } from "jotai-tanstack-query";
import {
  showErrorAtom,
  showSuccessAtom,
  showWarningAtom,
} from "./snackbar-atoms";

const USER_IDENTIFIER = "D3AC6D71-B2AA-4B83-B15A-05C610BEBA8E";

export const userIdentifierAtom = atom(USER_IDENTIFIER); // Byta till en riktig user-atom sen

// För att få tillgång till en global lista med favoriter
export const userFavoritesAtom = atomWithQuery((get) => {
  const userIdentifier = get(userIdentifierAtom);
  return {
    queryKey: ["userFavorites", userIdentifier],
    queryFn: async () => {
      return getUserFavorites(userIdentifier);
    },
    enabled: !!userIdentifier,
  };
});

// För att få tillgång till en global lista med "vill gå"
export const userWishlistAtom = atomWithQuery((get) => {
  const userIdentifier = get(userIdentifierAtom);
  return {
    queryKey: ["userWishlist", userIdentifier],
    queryFn: async () => {
      return getUserWishlist(userIdentifier);
    },
    enabled: !!userIdentifier,
  };
});

// Lägga till en ny i favorit-listan
export const addToFavoritesAtom = atom(
  null,
  async (get, set, trailIdentifier: string) => {
    const queryClient = get(queryClientAtom);

    try {
      await addToUserFavorite(USER_IDENTIFIER, trailIdentifier);
      queryClient.invalidateQueries({ queryKey: ["userFavorites"] });
      set(
        showSuccessAtom,
        "Leden har lagts till, du hittar listan under din profil.",
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        set(showWarningAtom, "Leden finns redan bland dina favoriter!");
      } else {
        set(showErrorAtom, "Kunde inte lägga till i din favoritlista.");
      }
    }
  },
);

// Lägga till en ny i "vill gå"-listan
export const addToWishlistAtom = atom(
  null,
  async (get, set, trailIdentifier: string) => {
    const queryClient = get(queryClientAtom);

    try {
      await addToUserWishlist(USER_IDENTIFIER, trailIdentifier);

      queryClient.invalidateQueries({ queryKey: ["userWishlist"] });
      set(
        showSuccessAtom,
        "Leden har lagts till, du hittar listan under min profil!",
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        set(showWarningAtom, "Leden finns redan i din önskelista!");
      } else {
        set(showErrorAtom, "Kunde inte lägga till i din önskelista.");
      }
    }
  },
);

// Ta bort från lista med optimistiska uppdateringar
// https://tanstack.com/query/v4/docs/framework/react/guides/optimistic-updates
export const removeFromWishlistAtom = atom(
  null,
  async (get, set, trailIdentifier: string) => {
    const queryClient = get(queryClientAtom);
    // Avbryt om det finns några pågående queries
    await queryClient.cancelQueries({
      queryKey: ["userWishlist", USER_IDENTIFIER],
    });

    // Hämtar det som är sparat i cachen och sparar det i en egen variable ifall nåt går snett
    const previousWishlist = queryClient.getQueryData<
      UserWishlistTrailCollection[]
    >(["userWishlist", USER_IDENTIFIER]);

    // Filtera bort den som ska tas bort innan den tas bort för att det ska se fräckt ut
    queryClient.setQueryData<UserWishlistTrailCollection[]>(
      ["userWishlist", USER_IDENTIFIER],
      (old) => old?.filter((trail) => trail.identifier !== trailIdentifier),
    );

    try {
      // Försöker ta bort promenaden användaren kryssat
      await removeUserWishlist(USER_IDENTIFIER, trailIdentifier);
    } catch (error) {
      // Går något fel så återsälls listan men bara om listan inte är undefined.
      if (previousWishlist) {
        queryClient.setQueryData(
          ["userWishlist", USER_IDENTIFIER],
          previousWishlist,
        );
      }
      set(showErrorAtom, "Kunde inte ta bort leden från listan.");
      console.error("Failed to remove trail from wishlist:", error);
      throw error;
    } finally {
      // Hämta om på nytt
      queryClient.invalidateQueries({
        queryKey: ["userWishlist", USER_IDENTIFIER],
      });
    }
  },
);

export const removeFromFavoritesAtom = atom(
  null,
  async (get, set, trailIdentifier: string) => {
    const queryClient = get(queryClientAtom);

    await queryClient.cancelQueries({
      queryKey: ["userFavorites", USER_IDENTIFIER],
    });

    const previousFavoritesList = queryClient.getQueryData<
      UserFavoritesTrailCollection[]
    >(["userFavorites", USER_IDENTIFIER]);

    queryClient.setQueryData<UserFavoritesTrailCollection[]>(
      ["userFavorites", USER_IDENTIFIER],
      (old) => old?.filter((trail) => trail.identifier !== trailIdentifier),
    );

    try {
      await removeUserFavorite(USER_IDENTIFIER, trailIdentifier);
    } catch (error) {
      if (previousFavoritesList) {
        queryClient.setQueryData(
          ["userFavorites", USER_IDENTIFIER],
          previousFavoritesList,
        );
      }
      set(showErrorAtom, "Kunde inta ta bort från listan!");
      console.error("Failed to remove trail from favorites", error);
    } finally {
      queryClient.invalidateQueries({
        queryKey: ["userFavorites", USER_IDENTIFIER],
      });
    }
  },
);
