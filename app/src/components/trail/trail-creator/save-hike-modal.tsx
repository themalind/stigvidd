import { StyleSheet } from "react-native";
import { Dialog, Portal, useTheme } from "react-native-paper";
import SaveHikeForm from "./save-hike-form";
import { ActiveHike } from "@/data/types";

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
    borderRadius: 20,
  },
});
