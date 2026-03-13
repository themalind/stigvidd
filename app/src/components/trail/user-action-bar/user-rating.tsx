import { authStateAtom } from "@/atoms/auth-atoms";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import AddReview from "@/components/review/add/add-review-modal";
import { Trail } from "@/data/types";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

interface UserRatingProps {
  trail: Trail;
}

export default function UserRating({ trail }: UserRatingProps) {
  const theme = useTheme();
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
      <TouchableOpacity onPress={onPress} style={s.touchable}>
        <FontAwesome name="thumbs-o-up" size={30} color={theme.colors.onPrimary} />
        <Text style={[s.text, { color: theme.colors.onPrimary }]}>Betygsätt</Text>
      </TouchableOpacity>
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
        infoMessage="Du behöver vara inloggad för att lägga till en recension."
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
