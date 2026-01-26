import { ApiError } from "@/api/users";
import { showErrorAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import {
  addToFavoritesAtom,
  removeFromFavoritesAtom,
  userFavoritesAtom,
} from "@/atoms/user-atoms";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  trailIdentifier: string;
}
export default function AddUserFavorite({ trailIdentifier }: Props) {
  const theme = useTheme();
  const { data } = useAtomValue(userFavoritesAtom);
  const [removeUserFavorite] = useAtom(removeFromFavoritesAtom);
  const [addToUserFavorite] = useAtom(addToFavoritesAtom);
  const setWarning = useSetAtom(showWarningAtom);
  const setError = useSetAtom(showErrorAtom);

  const handlePress = () => {
    if (data?.some((trail) => trail.identifier === trailIdentifier)) {
      removeUserFavorite.mutate(trailIdentifier);
    } else {
      addToUserFavorite.mutate(trailIdentifier, {
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setWarning("Leden finns redan i listan!");
          } else {
            setError(`${error}`);
          }
        },
      });
    }
  };

  const isInFavorites = data?.some(
    (trail) => trail.identifier === trailIdentifier,
  );

  const isPending = removeUserFavorite.isPending || addToUserFavorite.isPending;

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={s.touchable}
        onPress={handlePress}
        disabled={isPending}
      >
        <MaterialIcons
          name={isInFavorites ? "favorite" : "favorite-border"}
          size={30}
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
