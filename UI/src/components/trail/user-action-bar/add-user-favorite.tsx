import { ApiError } from "@/api/users";
import {
  showErrorAtom,
  showRemovedAtom,
  showSuccessAtom,
  showWarningAtom,
} from "@/providers/snackbar-atoms";
import {
  addToFavoritesAtom,
  removeFromFavoritesAtom,
  userFavoritesAtom,
} from "@/providers/user-atoms";
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
  const removeFromFavorites = useSetAtom(removeFromFavoritesAtom);
  const [{ mutate, isPending }] = useAtom(addToFavoritesAtom);
  const setSuccess = useSetAtom(showSuccessAtom);
  const setWarning = useSetAtom(showWarningAtom);
  const setError = useSetAtom(showErrorAtom);
  const setRemoved = useSetAtom(showRemovedAtom);

  const handlePress = () => {
    if (data?.some((trail) => trail.identifier === trailIdentifier)) {
      removeFromFavorites(trailIdentifier);
      setRemoved("Leden har tagits bort från din lista");
    } else {
      mutate(trailIdentifier, {
        onSuccess: () => {
          setSuccess(
            "Leden har lagts till, du hittar listan under din profil.",
          );
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setWarning("Leden finns redan i listan!");
          } else {
            setError("Kunde inte lägga till i din favoritlista.");
          }
        },
      });
    }
  };

  const isInFavorites = data?.some(
    (trail) => trail.identifier === trailIdentifier,
  );

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
