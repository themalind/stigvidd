import { getUserWishlist } from "@/api/users";
import LoadingIndicator from "@/components/loading-indicator";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Text } from "react-native-paper";

export default function WishlistScreen() {
  //   const { identifier } = useLocalSearchParams<{ identifier: string }>();
  //   const normalizedIdentifier = Array.isArray(identifier)
  //     ? identifier[0]
  //     : identifier;

  const userIdentifier: string = "D3AC6D71-B2AA-4B83-B15A-05C610BEBA8E";

  const {
    data: wishlist,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["userWishlist", userIdentifier],
    queryFn: () => getUserWishlist(userIdentifier),
    enabled: !!userIdentifier && typeof userIdentifier === "string",
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <Text style={{ color: "red" }}>{error.message}</Text>;
  }

  return (
    <View>
      {wishlist?.map((fav) => (
        <View key={fav.identifier}>
          <Text style={{ color: "black" }}>{fav.description}</Text>
        </View>
      ))}
    </View>
  );
}
