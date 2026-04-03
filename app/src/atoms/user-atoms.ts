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
import { atomWithMutation, atomWithQuery, queryClientAtom } from "jotai-tanstack-query";
import { userAtom } from "./auth-atoms";

export const stigviddUserAtom = atomWithQuery((get) => {
  const firebaseUser = get(userAtom);
  const firebaseUid = firebaseUser?.uid;

  return {
    queryKey: ["currentUser", firebaseUid],
    queryFn: async () => {
      return await getStigViddUser();
    },
    enabled: !!firebaseUid,
    retry: 3,
  };
});

export const userFavoritesAtom = atomWithQuery((get) => {
  const firebaseUser = get(userAtom);

  return {
    queryKey: ["userFavorites", firebaseUser?.uid],
    queryFn: async () => {
      return getUserFavorites();
    },
    enabled: !!firebaseUser,
  };
});

// För att få tillgång till en global lista med "vill gå"
export const userWishlistAtom = atomWithQuery((get) => {
  const firebaseUser = get(userAtom);

  return {
    queryKey: ["userWishlist", firebaseUser?.uid],
    queryFn: async () => {
      return getUserWishlist();
    },
    enabled: !!firebaseUser,
  };
});

// Lägga till en ny i favorit-listan
// Här används atomWithMutation för att man tex ska kunna komma åt isPending för att disabla knappen när en request sker.
export const addToFavoritesAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const uid = get(userAtom)?.uid;

  return {
    mutationKey: ["addToFavorites"],
    mutationFn: async (trailIdentifier: string) => {
      await addToUserFavorite(trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
      queryClient.cancelQueries({
        queryKey: ["userFavorites", uid],
      });

      const previousFavoritesList = queryClient.getQueryData<UserFavoritesTrail[]>(["userFavorites", uid]);

      queryClient.setQueryData<UserFavoritesTrail[]>(["userFavorites", uid], (old) => {
        if (!old) return old;
        const alreadyExists = old.some((fav) => fav.identifier === trailIdentifier);

        if (alreadyExists) {
          return old; // Gör ingenting om den redan är favorit
        }

        return [...old, { identifier: trailIdentifier } as UserFavoritesTrail];
      });

      return { previousFavoritesList };
    },
    onError: (context: { previousFavoritesList: UserFavoritesTrail[] } | undefined) => {
      if (context?.previousFavoritesList) {
        queryClient.setQueryData(["userFavorites", uid], context.previousFavoritesList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["userFavorites", uid],
      });
    },
  };
});

// Lägga till en ny i "vill gå"-listan
export const addToWishlistAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const uid = get(userAtom)?.uid;

  return {
    mutationKey: ["addToWishlist"],
    mutationFn: async (trailIdentifier: string) => {
      return addToUserWishlist(trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
      queryClient.cancelQueries({ queryKey: ["userWishlist", uid] });

      // Hämtar det som är sparat i cachen och sparar det i en egen variable ifall nåt går snett
      const previousWishlist = queryClient.getQueryData<UserWishlistTrail[]>(["userWishlist", uid]);

      // Lägg till innan anropet är klart för att det ska se fräckt ut
      queryClient.setQueryData<UserWishlistTrail[]>(["userWishlist", uid], (old) => {
        if (!old) return old;
        const alreadyExists = old.some((fav) => fav.identifier === trailIdentifier);

        if (alreadyExists) {
          return old; // Gör ingenting om den redan är favorit
        }
        return [...old, { identifier: trailIdentifier } as UserWishlistTrail];
      });

      return { previousWishlist };
    },

    onError: (context: { previousWishlist: UserWishlistTrail[] } | undefined) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(["userWishlist", uid], context.previousWishlist);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["userWishlist", uid],
      });
    },
  };
});

// Ta bort från lista med optimistiska uppdateringar
// https://tanstack.com/query/v4/docs/framework/react/guides/optimistic-updates
export const removeFromWishlistAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const uid = get(userAtom)?.uid;

  return {
    mutationKey: ["removeFromWishlist"],
    mutationFn: async (trailIdentifier: string) => {
      return await removeUserWishlist(trailIdentifier);
    },

    // Avbryt om det finns några pågående queries
    onMutate: async (trailIdentifier: string) => {
      await queryClient.cancelQueries({
        queryKey: ["userWishlist", uid],
      });

      // Hämtar det som är sparat i cachen och sparar det i en egen variable ifall nåt går snett
      const previousWishlist = queryClient.getQueryData<UserWishlistTrail[]>(["userWishlist", uid]);

      // Filtera bort den som ska tas bort innan den tas bort för att det ska se fräckt ut
      queryClient.setQueryData<UserWishlistTrail[]>(["userWishlist", uid], (old) =>
        old?.filter((trail) => trail.identifier !== trailIdentifier),
      );

      return { previousWishlist };
    },

    onError: (error, _, context: { previousWishlist?: UserWishlistTrail[] } | undefined) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData<UserWishlistTrail[]>(["userWishlist", uid], context?.previousWishlist);
      }
      console.error("Failed to remove from wishlist", error);
    },
    onSettled: () => {
      // Hämta om på nytt
      queryClient.invalidateQueries({
        queryKey: ["userWishlist", uid],
      });
    },
  };
});

export const removeFromFavoritesAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const uid = get(userAtom)?.uid;

  return {
    mutationKey: ["removeFromFavorites"],
    mutationFn: async (trailIdentifier: string) => {
      return await removeUserFavorite(trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
      await queryClient.cancelQueries({
        queryKey: ["userFavorites", uid],
      });

      const previousFavoritesList = queryClient.getQueryData<UserFavoritesTrail[]>(["userFavorites", uid]);

      queryClient.setQueryData<UserFavoritesTrail[]>(["userFavorites", uid], (old) =>
        old?.filter((trail) => trail.identifier !== trailIdentifier),
      );

      return { previousFavoritesList };
    },

    onError: (error, _, context: { previousFavoritesList?: UserFavoritesTrail[] } | undefined) => {
      if (context?.previousFavoritesList) {
        queryClient.setQueryData(["userFavorites", uid], context.previousFavoritesList);
      }
      console.error("Failed to remove trail from favorites", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["userFavorites", uid],
      });
    },
  };
});
