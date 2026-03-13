import { userPasswordReset } from "@/api/auth";
import { getPasswordResetErrorMessage } from "@/api/firebase-errors";
import { showSuccessAtom } from "@/atoms/snackbar-atoms";
import { BORDER_RADIUS } from "@/constants/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { BlurView } from "expo-blur";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Modal, Portal, Text, TextInput, useTheme } from "react-native-paper";
import { z } from "zod";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const resetFields = z.object({
  email: z.string({ required_error: "Du måste ange en e-post" }).email("Ange en giltig e-post"),
});

type FormFields = z.infer<typeof resetFields>;

const { width } = Dimensions.get("screen");

export default function ResetPasswordModal({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const [firebaseError, setFirebaseError] = useState("");
  const setSuccessMessage = useSetAtom(showSuccessAtom);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({ resolver: zodResolver(resetFields) });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setFirebaseError("");

    const result = await userPasswordReset(data.email);

    if (!result.success) {
      const errorCode = result.error?.code || "unknown";
      setFirebaseError(getPasswordResetErrorMessage(errorCode));
      return;
    }

    onDismiss();
    setSuccessMessage("Kolla din e-post! Kika även i skräpposten.");
  };

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <View style={{ gap: 20, padding: 20 }}>
          <View style={s.titleDismissView}>
            <Text style={s.textTitle}>Återställ ditt lösenord </Text>
            <Pressable hitSlop={12} onPress={onDismiss}>
              <Icon source="close" size={24} />
            </Pressable>
          </View>
          <View style={s.textInputContainer}>
            <Controller
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  error={!!errors.email}
                  style={s.textInput}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  label="Ange e-post"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  theme={{
                    colors: {
                      primary: theme.colors.onSurface,
                    },
                  }}
                />
              )}
              name="email"
            />
            {errors.email && (
              <View style={s.errorContainer}>
                <Text
                  style={{
                    color: theme.colors.onErrorContainer,
                    backgroundColor: theme.colors.errorContainer,
                    fontWeight: 600,
                  }}
                >
                  {errors.email.message}
                </Text>
              </View>
            )}
          </View>
          <Button mode="contained" style={s.button} disabled={isSubmitting} onPress={handleSubmit(onSubmit)}>
            {isSubmitting ? "Skickar..." : "Skicka"}
          </Button>
          {firebaseError && <Text style={[s.errorText, { color: theme.colors.error }]}>{firebaseError}</Text>}
          <Text style={{ textAlign: "center" }}>Får du inget mail? Kika i din skräppost!</Text>
        </View>
      </Modal>
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
  textInput: {
    width: width * 0.65,
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
