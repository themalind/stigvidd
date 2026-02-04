import { ApiError } from "@/api/users";
import { authStateAtom } from "@/atoms/auth-atoms";
import { showErrorAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import { addToFavoritesAtom, removeFromFavoritesAtom, userFavoritesAtom } from "@/atoms/user-atoms";
import NotAuthenticatedDialog from "@/components/not-authenticated-msg-dialog";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  trailIdentifier: string;
}
export default function AddUserFavorite({ trailIdentifier }: Props) {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const [showAuthDialog, setAuthDialog] = useState(false);
  const { data } = useAtomValue(userFavoritesAtom);
  const [removeUserFavorite] = useAtom(removeFromFavoritesAtom);
  const [addToUserFavorite] = useAtom(addToFavoritesAtom);
  const setWarning = useSetAtom(showWarningAtom);
  const setError = useSetAtom(showErrorAtom);

  const isInFavorites = data?.some((trail) => trail.identifier === trailIdentifier);

  const isPending = removeUserFavorite.isPending || addToUserFavorite.isPending;

  const handlePress = () => {
    if (!authState.isAuthenticated) {
      setAuthDialog(true);
      return;
    }

    const onError = (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) {
        setWarning("Leden finns redan i listan!");
      } else {
        setError(error instanceof Error ? error.message : "Ett fel uppstod");
      }
    };

    if (isInFavorites) {
      removeUserFavorite.mutate(trailIdentifier, { onError });
    } else {
      addToUserFavorite.mutate(trailIdentifier, { onError });
    }
  };

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.touchable} onPress={handlePress} disabled={isPending}>
        <MaterialIcons name={isInFavorites ? "favorite" : "favorite-border"} size={30} color={theme.colors.onPrimary} />
        <Text style={[s.text, { color: theme.colors.onPrimary }]}>Favorit</Text>
      </TouchableOpacity>
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage="Du behöver vara inloggad för att lägga till i favoriter."
      />
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
