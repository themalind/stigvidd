import LoadingIndicator from "@/components/loading-indicator";
import UserTrailCollection from "@/components/trail/user-trail-collection";
import { useUserWishlist } from "@/hooks/user-wishlist";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, useTheme } from "react-native-paper";

export default function WishlistScreen() {
  const theme = useTheme();
  const userIdentifier: string = "D3AC6D71-B2AA-4B83-B15A-05C610BEBA8E";
  const { wishlist, isLoading, isError, error, onDelete } =
    useUserWishlist(userIdentifier);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError && error) {
    return <Text style={{ color: theme.colors.error }}>{error.message}</Text>;
  }

  return (
    <UserTrailCollection
      title="Vill gå"
      noTrailsSavedInfo="Du har inga sparade promenader som du vill gå än."
      onDelete={onDelete}
      trails={wishlist ?? []}
      icon={
        <MaterialIcons name="star" size={24} color={theme.colors.tertiary} />
      }
    />
  );
}
