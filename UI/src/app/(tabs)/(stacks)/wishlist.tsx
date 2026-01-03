import LoadingIndicator from "@/components/loading-indicator";
import UserTrailCollection from "@/components/trail/user-trail-collection";
import {
  removeFromWishlistAtom,
  userWishlistAtom,
} from "@/providers/user-atoms";
import { MaterialIcons } from "@expo/vector-icons";
import { useAtom } from "jotai";
import { Text, useTheme } from "react-native-paper";

export default function WishlistScreen() {
  const theme = useTheme();
  const [{ data, isLoading, isError, error }] = useAtom(userWishlistAtom);
  const [, removeFromWishlist] = useAtom(removeFromWishlistAtom);

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
      onDelete={removeFromWishlist}
      trails={data ?? []}
      icon={
        <MaterialIcons name="star" size={24} color={theme.colors.tertiary} />
      }
    />
  );
}
