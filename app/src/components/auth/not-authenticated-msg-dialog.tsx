import { router } from "expo-router";
import { View } from "react-native";
import { useTheme } from "react-native-paper";
import AlertDialog from "../alert-dialog";

interface DialogProps {
  infoMessage: string;
  visible: boolean;
  onDissmiss: () => void;
  onBeforeNavigate?: () => void;
}

export default function NotAuthenticatedDialog({ infoMessage, visible, onDissmiss, onBeforeNavigate }: DialogProps) {
  const theme = useTheme();
  return (
    <View>
      <AlertDialog
        visible={visible}
        onDismiss={() => onDissmiss()}
        title="Du är inte inloggad"
        infoText={[infoMessage]}
        confirmText="Logga in"
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.onSurface}
        onConfirm={() => {
          onDissmiss();
          onBeforeNavigate?.();
          router.navigate("/(tabs)/(auth)/login");
        }}
      />
    </View>
  );
}
