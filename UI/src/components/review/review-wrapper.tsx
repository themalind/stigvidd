import { authStateAtom } from "@/atoms/auth-atoms";
import { Trail } from "@/data/types";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import React, { RefObject, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";
import AddReview from "./add/add-review-modal";
import TrailReviews from "./trail-reviews";

interface ReviewWrapperProps {
  trail: Trail;
  surfaceToScrollToRef: RefObject<View | null>;
}

export default function ReviewWrapper({
  trail,
  surfaceToScrollToRef,
}: ReviewWrapperProps) {
  const [authState] = useAtom(authStateAtom);
  const [showModal, setShowModal] = useState(false);
  const theme = useTheme();
  const queryClient = useQueryClient();
  const reviews = trail?.reviewsResponse ?? [];

  const handlePress = () => {
    if (!authState.isAuthenticated) {
      Alert.alert("Du är inte inloggad");
      return;
    }

    setShowModal(true);
  };

  const handleReviewAdded = () => {
    setShowModal(false);
    // Invalidera queryn så att trail-data hämtas igen
    queryClient.invalidateQueries({ queryKey: ["trail", trail.identifier] });
  };

  return (
    <Surface
      ref={surfaceToScrollToRef}
      elevation={4}
      mode="elevated"
      style={[s.surface, { backgroundColor: theme.colors.surface }]}
    >
      <View style={{ flexDirection: "row" }}>
        <View style={s.ratingSection}>
          <Text style={[s.title, { color: theme.colors.onSurface }]}>
            Recensioner
          </Text>
          <Text style={[s.ratingNumber, { color: theme.colors.tertiary }]}>
            {`(${reviews.length})`}
          </Text>
        </View>
        <View style={s.iconSection}>
          <Pressable onPress={handlePress}>
            <Ionicons
              name="create-outline"
              size={30}
              color={theme.colors.onBackground}
            />
            <AddReview
              trailIdentifier={trail.identifier}
              trailName={trail.name}
              trailLenght={trail.trailLenght}
              visible={showModal}
              onDismiss={handleReviewAdded}
            />
          </Pressable>
        </View>
      </View>
      {reviews.length === 0 ? (
        <Surface
          elevation={4}
          ref={surfaceToScrollToRef}
          mode="elevated"
          style={[s.surface, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={{ color: theme.colors.onBackground }}>
            Det finns inga recensioner här ännu.
          </Text>
        </Surface>
      ) : (
        <TrailReviews reviews={reviews} />
      )}
    </Surface>
  );
}

const s = StyleSheet.create({
  surface: {
    justifyContent: "center",
    borderRadius: 20,
    padding: 25,
  },
  title: {
    fontWeight: 700,
    fontSize: 20,
  },
  iconSection: {
    gap: 15,
    paddingRight: 5,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    flex: 1,
  },
  ratingNumber: {
    fontSize: 15,
  },
  ratingContainer: {
    transform: [{ translateX: -5 }],
    paddingTop: 10,
  },
  ratingSection: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 15,
  },
});
