import {
  addToUserFavorite,
  addToUserWishlist,
  getUserFavorites,
  getUserWishlist,
  removeUserFavorite,
  removeUserWishlist,
} from "@/api/users";
import { UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import { atom } from "jotai";
import {
  atomWithMutation,
  atomWithQuery,
  queryClientAtom,
} from "jotai-tanstack-query";
import { showErrorAtom } from "./snackbar-atoms";

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
// Här används atomWithMutation för att man tex ska kunna komma åt isPending för att disabla knappen när en request sker.
export const addToFavoritesAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const userIdentifier = get(userIdentifierAtom);
  return {
    mutationFn: async (trailIdentifier: string) => {
      await addToUserFavorite(userIdentifier, trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
      queryClient.cancelQueries({
        queryKey: ["userFavorites", userIdentifier],
      });

      const previousFavoritesList = queryClient.getQueryData<
        UserFavoritesTrail[]
      >(["userFavorites", userIdentifier]);

      queryClient.setQueryData<UserFavoritesTrail[]>(
        ["userFavorites", userIdentifier],
        (old) => {
          if (!old) return old;
          return [
            ...old,
            { identifier: trailIdentifier } as UserFavoritesTrail,
          ];
        },
      );

      return { previousFavoritesList };
    },
    onError: (
      context: { previousFavoritesList: UserFavoritesTrail[] } | undefined,
    ) => {
      if (context?.previousFavoritesList) {
        queryClient.setQueryData(
          ["userFavorites", userIdentifier],
          context.previousFavoritesList,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["userFavorites", userIdentifier],
      });
    },
  };
});

// Lägga till en ny i "vill gå"-listan
export const addToWishlistAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const userIdentifier = get(userIdentifierAtom);

  return {
    mutationFn: async (trailIdentifier: string) => {
      return addToUserWishlist(userIdentifier, trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
      queryClient.cancelQueries({ queryKey: ["userWishlist", userIdentifier] });

      // Hämtar det som är sparat i cachen och sparar det i en egen variable ifall nåt går snett
      const previousWishlist = queryClient.getQueryData<UserWishlistTrail[]>([
        "userWishlist",
        userIdentifier,
      ]);

      // Lägg till innan amnropet är klart för att det ska se fräckt ut
      queryClient.setQueryData<UserWishlistTrail[]>(
        ["userWishlist", userIdentifier],
        (old) => {
          if (!old) return old;
          return [...old, { identifier: trailIdentifier } as UserWishlistTrail];
        },
      );

      return { previousWishlist };
    },

    onError: (
      context: { previousWishlist: UserWishlistTrail[] } | undefined,
    ) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(
          ["userWishlist", userIdentifier],
          context.previousWishlist,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["userWishlist", userIdentifier],
      });
    },
  };
});

// Ta bort från lista med optimistiska uppdateringar
// https://tanstack.com/query/v4/docs/framework/react/guides/optimistic-updates
export const removeFromWishlistAtom = atom(
  null,
  async (get, set, trailIdentifier: string) => {
    const queryClient = get(queryClientAtom);
    const userIdentifier = get(userIdentifierAtom);
    // Avbryt om det finns några pågående queries
    await queryClient.cancelQueries({
      queryKey: ["userWishlist", userIdentifier],
    });

    // Hämtar det som är sparat i cachen och sparar det i en egen variable ifall nåt går snett
    const previousWishlist = queryClient.getQueryData<UserWishlistTrail[]>([
      "userWishlist",
      userIdentifier,
    ]);

    // Filtera bort den som ska tas bort innan den tas bort för att det ska se fräckt ut
    queryClient.setQueryData<UserWishlistTrail[]>(
      ["userWishlist", userIdentifier],
      (old) => old?.filter((trail) => trail.identifier !== trailIdentifier),
    );

    try {
      // Försöker ta bort promenaden användaren kryssat
      await removeUserWishlist(userIdentifier, trailIdentifier);
    } catch (error) {
      // Går något fel så återsälls listan men bara om listan inte är undefined.
      if (previousWishlist) {
        queryClient.setQueryData(
          ["userWishlist", userIdentifier],
          previousWishlist,
        );
      }
      set(showErrorAtom, "Kunde inte ta bort leden från listan.");
      console.error("Failed to remove trail from wishlist:", error);
      throw error;
    } finally {
      // Hämta om på nytt
      queryClient.invalidateQueries({
        queryKey: ["userWishlist", userIdentifier],
      });
    }
  },
);

export const removeFromFavoritesAtom = atom(
  null,
  async (get, set, trailIdentifier: string) => {
    const queryClient = get(queryClientAtom);
    const userIdentifier = get(userIdentifierAtom);

    await queryClient.cancelQueries({
      queryKey: ["userFavorites", userIdentifier],
    });

    const previousFavoritesList = queryClient.getQueryData<
      UserFavoritesTrail[]
    >(["userFavorites", userIdentifier]);

    queryClient.setQueryData<UserFavoritesTrail[]>(
      ["userFavorites", userIdentifier],
      (old) => old?.filter((trail) => trail.identifier !== trailIdentifier),
    );

    try {
      await removeUserFavorite(userIdentifier, trailIdentifier);
    } catch (error) {
      if (previousFavoritesList) {
        queryClient.setQueryData(
          ["userFavorites", userIdentifier],
          previousFavoritesList,
        );
      }
      set(showErrorAtom, "Kunde inta ta bort från listan!");
      console.error("Failed to remove trail from favorites", error);
    } finally {
      queryClient.invalidateQueries({
        queryKey: ["userFavorites", userIdentifier],
      });
    }
  },
);
