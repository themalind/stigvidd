import { addToFavoritesAtom } from "@/providers/user-atoms";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSetAtom } from "jotai";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  trailIdentifier: string;
}
export default function AddUserFavorite({ trailIdentifier }: Props) {
  const theme = useTheme();
  const addFavorite = useSetAtom(addToFavoritesAtom);

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={s.touchable}
        onPress={() => addFavorite(trailIdentifier)}
      >
        <MaterialIcons
          name="favorite-border"
          size={24}
          color={theme.colors.onPrimary}
        />
        <Text style={[s.text, { color: theme.colors.onPrimary }]}>Favorit</Text>
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
