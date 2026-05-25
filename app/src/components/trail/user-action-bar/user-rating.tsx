import { authStateAtom } from "@/atoms/auth-atoms";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import AddReview from "@/components/review/add/add-review-modal";
import { Trail } from "@/data/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface UserRatingProps {
  trail: Trail;
}

export default function UserRating({ trail }: UserRatingProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [authState] = useAtom(authStateAtom);
  const [showAuthDialog, setAuthDialog] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const onPress = () => {
    if (!authState.isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    setShowModal(true);
  };

  const handleReviewAdded = () => {
    setShowModal(false);
    queryClient.invalidateQueries({ queryKey: ["trail", trail.identifier] });
  };

  return (
    <View style={s.container}>
      <Pressable onPress={onPress} style={s.pressable}>
        <MaterialIcons name="thumb-up-off-alt" size={30} color={theme.colors.onSurface} />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>{t("review.rate")}</Text>
      </Pressable>
      <AddReview
        trailIdentifier={trail.identifier}
        trailName={trail.name}
        trailLenght={trail.trailLenght}
        visible={showModal}
        onDismiss={handleReviewAdded}
      />
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage={t("review.notAuthRating")}
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
