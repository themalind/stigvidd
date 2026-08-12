import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import { StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface Props {
  visible: boolean;
  onContinue: () => void;
  onDecline: () => void;
}

/**
 * Prominent disclosure shown BEFORE the system location prompt.
 *
 * Google Play requires an in-app disclosure ahead of the runtime permission dialog for
 * background location: what is collected, that it continues in the background, what it is
 * used for, and an affirmative action to proceed. It may not live in the privacy policy —
 * it has to stand in the way. Deliberately not dismissable by tapping outside, so the
 * user makes an explicit choice.
 *
 * Distinct from RecordingInfoDialog on purpose: that one explains how recording behaves
 * (auto-stop, trimming) and can be silenced with "don't show again". This one is consent
 * information and is shown until the permission is granted.
 */
export default function LocationDisclosureDialog({ visible, onContinue, onDecline }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const lines = [
    t("createHike.disclosureBackground"),
    t("createHike.disclosurePrivate"),
    t("createHike.disclosureScope"),
  ];

  return (
    <Portal>
      <Dialog
        style={[s.dialog, { backgroundColor: theme.colors.background }]}
        visible={visible}
        dismissable={false}
        onDismiss={onDecline}
      >
        <Dialog.Title>{t("createHike.disclosureTitle")}</Dialog.Title>
        <Dialog.Content>
          <View style={s.lines}>
            <Text variant="bodyMedium">{t("createHike.disclosureIntro")}</Text>
            {lines.map((line, index) => (
              <View key={index} style={s.bulletRow}>
                <Text variant="bodyMedium">{"•"}</Text>
                <Text variant="bodyMedium" style={s.bulletText}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDecline}>{t("createHike.disclosureDecline")}</Button>
          <Button onPress={onContinue}>{t("createHike.disclosureContinue")}</Button>
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
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  bulletText: {
    flex: 1,
  },
});
