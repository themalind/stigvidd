import { getUserFavorites, removeUserFavorite } from "@/api/users";
import { UserFavoritesTrailCollection } from "@/data/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useUserFavorites = (userIdentifier: string) => {
  const queryClient = useQueryClient();

  const favoritesQuery = useQuery({
    queryKey: ["userFavorites", userIdentifier],
    queryFn: () => getUserFavorites(userIdentifier),
    enabled: !!userIdentifier && typeof userIdentifier === "string",
  });

  // https://tanstack.com/query/v4/docs/framework/react/guides/optimistic-updates
  // DELETE mutation - Tar bort en favorit med optimistiska uppdateringar
  const deleteMutation = useMutation({
    mutationFn: (trailIdentifier: string) =>
      removeUserFavorite(userIdentifier, trailIdentifier),

    // onMutate körs INNAN API-anropet görs (optimistisk uppdatering)
    onMutate: async (trailIdentifier: string) => {
      // Steg 1: Avbryt alla pågående refetches för att förhindra att de
      // skriver över den optimistiska uppdateringen
      await queryClient.cancelQueries({
        queryKey: ["userFavorites", userIdentifier],
      });

      // Steg 2: Spara det nuvarande värdet så vi kan rulla tillbaka om något går fel
      // Detta är vår "säkerhetskopia"
      const previousFavorites = queryClient.getQueryData<
        UserFavoritesTrailCollection[]
      >(["userFavorites", userIdentifier]);

      // Steg 3: Uppdatera cache DIREKT (optimistiskt) genom att filtrera bort
      // den borttagna favoriten. Detta gör att UI:et uppdateras omedelbart.
      queryClient.setQueryData<UserFavoritesTrailCollection[]>(
        ["userFavorites", userIdentifier],
        (old) => old?.filter((trail) => trail.identifier !== trailIdentifier),
      );

      // Steg 4: Returnera context-objektet med en säkerhetskopia
      // Detta skickas vidare till onError och onSettled
      return { previousFavorites };
    },

    // onError körs om API-anropet misslyckas
    onError: (error: Error, trailIdentifier: string, context) => {
      // Rollback: Återställ till det sparade värdet från onMutate
      // Detta gör att favoriten kommer tillbaka i UI:et om borttagningen misslyckades
      if (context?.previousFavorites) {
        queryClient.setQueryData(
          ["userFavorites", userIdentifier],
          context.previousFavorites,
        );
      }
      console.error("Failed to remove favorite:", error);
    },

    // onSettled körs ALLTID efter mutation (oavsett success eller error)
    onSettled: () => {
      // Invalidera queryn för att tvinga en refetch från servern
      // Detta säkerställer att den lokala datan är synkad med servern
      queryClient.invalidateQueries({
        queryKey: ["userFavorites", userIdentifier],
      });
    },
  });

  // Helper-funktion för att hantera borttagning
  const onDelete = (identifier: string) => {
    deleteMutation.mutate(identifier);
  };

  return {
    favorites: favoritesQuery.data,
    isLoading: favoritesQuery.isLoading,
    isError: favoritesQuery.isError,
    error: favoritesQuery.error,
    onDelete,
  };
};
