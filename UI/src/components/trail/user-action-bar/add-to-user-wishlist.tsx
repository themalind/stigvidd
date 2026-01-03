import { ApiError } from "@/api/users";
import {
  showErrorAtom,
  showRemovedAtom,
  showSuccessAtom,
  showWarningAtom,
} from "@/providers/snackbar-atoms";
import {
  addToWishlistAtom,
  removeFromWishlistAtom,
  userWishlistAtom,
} from "@/providers/user-atoms";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  trailIdentifier: string;
}

export default function AddToUserWishlist({ trailIdentifier }: Props) {
  const theme = useTheme();
  const { data } = useAtomValue(userWishlistAtom);
  const removeFromWishlist = useSetAtom(removeFromWishlistAtom);
  const [{ mutate, isPending }] = useAtom(addToWishlistAtom);
  const setSuccess = useSetAtom(showSuccessAtom);
  const setWarning = useSetAtom(showWarningAtom);
  const setError = useSetAtom(showErrorAtom);
  const setRemoved = useSetAtom(showRemovedAtom);

  const handlePress = () => {
    if (data?.some((trail) => trail.identifier === trailIdentifier)) {
      removeFromWishlist(trailIdentifier);
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
            setError("Kunde inte lägga till i din önskelista.");
          }
        },
      });
    }
  };

  const isInWishlist = data?.some(
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
          name={isInWishlist ? "check" : "add"}
          size={30}
          color={theme.colors.onPrimary}
        />
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
