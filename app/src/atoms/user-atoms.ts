// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

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
import { retryUnlessAuthFailure } from "@/api/core/unauthorized";
import { atomWithMutation, atomWithQuery, queryClientAtom } from "jotai-tanstack-query";
import { CURRENT_USER_STALE_TIME, USER_LIST_STALE_TIME } from "@/constants/cache";
import { userAtom } from "./auth-atoms";
import { logger } from "../services/logger";

export const stigviddUserAtom = atomWithQuery((get) => {
  const user = get(userAtom);
  const subjectId = user?.id;

  return {
    queryKey: ["currentUser", subjectId],
    queryFn: async () => {
      return await getStigViddUser();
    },
    enabled: !!subjectId,
    retry: retryUnlessAuthFailure,
    staleTime: CURRENT_USER_STALE_TIME,
  };
});

export const userFavoritesAtom = atomWithQuery((get) => {
  const user = get(userAtom);

  return {
    queryKey: ["userFavorites", user?.id],
    queryFn: async () => {
      return getUserFavorites();
    },
    enabled: !!user,
    staleTime: USER_LIST_STALE_TIME,
  };
});

// The signed-in user's "want to hike" list.
export const userWishlistAtom = atomWithQuery((get) => {
  const user = get(userAtom);

  return {
    queryKey: ["userWishlist", user?.id],
    queryFn: async () => {
      return getUserWishlist();
    },
    enabled: !!user,
    staleTime: USER_LIST_STALE_TIME,
  };
});

// Adds a trail to favourites; a mutation atom so the button can disable itself on isPending.
export const addToFavoritesAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const uid = get(userAtom)?.id;

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
          return old; // Already a favourite.
        }

        return [...old, { identifier: trailIdentifier } as UserFavoritesTrail];
      });

      return { previousFavoritesList };
    },
    // react-query passes the context onMutate returned as the third argument.
    onError: (_error, _trailIdentifier, context: { previousFavoritesList?: UserFavoritesTrail[] } | undefined) => {
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

// Adds a trail to the "want to hike" list.
export const addToWishlistAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const uid = get(userAtom)?.id;

  return {
    mutationKey: ["addToWishlist"],
    mutationFn: async (trailIdentifier: string) => {
      return addToUserWishlist(trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
      queryClient.cancelQueries({ queryKey: ["userWishlist", uid] });

      // Kept so onError can roll back.
      const previousWishlist = queryClient.getQueryData<UserWishlistTrail[]>(["userWishlist", uid]);

      // Shows the trail in the list before the request finishes.
      queryClient.setQueryData<UserWishlistTrail[]>(["userWishlist", uid], (old) => {
        if (!old) return old;
        const alreadyExists = old.some((fav) => fav.identifier === trailIdentifier);

        if (alreadyExists) {
          return old; // Already on the list.
        }
        return [...old, { identifier: trailIdentifier } as UserWishlistTrail];
      });

      return { previousWishlist };
    },

    onError: (_error, _trailIdentifier, context: { previousWishlist?: UserWishlistTrail[] } | undefined) => {
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

// Removes a trail from the "want to hike" list with an optimistic update.
// https://tanstack.com/query/v4/docs/framework/react/guides/optimistic-updates
export const removeFromWishlistAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const uid = get(userAtom)?.id;

  return {
    mutationKey: ["removeFromWishlist"],
    mutationFn: async (trailIdentifier: string) => {
      return await removeUserWishlist(trailIdentifier);
    },

    onMutate: async (trailIdentifier: string) => {
      // Cancels refetches in flight so they cannot overwrite the optimistic list.
      await queryClient.cancelQueries({
        queryKey: ["userWishlist", uid],
      });

      // Kept so onError can roll back.
      const previousWishlist = queryClient.getQueryData<UserWishlistTrail[]>(["userWishlist", uid]);

      // Hides the trail before the request finishes.
      queryClient.setQueryData<UserWishlistTrail[]>(["userWishlist", uid], (old) =>
        old?.filter((trail) => trail.identifier !== trailIdentifier),
      );

      return { previousWishlist };
    },

    onError: (error, _, context: { previousWishlist?: UserWishlistTrail[] } | undefined) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData<UserWishlistTrail[]>(["userWishlist", uid], context?.previousWishlist);
      }
      logger.error("Failed to remove trail from wishlist", { error: String(error) });
    },
    onSettled: () => {
      // Refetches the list from the server.
      queryClient.invalidateQueries({
        queryKey: ["userWishlist", uid],
      });
    },
  };
});

export const removeFromFavoritesAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  const uid = get(userAtom)?.id;

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
      logger.error("Failed to remove trail from favorites", { error: String(error) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["userFavorites", uid],
      });
    },
  };
});
