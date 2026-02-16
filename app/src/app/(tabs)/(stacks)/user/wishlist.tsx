import { authStateAtom } from "@/atoms/auth-atoms";
import { removeFromWishlistAtom, userWishlistAtom } from "@/atoms/user-atoms";
import LoadingIndicator from "@/components/loading-indicator";
import UserTrailCollection from "@/components/user/user-trail-collection";
import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useAtom } from "jotai";
import { useCallback } from "react";
import { BackHandler } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function WishlistScreen() {
  const theme = useTheme();
  const [{ data, isLoading, isError, error }] = useAtom(userWishlistAtom);
  const [removeUserWishlist] = useAtom(removeFromWishlistAtom);
  const [authState] = useAtom(authStateAtom);

  useFocusEffect(
    useCallback(() => {
      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        router.navigate("/(tabs)/profile-page");
        return true;
      });
      return () => handler.remove();
    }, []),
  );

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
    removeUserWishlist.mutate(trailIdentifier);
  };

  return (
    <UserTrailCollection
      title="Vill gå"
      noTrailsSavedInfo="Du har inga sparade promenader som du vill gå än. Gå till en promenad och tryck på plusset för att lägga till."
      onDelete={handleDelete}
      trails={data ?? []}
      returnTo="/(tabs)/(stacks)/user/wishlist"
      icon={
        <MaterialIcons name="star" size={24} color={theme.colors.tertiary} />
      }
    />
  );
}
