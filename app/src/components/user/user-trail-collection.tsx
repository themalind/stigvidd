import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { UserFavoritesTrail, UserWishlistTrail } from "@/data/types";
import { guardedNavigate } from "@/utils/navigation";
import { Entypo } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import BackButton from "../back-button";
import { Rating } from "../review/rating";

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
  const { t } = useTranslation();
  return (
    <View style={[s.wrapper, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.container]}
      >
        <View style={s.header}>
          <BackButton />
          {icon}
          <Text style={s.title}>{title}</Text>
        </View>
        <View style={s.content}>
          <Text variant="bodySmall" style={s.sectionSubtitle}>
            {t("collection.tapInfo")}
          </Text>
          <Divider bold={true} />

          {trails?.length ? (
            trails?.map((trail) => (
              <Pressable
                key={trail.identifier}
                onPress={() =>
                  guardedNavigate(() =>
                    router.navigate({
                      pathname: "/(tabs)/(profile-stack)/trail/[identifier]",
                      params: { identifier: trail.identifier },
                    }),
                  )
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
                        <Rating ratings={trail.ratingResponse} starColor={theme.colors.tertiary} />
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
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 5,
  },
  sectionSubtitle: {
    opacity: 0.6,
    paddingHorizontal: 2,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
  },
  icons: {
    flexDirection: "row",
    gap: 15,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
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
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
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
});
