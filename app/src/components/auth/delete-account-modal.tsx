import { DeleteUserAccount } from "@/api/auth";
import { getDeleteAccountErrorMessage } from "@/api/firebase-errors";
import { BORDER_RADIUS } from "@/constants/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { Dimensions, StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text, useTheme } from "react-native-paper";
import { z } from "zod";
import AlertDialog from "../alert-dialog";
import PasswordInputField from "./password-input-field";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const deleteUserFields = z.object({
  password: z.string({ required_error: "Ange ett lösenord" }).min(8, "Lösenordet måste vara minst 8 tecken"),
});

type FormFields = z.infer<typeof deleteUserFields>;

const { width } = Dimensions.get("screen");

export default function DeleteAccountModal({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const [firebaseError, setFirebaseError] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingPassword, setPendingPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ resolver: zodResolver(deleteUserFields) });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setFirebaseError("");
    setPendingPassword(data.password);
    setConfirmVisible(true);
  };

  const handleConfirm = async () => {
    setConfirmVisible(false);
    setIsDeleting(true);
    const result = await DeleteUserAccount(pendingPassword);

    if (!result.success) {
      const errorCode = result.error?.code ?? "unknown";
      setFirebaseError(getDeleteAccountErrorMessage(errorCode));
      setIsDeleting(false);
      return;
    }

    onDismiss();
    router.replace("/(tabs)/(auth)/login");
  };

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={isDeleting ? undefined : onDismiss} // Disables close on outsideclick while deleting
      >
        <View style={{ gap: 20, padding: 20 }}>
          <Text style={s.textTitle}>Avsluta konto </Text>
          <Text>Skriv in ditt lösenord</Text>
          <View style={s.textInputContainer}>
            <Controller
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInputField
                  passwordCallback={onChange}
                  error={!!errors.password}
                  onBlur={onBlur}
                  label="Ange lösenord"
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              )}
              name="password"
            />
            {errors.password && (
              <View style={s.errorContainer}>
                <Text
                  style={{
                    color: theme.colors.onErrorContainer,
                    backgroundColor: theme.colors.errorContainer,
                    fontWeight: 600,
                  }}
                >
                  {errors.password.message}
                </Text>
              </View>
            )}
          </View>
          <Button
            mode="contained"
            style={s.button}
            disabled={isDeleting}
            loading={isDeleting}
            onPress={handleSubmit(onSubmit)}
          >
            {isDeleting ? "Avslutar..." : "Skicka"}
          </Button>
          {firebaseError && <Text style={[s.errorText, { color: theme.colors.error }]}>{firebaseError}</Text>}
        </View>
      </Modal>
      <AlertDialog
        visible={confirmVisible}
        textColor={theme.colors.error}
        backgroundColor={theme.colors.surface}
        onDismiss={() => setConfirmVisible(false)}
        title="Avsluta konto"
        infoText={["Är du säker på att du vill avsluta ditt konto?", "ALL din data kommer raderas för alltid!"]}
        confirmText="Avsluta konto"
        onConfirm={handleConfirm}
        cancelText="Avbryt"
      />
    </Portal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainerStyle: {
    width: width * 0.8,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    alignSelf: "center",
  },
  textInputContainer: {
    alignItems: "center",
  },
  errorContainer: {
    height: 30,
  },
  errorText: {
    fontSize: 15,
    fontWeight: 600,
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
  textTitle: {
    fontWeight: 700,
    fontSize: 16,
  },
});
