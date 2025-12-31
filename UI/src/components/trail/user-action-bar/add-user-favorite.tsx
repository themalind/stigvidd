import { addToUserFavorite, ApiError } from "@/api/users";
import {
  showErrorAtom,
  showSuccessAtom,
  showWarningAtom,
} from "@/providers/snackbar-atoms";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  trailIdentifier: string;
}
export default function AddUserFavorite({ trailIdentifier }: Props) {
  const theme = useTheme();
  const showSuccess = useSetAtom(showSuccessAtom);
  const showError = useSetAtom(showErrorAtom);
  const showWarning = useSetAtom(showWarningAtom);
  const userIdentifier: string = "D3AC6D71-B2AA-4B83-B15A-05C610BEBA8E";
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (trailIdentifier: string) =>
      addToUserFavorite(userIdentifier, trailIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      showSuccess("Leden har lagts till, du hittar listan under din profil.");
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 409) {
        showWarning("Leden finns redan i din favoritlista!");
      } else {
        showError("Kunde inte lägga till leden i din favoritlista.");
      }
    },
  });

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={s.touchable}
        onPress={() => addMutation.mutate(trailIdentifier)}
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
