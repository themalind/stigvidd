import { BORDER_RADIUS } from "@/constants/constants";
import { Trail } from "@/data/types";
import { Dimensions, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import AddToUserWishlist from "./add-to-user-wishlist";
import AddUserFavorite from "./add-user-favorite";
import UserRating from "./user-rating";
import UserShare from "./user-share";

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;
interface Props {
  trail: Trail;
}

export default function UserBar({ trail }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.colors.primary }]}>
      <AddToUserWishlist trailIdentifier={trail.identifier} />
      <UserShare />
      <UserRating trail={trail} />
      <AddUserFavorite trailIdentifier={trail.identifier} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: WIDTH * 0.9,
    height: HEIGHT * 0.08,
    borderRadius: BORDER_RADIUS,
    justifyContent: "space-between",
    alignItems: "center",
    flexDirection: "row",
    paddingLeft: 20,
    paddingRight: 20,
  },
});
