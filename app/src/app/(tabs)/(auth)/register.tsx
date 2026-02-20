import { getRegisterErrorMessage } from "@/api/firebase-errors";
import { registerUserAtom } from "@/atoms/auth-atoms";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import PasswordInputField from "@/components/password-input-field";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useAtom } from "jotai";
import React, { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { Appearance, Dimensions, ImageBackground, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Button, Surface, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const WIDTH = Dimensions.get("screen").width;

const registerFields = z
  .object({
    nickName: z
      .string({ required_error: "Ange ett användarnamn" })
      .min(1)
      .max(20, "Namn för långt. Max 20 tecken")
      .regex(/^[a-zA-Z0-9_-]+$/, "Endast a–z, 0–9, _ och - är tillåtna"),
    email: z.string({ required_error: "Du måste ange en e-post" }).email("Ange en giltig e-post"),
    password: z.string({ required_error: "Ange ett lösenord" }).min(8, "Lösenordet måste vara minst 8 tecken"),
    confirmPassword: z
      .string({
        required_error: "Upprepa lösenord",
      })
      .min(8, "Lösenordet måste vara minst 8 tecken"),
  })
  .superRefine(({ confirmPassword, password }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: "custom",
        message: "Lösenorden matchar inte",
        path: ["confirmPassword"],
      });
    }
  });
type FormFields = z.infer<typeof registerFields>;

const addOpacity = (rgbColor: string, opacity: number): string => {
  return rgbColor.replace("rgb", "rgba").replace(")", `, ${opacity})`);
};

export default function RegisterScreen() {
  const theme = useTheme();
  const [firebaseError, setFirebaseError] = useState("");
  const [userTheme] = useAtom(userThemeAtom);
  const [, registerUser] = useAtom(registerUserAtom);
  const colorScheme = Appearance.getColorScheme();

  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;

  const background =
    finalTheme === "dark"
      ? require("../../../assets/images/register-dark-background-2.jpg")
      : require("../../../assets/images/register-background-2.jpg");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({ resolver: zodResolver(registerFields) });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setFirebaseError("");

    const result = await registerUser(data);

    if (!result.success || !result.user) {
      const errorCode = result.error?.code || "unknown";
      setFirebaseError(getRegisterErrorMessage(errorCode));
      return;
    }
    router.replace("/(tabs)/profile-page");
    console.log("Registrerad", result.user.email, result.user.displayName);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top"]}>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
        contentContainerStyle={s.scrollContent}
      >
        <ImageBackground resizeMode="cover" source={background} style={s.backgroundImage}>
          <Surface elevation={5} style={[s.surface, { backgroundColor: addOpacity(theme.colors.surface, 0.9) }]}>
            <View style={s.logoContainer}>
              <Text style={[s.title, { color: theme.colors.onSurface }]}>Stigvidd</Text>
              <Image source={require("../../../assets/images/mammaapp.png")} style={s.logo} contentFit="contain" />
            </View>
            <View style={s.textInputContainer}>
              <Text style={[s.text, { color: theme.colors.onSurface }]}>Skapa konto</Text>
              <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    error={!!errors.nickName}
                    style={s.textInput}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    label="Smeknamn"
                    autoCapitalize="words"
                    theme={{
                      colors: {
                        primary: theme.colors.onSurface,
                      },
                    }}
                  />
                )}
                name="nickName"
              />
              <View style={s.errorContainer}>
                {errors.nickName && (
                  <Text
                    style={{
                      color: theme.colors.onErrorContainer,
                      backgroundColor: theme.colors.errorContainer,
                      fontWeight: 600,
                    }}
                  >
                    {errors.nickName?.message}
                  </Text>
                )}
              </View>
              <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    error={!!errors.email}
                    style={s.textInput}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    label="Epost"
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
              <View style={s.errorContainer}>
                {errors.email && (
                  <Text
                    style={{
                      color: theme.colors.onErrorContainer,
                      backgroundColor: theme.colors.errorContainer,
                      fontWeight: 600,
                    }}
                  >
                    {errors.email?.message}
                  </Text>
                )}
              </View>
              <Controller
                control={control}
                render={({ field: { onChange, onBlur } }) => (
                  <PasswordInputField
                    passwordCallback={onChange}
                    error={!!errors.password}
                    onBlur={onBlur}
                    label="Lösenord"
                  />
                )}
                name="password"
              />
              <View style={s.errorContainer}>
                {errors.password && (
                  <Text
                    style={{
                      color: theme.colors.onErrorContainer,
                      backgroundColor: theme.colors.errorContainer,
                      fontWeight: 600,
                    }}
                  >
                    {errors.password?.message}
                  </Text>
                )}
              </View>
              <Controller
                control={control}
                render={({ field: { onChange, onBlur } }) => (
                  <PasswordInputField
                    passwordCallback={onChange}
                    error={!!errors.password}
                    onBlur={onBlur}
                    label=" Upprepa Lösenord"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                )}
                name="confirmPassword"
              />
              <View style={s.errorContainer}>
                {errors.confirmPassword && (
                  <Text
                    style={{
                      color: theme.colors.onErrorContainer,
                      backgroundColor: theme.colors.errorContainer,
                      fontWeight: 600,
                    }}
                  >
                    {errors.confirmPassword?.message}
                  </Text>
                )}
              </View>
              <View style={s.actionContainer}>
                <Button mode="contained" style={s.button} onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
                  {isSubmitting ? "Skapar konto..." : "Skapa konto"}
                </Button>
                {firebaseError && <Text style={[s.errorText, { color: theme.colors.error }]}>{firebaseError}</Text>}
                <Link style={[s.linkText, { color: theme.colors.onSurface }]} replace href="./login">
                  <Text>Redan medlem? </Text>
                  <Text
                    style={{
                      color: theme.colors.tertiary,
                    }}
                  >
                    Logga in här.
                  </Text>
                </Link>
              </View>
            </View>
          </Surface>
        </ImageBackground>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  backgroundImage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  logo: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 35,
    fontWeight: "bold",
  },
  text: {
    fontWeight: 400,
    paddingBottom: 15,
    paddingTop: 15,
    fontSize: 25,
    alignSelf: "center",
  },
  textInputContainer: {
    flex: 1,
  },
  textInput: {
    width: WIDTH * 0.65,
  },
  surface: {
    gap: 15,
    padding: 30,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#ffffff90",
    width: WIDTH * 0.8,
  },
  actionContainer: {
    paddingTop: 20,
    gap: 15,
    alignItems: "center",
  },
  button: {
    width: WIDTH * 0.5,
  },
  linkText: {
    fontWeight: 600,
    fontSize: 15,
  },
  errorContainer: {
    height: 30,
  },
  errorText: {
    fontSize: 15,
    fontWeight: 600,
  },
});
