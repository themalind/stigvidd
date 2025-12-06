import { Dimensions, StyleSheet, View } from "react-native";
import UserRating from "../user-rating";
import UserShare from "./user-share";
import AddToUserList from "./add-to-user-list";
import AddUserFavorite from "./add-user-favorite";

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;

export default function UserBar() {
  return (
    <View style={[s.container, { backgroundColor: "rgb(12, 41, 15)" }]}>
      <AddToUserList />
      <UserShare />
      <UserRating />
      <AddUserFavorite />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: WIDTH * 0.9,
    height: HEIGHT * 0.08,
    borderRadius: 20,
    justifyContent: "space-between",
    alignItems: "center",
    flexDirection: "row",
    paddingLeft: 20,
    paddingRight: 20,
  },
});
