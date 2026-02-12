import { UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import { Entypo, Feather, FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { Rating } from "../rating";

interface UserTrailCollectionProps {
  title: string;
  noTrailsSavedInfo: string;
  trails: UserFavoritesTrail[] | UserWishlistTrail[];
  onDelete: (identifier: string) => void;
  icon?: React.ReactNode;
}

export default function UserTrailCollection({
  title,
  trails,
  noTrailsSavedInfo,
  onDelete,
  icon,
}: UserTrailCollectionProps) {
  const theme = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <View style={s.header}>
        <View style={s.icons}>
          {icon}
          <Text style={s.title}>{title}</Text>
        </View>
        <View style={s.icons}>
          <Feather name="filter" size={20} color={theme.colors.onBackground} />
          <FontAwesome name="sort-amount-desc" size={20} color={theme.colors.onBackground} />
        </View>
      </View>
      <Divider bold={true} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={trails?.length ? undefined : s.scrollContentCenter}
      >
        {trails?.length ? (
          trails?.map((trail) => (
            <Pressable
              key={trail.identifier}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/(stacks)/trail/[identifier]",
                  params: { identifier: trail.identifier },
                })
              }
            >
              <View style={s.trash}>
                <Pressable onPress={() => onDelete(trail.identifier)} style={s.trash}>
                  <Entypo name="cross" size={24} color={theme.colors.onBackground} />
                </Pressable>
              </View>
              <View style={s.favoriteContainer}>
                {trail.trailImages ? (
                  <Image style={s.trailImage} source={trail.trailImages[0].imageUrl} contentFit="cover" />
                ) : null}
                <View style={s.padding}>
                  <View style={s.titleRatingContainer}>
                    <Text style={s.trailName} numberOfLines={1}>
                      {trail.name}
                    </Text>
                    {trail.ratingResponse ? (
                      <Rating starSize={13} ratings={trail.ratingResponse} starColor={theme.colors.tertiary} />
                    ) : null}
                  </View>
                  <Text>{trail.trailLength} km</Text>
                  <Text>{trail.description}</Text>
                </View>
              </View>
              <Divider bold={true} />
            </Pressable>
          ))
        ) : (
          <View style={s.noTrailMsgContainer}>
            <Text style={s.noTrailMsg}>{noTrailsSavedInfo}</Text>
          </View>
        )}
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
    alignItems: "stretch",
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
  fadeGradientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    zIndex: 1,
  },
  noTrailMsgContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  noTrailMsg: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  scrollContentCenter: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
