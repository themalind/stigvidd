import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import { INACTIVITY_TIMEOUT, MAX_DURATION } from "@/services/location-task";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Checkbox, Dialog, Portal, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  // When provided, the dialog is shown before recording starts: it offers a
  // "don't show again" checkbox and a Start button (the boolean reports the
  // checkbox state). When omitted, the dialog is purely informational (OK only).
  onStart?: (dontShowAgain: boolean) => void;
}

const INACTIVITY_MINUTES = Math.round(INACTIVITY_TIMEOUT / 60_000);
const MAX_HOURS = Math.round(MAX_DURATION / 3_600_000);

export default function RecordingInfoDialog({ visible, onDismiss, onStart }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const lines = [
    t("createHike.infoIntro"),
    t("createHike.infoInactivity", { minutes: INACTIVITY_MINUTES }),
    t("createHike.infoMaxDuration", { hours: MAX_HOURS }),
    t("createHike.infoTrimHint"),
  ];

  return (
    <Portal>
      <Dialog style={[s.dialog, { backgroundColor: theme.colors.background }]} visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t("createHike.infoTitle")}</Dialog.Title>
        <Dialog.Content>
          <View style={s.lines}>
            {lines.map((line, index) => (
              <Text key={index} variant="bodyMedium">
                {line}
              </Text>
            ))}
          </View>
          {onStart && (
            <Pressable style={s.checkboxRow} onPress={() => setDontShowAgain((prev) => !prev)}>
              <Checkbox status={dontShowAgain ? "checked" : "unchecked"} />
              <Text variant="bodyMedium">{t("createHike.dontShowAgain")}</Text>
            </Pressable>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          {onStart && <Button onPress={onDismiss}>{t("common.cancel")}</Button>}
          {onStart && <Button onPress={() => onStart(dontShowAgain)}>{t("createHike.start")}</Button>}
          {!onStart && <Button onPress={onDismiss}>{t("common.ok")}</Button>}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const s = StyleSheet.create({
  dialog: {
    borderRadius: DIALOG_BORDER_RADIUS,
  },
  lines: {
    gap: 10,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 8,
  },
});
