import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import { ActiveHike } from "@/data/types";
import { StyleSheet } from "react-native";
import { Dialog, Portal, useTheme } from "react-native-paper";
import SaveHikeForm from "./save-hike-form";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  hike: ActiveHike;
}

export default function SaveHikeModal({ visible, onDismiss, onConfirm, hike }: Props) {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog
        style={[s.container, { backgroundColor: theme.colors.background }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <Dialog.Title>Spara Promenad</Dialog.Title>
        <Dialog.Content>
          <SaveHikeForm hike={hike} onDismiss={onDismiss} />
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: DIALOG_BORDER_RADIUS,
  },
});
