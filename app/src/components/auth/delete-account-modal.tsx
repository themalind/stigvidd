import { useAuth } from "@/components/auth/auth-provider";
import { asTranslationKey } from "@/i18n";
import { InvalidCredentialsError } from "@/services/keycloak-auth";
import { BORDER_RADIUS } from "@/constants/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { z } from "zod";
import AlertDialog from "../alert-dialog";
import PasswordInputField from "./password-input-field";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const deleteUserFields = z.object({
  password: z.string({ required_error: "auth.validation.passwordRequired" }).min(8, "auth.validation.passwordTooShort"),
});

type FormFields = z.infer<typeof deleteUserFields>;

const { width } = Dimensions.get("screen");

export default function DeleteAccountModal({ visible, onDismiss }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { deleteAccount } = useAuth();
  const [deleteError, setDeleteError] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingPassword, setPendingPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ resolver: zodResolver(deleteUserFields) });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setDeleteError("");
    setPendingPassword(data.password);
    setConfirmVisible(true);
  };

  const handleConfirm = async () => {
    setConfirmVisible(false);
    setIsDeleting(true);
    try {
      await deleteAccount(pendingPassword);
    } catch (error) {
      setDeleteError(
        error instanceof InvalidCredentialsError
          ? t("auth.invalidCredentials")
          : t("auth.couldNotDeleteFromServer"),
      );
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
        onDismiss={isDeleting ? undefined : onDismiss}
      >
        <View style={{ gap: 20, padding: 20 }}>
          <View style={s.titleDismissView}>
            <Text style={s.textTitle}>{t("auth.deleteAccount")} </Text>
            <Pressable hitSlop={12} onPress={onDismiss}>
              <Icon source="close" size={24} />
            </Pressable>
          </View>
          <Text>{t("auth.enterYourPassword")}</Text>
          <View style={s.textInputContainer}>
            <Controller
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInputField
                  passwordCallback={onChange}
                  error={!!errors.password}
                  onBlur={onBlur}
                  label={t("auth.enterPassword")}
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
                  {errors.password.message ? t(asTranslationKey(errors.password.message)) : ""}
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
            {isDeleting ? t("auth.deletingAccount") : t("common.send")}
          </Button>
          {deleteError && <Text style={[s.errorText, { color: theme.colors.error }]}>{deleteError}</Text>}
        </View>
      </Modal>
      <AlertDialog
        visible={confirmVisible}
        textColor={theme.colors.error}
        backgroundColor={theme.colors.surface}
        onDismiss={() => setConfirmVisible(false)}
        title={t("auth.deleteAccount")}
        infoText={[t("auth.confirmDeleteAccount"), t("auth.deleteAccountWarning")]}
        confirmText={t("auth.deleteAccount")}
        onConfirm={handleConfirm}
        cancelText={t("common.cancel")}
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
  titleDismissView: {
    justifyContent: "space-between",
    flexDirection: "row",
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
