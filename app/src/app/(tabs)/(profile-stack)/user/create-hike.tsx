import { stigviddUserAtom } from "@/atoms/user-atoms";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import RecordingInfoDialog from "@/components/trail/trail-creator/recording-info-dialog";
import TrailCreator from "@/components/trail/trail-creator/trail-creator";
import * as Location from "expo-location";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { SCREEN_PADDING } from "@/constants/constants";
import { Platform, StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function CreateHikeScreen() {
  const [{ isLoading, isError, error }] = useAtom(stigviddUserAtom);
  const theme = useTheme();
  const { t } = useTranslation();
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ granted }) => {
      setLocationGranted(granted);
    });
  }, []);

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
        <IconButton
          icon="information-outline"
          size={20}
          iconColor={theme.colors.onBackground}
          style={s.infoButton}
          accessibilityLabel={t("createHike.infoTitle")}
          onPress={() => setShowInfo(true)}
        />
      </View>
      <View style={s.content}>
        <TrailCreator />
      </View>

      <RecordingInfoDialog visible={showInfo} onDismiss={() => setShowInfo(false)} />
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
  infoButton: {
    margin: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
});
