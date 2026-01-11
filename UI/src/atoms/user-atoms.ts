import {
  addToUserFavorite,
  addToUserWishlist,
  getStigViddUser,
  getUserFavorites,
  getUserWishlist,
  removeUserFavorite,
  removeUserWishlist,
} from "@/api/users";
import { UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import {
  atomWithMutation,
  atomWithQuery,
  queryClientAtom,
} from "jotai-tanstack-query";
import { userAtom } from "./auth-atoms";

export const stigviddUserAtom = atomWithQuery((get) => {
  const firebaseUser = get(userAtom);
  const firebaseUid = firebaseUser?.uid;

  return {
    queryKey: ["user", firebaseUid],
    queryFn: async () => {
      if (!firebaseUid) {
        throw new Error("firebaseUid is required");
      }
      return await getStigViddUser(firebaseUid);
    },
    enabled: !!firebaseUid,
    retry: 3,
  };
});

export const userFavoritesAtom = atomWithQuery((get) => {
  const userQuery = get(stigviddUserAtom);
  const userIdentifier = userQuery.data?.identifier;

  return {
    queryKey: ["userFavorites", userIdentifier],
    queryFn: async () => {
      if (!userIdentifier) {
        throw new Error("firebaseUid is required");
      }
      return getUserFavorites(userIdentifier);
    },
    enabled: !!userIdentifier,
  };
});

// För att få tillgång till en global lista med "vill gå"
export const userWishlistAtom = atomWithQuery((get) => {
  const userQuery = get(stigviddUserAtom);
  const userIdentifier = userQuery.data?.identifier;

  return {
    queryKey: ["userWishlist", userIdentifier],
    queryFn: async () => {
      if (!userIdentifier) {
        throw new Error("firebaseUid is required");
      }
      return getUserWishlist(userIdentifier);
    },
    enabled: !!userIdentifier,
  };
});

// Lägga till en ny i favorit-listan
// Här används atomWithMutation för att man tex ska kunna komma åt isPending för att disabla knappen när en request sker.
export const addToFavoritesAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const userQuery = get(stigviddUserAtom);
  const userIdentifier = userQuery.data?.identifier;

  return {
    mutationFn: async (trailIdentifier: string) => {
      if (!userIdentifier) {
        throw new Error("Du behöver logga in för att spara en promenad");
      }
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
  const userQuery = get(stigviddUserAtom);
  const userIdentifier = userQuery.data?.identifier;

  return {
    mutationFn: async (trailIdentifier: string) => {
      if (!userIdentifier) {
        throw new Error("Du behöver logga in för att spara en promenad");
      }
      return addToUserWishlist(userIdentifier, trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
      queryClient.cancelQueries({ queryKey: ["userWishlist", userIdentifier] });

      // Hämtar det som är sparat i cachen och sparar det i en egen variable ifall nåt går snett
      const previousWishlist = queryClient.getQueryData<UserWishlistTrail[]>([
        "userWishlist",
        userIdentifier,
      ]);

      // Lägg till innan anropet är klart för att det ska se fräckt ut
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
export const removeFromWishlistAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const userQuery = get(stigviddUserAtom);
  const userIdentifier = userQuery.data?.identifier;

  return {
    mutationFn: async (trailIdentifier: string) => {
      if (!userIdentifier) {
        throw new Error("No user identifier");
      }
      return await removeUserWishlist(userIdentifier, trailIdentifier);
    },

    // Avbryt om det finns några pågående queries
    onMutate: async (trailIdentifier: string) => {
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

      return { previousWishlist };
    },

    onError: (
      error,
      _,
      context: { previousWishlist?: UserWishlistTrail[] } | undefined,
    ) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData<UserWishlistTrail[]>(
          ["userWishlist", userIdentifier],
          context?.previousWishlist,
        );
      }
      console.error("Failed to remove from wishlist", error);
    },
    onSettled: () => {
      // Hämta om på nytt
      queryClient.invalidateQueries({
        queryKey: ["userWishlist", userIdentifier],
      });
    },
  };
});

export const removeFromFavoritesAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const userQuery = get(stigviddUserAtom);
  const userIdentifier = userQuery.data?.identifier;

  return {
    mutationFn: async (trailIdentifier: string) => {
      if (!userIdentifier) {
        throw new Error("No user identifier");
      }
      return await removeUserFavorite(userIdentifier, trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
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

      return { previousFavoritesList };
    },

    onError: (
      error,
      _,
      context: { previousFavoritesList?: UserFavoritesTrail[] } | undefined,
    ) => {
      if (context?.previousFavoritesList) {
        queryClient.setQueryData(
          ["userFavorites", userIdentifier],
          context.previousFavoritesList,
        );
      }
      console.error("Failed to remove trail from favorites", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["userFavorites", userIdentifier],
      });
    },
  };
});
