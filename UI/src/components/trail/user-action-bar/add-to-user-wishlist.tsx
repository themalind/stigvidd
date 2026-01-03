import { addToWishlistAtom } from "@/providers/user-atoms";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSetAtom } from "jotai";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  trailIdentifier: string;
}

export default function AddToUserWishlist({ trailIdentifier }: Props) {
  const theme = useTheme();
  const addToWishlist = useSetAtom(addToWishlistAtom);

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={s.touchable}
        onPress={() => addToWishlist(trailIdentifier)}
      >
        <MaterialIcons name="add" size={30} color={theme.colors.onPrimary} />
        <Text style={[s.text, { color: theme.colors.onPrimary }]}>Vill gå</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "column",
  },
  touchable: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 12,
  },
});
