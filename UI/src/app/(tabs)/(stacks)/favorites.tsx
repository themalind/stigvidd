import { getUserFavorites, removeUserFavorite } from "@/api/users";
import LoadingIndicator from "@/components/loading-indicator";
import { Rating } from "@/components/trail/rating";
import { Entypo, MaterialCommunityIcons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

export default function FavoritesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const userIdentifier: string = "D3AC6D71-B2AA-4B83-B15A-05C610BEBA8E";
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: favorites,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["userFavorites", userIdentifier],
    queryFn: () => getUserFavorites(userIdentifier),
    enabled: !!userIdentifier && typeof userIdentifier === "string",
  });

  const deleteMutation = useMutation({
    mutationFn: (trailIdentifier: string) =>
      removeUserFavorite(userIdentifier, trailIdentifier),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["userFavorites", userIdentifier],
      });
      setDeletingId(null);
    },
    onError: (error) => {
      console.error("Failed to remove favorite:", error);
      setDeletingId(null);
    },
  });

  const onDelete = (identifier: string) => {
    setDeletingId(identifier);
    deleteMutation.mutate(identifier);
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <Text style={{ color: "red" }}>{error.message}</Text>;
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <View style={s.header}>
        <View style={s.icons}>
          <MaterialCommunityIcons
            name="cards-heart"
            size={24}
            color={theme.colors.tertiary}
          />
          <Text style={s.title}>Mina Favoriter</Text>
        </View>
        <View style={s.icons}>
          <Feather name="filter" size={20} color={theme.colors.onBackground} />
          <FontAwesome
            name="sort-amount-desc"
            size={20}
            color={theme.colors.onBackground}
          />
        </View>
      </View>
      <Divider bold={true} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        {favorites?.map((fav) => (
          <Pressable
            key={fav.identifier}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/(stacks)/trail/[identifier]",
                params: { identifier: fav.identifier },
              })
            }
          >
            <View style={s.trash}>
              <Pressable
                onPress={() => onDelete(fav.identifier)}
                style={s.trash}
              >
                {deletingId === fav.identifier ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.onBackground}
                  />
                ) : (
                  <Entypo
                    name="cross"
                    size={24}
                    color={theme.colors.onBackground}
                  />
                )}
              </Pressable>
            </View>
            <View style={s.favoriteContainer}>
              {fav.trailImages ? (
                <Image
                  style={s.trailImage}
                  source={fav.trailImages[0].imageUrl}
                  contentFit="cover"
                />
              ) : null}
              <View style={s.padding}>
                <View style={s.titleRatingContainer}>
                  <Text style={s.trailName} numberOfLines={1}>
                    {fav.name}
                  </Text>
                  {fav.ratingResponse ? (
                    <Rating starSize={13} ratings={fav.ratingResponse} />
                  ) : null}
                </View>
                <Text>{fav.trailLength} km</Text>
                <Text>{fav.description}</Text>
              </View>
            </View>
            <Divider bold={true} />
          </Pressable>
        ))}
      </ScrollView>
      <LinearGradient
        colors={["transparent", theme.colors.background]}
        style={s.fadeGradientBottom}
        pointerEvents="none"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  trash: {
    alignSelf: "flex-end",
    paddingTop: 5,
  },
  favoriteContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 15,
  },
  header: {
    justifyContent: "space-between",
    flexDirection: "row",
    paddingBottom: 15,
  },
  icons: {
    flexDirection: "row",
    gap: 15,
  },
  title: {
    fontSize: 20,
    alignSelf: "flex-start",
  },
  titleRatingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  padding: {
    padding: 10,
    flex: 1,
  },
  trailName: {
    fontWeight: "700",
    fontSize: 15,
    flex: 1,
    flexShrink: 1,
  },
  trailImage: {
    height: 100,
    aspectRatio: 0.7,
    borderRadius: 10,
  },
  fadeGradientTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 60,
    zIndex: 1,
  },
  fadeGradientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    zIndex: 1,
  },
});
