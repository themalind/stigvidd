import { OVERLAY_TEXT_SHADOW, SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { buildDecorativeRoute } from "@/utils/decorative-route";
import { guardedNavigate } from "@/utils/navigation";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, Text } from "react-native-paper";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

const CARD_HEIGHT = 240;
const ROUTE_BAND_HEIGHT = 108;
const DRAW_DURATION_MS = 1900;
const DRAW_DELAY_MS = 350;

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  signedIn: boolean;
}

// Stands in for the latest-hike card when there is no walk to show, opening the home
// screen for new users. The route draws itself across the photo as the pitch.
//
// Not a real map: mounting MapLibre would spend basemap requests on people who have not
// signed up.
export default function GetStartedCard({ signedIn }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const background = require("../../assets/images/createHike.webp");

  const cardWidth = width - SCREEN_PADDING * 2;
  const route = useMemo(() => buildDecorativeRoute(cardWidth, ROUTE_BAND_HEIGHT), [cardWidth]);

  // Plays once on mount, not looping — a line redrawing itself forever would never let
  // the page settle.
  const progress = useSharedValue(1);
  useEffect(() => {
    progress.value = withDelay(
      DRAW_DELAY_MS,
      withTiming(0, { duration: DRAW_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
    );
  }, [progress]);

  const animatedRoute = useAnimatedProps(() => ({ strokeDashoffset: route.length * progress.value }));

  const target = signedIn ? "/(tabs)/(profile-stack)/user/create-hike" : "/(tabs)/(profile-stack)/login";

  return (
    <View style={s.card}>
      {/* Portrait photo in a landscape card, so cover takes a horizontal slice. */}
      <Image source={background} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" />
      {/* Leaves the top third clear so the photo keeps its light, then ramps to near-solid
          under the words. */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.82)", "rgba(0,0,0,0.94)"]}
        locations={[0, 0.35, 0.55, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.routeBand} pointerEvents="none">
        <Svg width={cardWidth} height={ROUTE_BAND_HEIGHT}>
          {/* Drawn twice: a dark halo under a white line, so the route reads over sky,
              cloud or foliage alike. */}
          <AnimatedPath
            d={route.d}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={route.length}
            animatedProps={animatedRoute}
          />
          <AnimatedPath
            d={route.d}
            stroke="#ffffff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={route.length}
            animatedProps={animatedRoute}
          />
          <Circle
            cx={route.start[0]}
            cy={route.start[1]}
            r={5}
            fill="#ffffff"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={2}
          />
        </Svg>
      </View>
      <View style={s.content}>
        <Text style={s.title}>{signedIn ? t("home.getStartedNoHikesTitle") : t("home.getStartedSignedOutTitle")}</Text>
        <Text style={s.body}>{signedIn ? t("home.getStartedNoHikesBody") : t("home.getStartedSignedOutBody")}</Text>
        <Button
          mode="contained"
          icon={signedIn ? "record-circle-outline" : "login"}
          style={s.action}
          onPress={() => guardedNavigate(() => router.navigate(target))}
        >
          {signedIn ? t("home.getStartedNoHikesAction") : t("home.getStartedSignedOutAction")}
        </Button>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  routeBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ROUTE_BAND_HEIGHT,
  },
  content: {
    padding: 14,
    gap: 5,
  },
  title: {
    color: "#ffffff",
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
    ...OVERLAY_TEXT_SHADOW,
  },
  body: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
    ...OVERLAY_TEXT_SHADOW,
  },
  action: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
});
