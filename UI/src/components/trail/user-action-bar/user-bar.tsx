import { Dimensions, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import AddToUserList from "./add-to-user-list";
import AddUserFavorite from "./add-user-favorite";
import UserRating from "./user-rating";
import UserShare from "./user-share";

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;
interface Props {
  trailIdentifier: string;
}

export default function UserBar({ trailIdentifier }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.colors.primary }]}>
      <AddToUserList />
      <UserShare />
      <UserRating />
      <AddUserFavorite trailIdentifier={trailIdentifier} />
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
