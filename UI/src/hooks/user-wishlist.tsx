import { getUserWishlist, removeUserWishlist } from "@/api/users";
import { UserWishlistTrailCollection } from "@/data/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useUserWishlist = (userIdentifier: string) => {
  const queryClient = useQueryClient();

  const wishlistQuery = useQuery({
    queryKey: ["userWishlist", userIdentifier],
    queryFn: () => getUserWishlist(userIdentifier),
    enabled: !!userIdentifier && typeof userIdentifier === "string",
  });

  const deleteMutation = useMutation({
    mutationFn: (trailIdentifier: string) =>
      removeUserWishlist(userIdentifier, trailIdentifier),

    onMutate: async (trailIdentifier: string) => {
      await queryClient.cancelQueries({
        queryKey: ["userWishlist", userIdentifier],
      });

      const previousWishlist = queryClient.getQueryData<
        UserWishlistTrailCollection[]
      >(["userWishlist", userIdentifier]);

      queryClient.setQueryData<UserWishlistTrailCollection[]>(
        ["userWishlist", userIdentifier],
        (old) => old?.filter((trail) => trail.identifier !== trailIdentifier),
      );

      return { previousWishlist };
    },

    onError: (error: Error, trailIdentifier: string, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(
          ["userWishlist", userIdentifier],
          context.previousWishlist,
        );
      }
      console.error("Failed to remove trail from wishlist:", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["userWishlist", userIdentifier],
      });
    },
  });

  const onDelete = (identifier: string) => {
    deleteMutation.mutate(identifier);
  };

  return {
    wishlist: wishlistQuery.data,
    isLoading: wishlistQuery.isLoading,
    isError: wishlistQuery.isError,
    error: wishlistQuery.error,
    onDelete,
  };
};
