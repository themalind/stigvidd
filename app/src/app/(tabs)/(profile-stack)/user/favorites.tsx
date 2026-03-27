import { authStateAtom } from "@/atoms/auth-atoms";
import { removeFromFavoritesAtom, userFavoritesAtom } from "@/atoms/user-atoms";
import LoadingIndicator from "@/components/loading-indicator";
import UserTrailCollection from "@/components/user/user-trail-collection";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useAtom } from "jotai";
import { Text, useTheme } from "react-native-paper";

export default function FavoritesScreen() {
  const theme = useTheme();
  const [{ data, isLoading, isError, error }] = useAtom(userFavoritesAtom);
  const [removeFromFavorite] = useAtom(removeFromFavoritesAtom);
  const [authState] = useAtom(authStateAtom);

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError && error) {
    return <Text style={{ color: theme.colors.error }}>{error.message}</Text>;
  }

  const handleDelete = (trailIdentifier: string) => {
    removeFromFavorite.mutate(trailIdentifier);
  };

  return (
    <UserTrailCollection
      title="Mina favoriter"
      noTrailsSavedInfo="Inga Favoriter sparade än. Gå till en promenad och tryck på hjärtat för att lägga till."
      onDelete={handleDelete}
      trails={data ?? []}
      icon={<MaterialCommunityIcons name="cards-heart" size={24} color={theme.colors.tertiary} />}
    />
  );
}
