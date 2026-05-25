import { ApiError } from "@/api/users";
import { authStateAtom } from "@/atoms/auth-atoms";
import { showErrorAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import { addToWishlistAtom, removeFromWishlistAtom, userWishlistAtom } from "@/atoms/user-atoms";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  trailIdentifier: string;
}

export default function AddToUserWishlist({ trailIdentifier }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const [showAuthDialog, setAuthDialog] = useState(false);
  const { data } = useAtomValue(userWishlistAtom);
  const [removeUserWishlist] = useAtom(removeFromWishlistAtom);
  const [addToUserWishlist] = useAtom(addToWishlistAtom);
  const setWarning = useSetAtom(showWarningAtom);
  const setError = useSetAtom(showErrorAtom);

  const handlePress = () => {
    if (!authState.isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    if (data?.some((trail) => trail.identifier === trailIdentifier)) {
      removeUserWishlist.mutate(trailIdentifier);
    } else {
      addToUserWishlist.mutate(trailIdentifier, {
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setWarning(t("userActions.alreadyInList"));
          } else {
            setError(`${error}`);
          }
        },
      });
    }
  };

  const isInWishlist = data?.some((trail) => trail.identifier === trailIdentifier);

  const isPending = removeUserWishlist.isPending || addToUserWishlist.isPending;

  return (
    <View style={s.container}>
      <Pressable style={s.pressable} onPress={handlePress} disabled={isPending}>
        <MaterialIcons name={isInWishlist ? "check" : "add"} size={30} color={theme.colors.onSurface} />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>{t("userActions.wishlist")}</Text>
      </Pressable>
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage={t("userActions.notAuthWishlist")}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "column",
  },
  pressable: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 12,
  },
});
