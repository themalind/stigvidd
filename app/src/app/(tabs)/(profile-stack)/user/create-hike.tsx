import { authStateAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import TrailCreator from "@/components/trail/trail-creator/trail-creator";
import * as Location from "expo-location";
import { Redirect } from "expo-router";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { SCREEN_PADDING } from "@/constants/constants";
import { Platform, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function CreateHikeScreen() {
  const [{ isLoading, isError, error }] = useAtom(stigviddUserAtom);
  const [authState] = useAtom(authStateAtom);
  const theme = useTheme();
  const { t } = useTranslation();
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ granted }) => {
      setLocationGranted(granted);
    });
  }, []);

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading || locationGranted === null) {
    return <LoadingIndicator />;
  }

  if (!locationGranted) {
    return <Text style={{ color: theme.colors.error }}>{t("createHike.locationRequired")}</Text>;
  }

  if (isError) {
    return <ErrorView error={error} />;
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View style={s.header}>
        <BackButton />
        <Text style={s.title}>Skapa promenad</Text>
      </View>
      <View style={s.content}>
        <TrailCreator />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
});
