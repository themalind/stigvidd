import { addToUserWishlist, ApiError } from "@/api/users";
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

export default function AddToUserWishlist({ trailIdentifier }: Props) {
  const theme = useTheme();
  const showSuccess = useSetAtom(showSuccessAtom);
  const showWarning = useSetAtom(showWarningAtom);
  const showError = useSetAtom(showErrorAtom);
  const queryClient = useQueryClient();
  const userIdentifier: string = "D3AC6D71-B2AA-4B83-B15A-05C610BEBA8E";

  const addMutation = useMutation({
    mutationFn: (trailIdentifier: string) =>
      addToUserWishlist(userIdentifier, trailIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userWishlist"] });
      showSuccess("Leden har lagts till, du hittar listan under min profil!");
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 409) {
        showWarning("Leden finns redan i din önskelista!");
      } else {
        showError("Kunde inte lägga till leden i din önskelista.");
      }
    },
  });

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={s.touchable}
        onPress={() => addMutation.mutate(trailIdentifier)}
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
