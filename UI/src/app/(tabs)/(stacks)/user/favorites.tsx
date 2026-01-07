import LoadingIndicator from "@/components/loading-indicator";
import UserTrailCollection from "@/components/trail/user-trail-collection";
import { authStateAtom } from "@/providers/auth-atoms";
import {
  removeFromFavoritesAtom,
  userFavoritesAtom,
} from "@/providers/user-atoms";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useAtom } from "jotai";
import React from "react";
import { Text, useTheme } from "react-native-paper";

export default function FavoritesScreen() {
  const theme = useTheme();
  const [{ data, isLoading, isError, error }] = useAtom(userFavoritesAtom); // useAtom är likt useState och retunerar både get och setfunktioner
  const [, removeFromFavorites] = useAtom(removeFromFavoritesAtom);
  const [authState] = useAtom(authStateAtom);

  if (!authState.isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError && error) {
    return <Text style={{ color: theme.colors.error }}>{error.message}</Text>;
  }

  return (
    <UserTrailCollection
      title="Mina favoriter"
      noTrailsSavedInfo="Inga Favoriter sparade än. Gå till en promenad och tryck på hjärtat för att lägga till."
      onDelete={removeFromFavorites}
      trails={data ?? []}
      icon={
        <MaterialCommunityIcons
          name="cards-heart"
          size={24}
          color={theme.colors.tertiary}
        />
      }
    />
  );
}
