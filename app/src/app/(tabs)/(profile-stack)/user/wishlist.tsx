import { removeFromWishlistAtom, userWishlistAtom } from "@/atoms/user-atoms";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import UserTrailCollection from "@/components/user/user-trail-collection";
import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useAtom } from "jotai";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function WishlistScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [{ data, isLoading, isError, error }] = useAtom(userWishlistAtom);
  const [removeUserWishlist] = useAtom(removeFromWishlistAtom);
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <ErrorView error={error} />;
  }

  const handleDelete = (trailIdentifier: string) => {
    removeUserWishlist.mutate(trailIdentifier);
  };

  return (
    <UserTrailCollection
      title={t("collection.wishlist.title")}
      noTrailsSavedInfo={t("collection.wishlist.empty")}
      onDelete={handleDelete}
      trails={data ?? []}
      icon={<MaterialIcons name="star" size={24} color={theme.colors.tertiary} />}
    />
  );
}
