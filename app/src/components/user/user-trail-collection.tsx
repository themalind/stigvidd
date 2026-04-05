import { BORDER_RADIUS } from "@/constants/constants";
import { UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import { Entypo } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import BackButton from "../back-button";
import { Rating } from "../review/rating";

interface UserTrailCollectionProps {
  title: string;
  description?: string;
  noTrailsSavedInfo: string;
  trails: UserFavoritesTrail[] | UserWishlistTrail[];
  onDelete: (identifier: string) => void;
  icon?: React.ReactNode;
}

export default function UserTrailCollection({
  title,
  description,
  trails,
  noTrailsSavedInfo,
  onDelete,
  icon,
}: UserTrailCollectionProps) {
  const theme = useTheme();
  return (
    <View style={[s.wrapper, { backgroundColor: theme.colors.background }]}>
      <BackButton />
      <View style={s.container}>
        <View style={s.header}>
          {icon}
          <Text style={s.title}>{title}</Text>
        </View>
        <Divider bold={true} />
        <View style={[s.infoBox, { backgroundColor: theme.colors.outlineVariant }]}>
          {description && <Text style={s.infoDescription}>{description}</Text>}
          <Text>Tryck på ett spår för mer info. Tryck på X för att ta bort.</Text>
        </View>
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
                    pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
                    params: { identifier: trail.identifier },
                  })
                }
              >
                <View style={s.trailContainer}>
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
                    <Text numberOfLines={3}>{trail.description}</Text>
                  </View>
                  <Pressable onPress={() => onDelete(trail.identifier)} style={s.trash}>
                    <Entypo name="cross" size={24} color={theme.colors.onBackground} />
                  </Pressable>
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
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 10,
  },
  trash: {
    alignSelf: "flex-start",
    paddingTop: 5,
  },
  trailContainer: {
    padding: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  header: {
    justifyContent: "flex-start",
    gap: 10,
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
    borderRadius: BORDER_RADIUS,
  },
  fadeGradientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    zIndex: 1,
  },
  infoBox: {
    borderRadius: BORDER_RADIUS,
    padding: 12,
    marginBottom: 10,
    marginTop: 10,
    gap: 4,
  },
  infoDescription: {
    fontWeight: "600",
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
