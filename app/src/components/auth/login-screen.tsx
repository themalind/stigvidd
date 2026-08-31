// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { asTranslationKey } from "@/i18n";
import { InvalidCredentialsError } from "@/services/keycloak-auth";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import PasswordInputField from "@/components/auth/password-input-field";
import BackButton from "@/components/back-button";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useAtom } from "jotai";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Appearance, Dimensions, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Button, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import ResetPasswordModal from "./reset-password-modal";
import { useAuth } from "@/components/auth/auth-provider";

const HEIGHT = Dimensions.get("screen").height;
const WIDTH = Dimensions.get("screen").width;

const addOpacity = (color: string, opacity: number): string => {
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${opacity})`);
  if (color.startsWith("hsl(")) return color.replace("hsl(", "hsla(").replace(")", `, ${opacity})`);
  return color;
};

const loginFields = z.object({
  email: z.string({ required_error: "auth.validation.emailRequired" }).email("auth.validation.emailInvalid"),
  password: z.string({ required_error: "auth.validation.passwordRequired" }).min(8, "auth.validation.passwordTooShort"),
});

type FormFields = z.infer<typeof loginFields>;

export default function LoginScreen({ showBackButton = false }: { showBackButton?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = Appearance.getColorScheme();
  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;
  const background =
    finalTheme === "dark"
      ? require("../../assets/images/darkmode_login.jpg")
      : require("../../assets/images/lightmode_login.jpg");
  const { login } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({ resolver: zodResolver(loginFields) });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setLoginError("");

    try {
      await login(data.email, data.password);
    } catch (error) {
      setLoginError(
        error instanceof InvalidCredentialsError ? t("auth.invalidCredentials") : t("auth.oidcLoginFailed"),
      );
      return;
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: "transparent" }} edges={["top"]}>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        scrollEnabled={false}
        contentContainerStyle={s.scrollContent}
      >
        <ImageBackground resizeMode="cover" source={background} style={s.backgroundImage}>
          {showBackButton && (
            <View style={s.backButtonContainer}>
              <BackButton />
            </View>
          )}
          <View
            style={[
              s.surface,
              {
                backgroundColor: addOpacity(theme.colors.surface, 0.9),
              },
            ]}
          >
            <View style={s.logoContainer}>
              <Text style={[s.title, { color: theme.colors.onSurface }]}>Stigvidd</Text>
              <Image source={require("../../assets/images/mammaapp.png")} style={s.logo} contentFit="contain" />
            </View>
            <View style={s.textInputContainer}>
              <Text style={[s.text, { color: theme.colors.onSurface }]}>{t("auth.login")}</Text>
              <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    error={!!errors.email}
                    dense
                    style={s.textInput}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    label={t("auth.email")}
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
                    style={[
                      s.errorBadge,
                      { color: theme.colors.onErrorContainer, backgroundColor: theme.colors.errorContainer },
                    ]}
                  >
                    {errors.email.message ? t(asTranslationKey(errors.email.message)) : ""}
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
                    label={t("auth.password")}
                    onSubmitEditing={handleSubmit(onSubmit)}
                    dense
                  />
                )}
                name="password"
              />
              <View style={s.errorContainer}>
                {errors.password && (
                  <Text
                    style={[
                      s.errorBadge,
                      { color: theme.colors.onErrorContainer, backgroundColor: theme.colors.errorContainer },
                    ]}
                  >
                    {errors.password.message ? t(asTranslationKey(errors.password.message)) : ""}
                  </Text>
                )}
              </View>
            </View>
            <View style={s.actionContainer}>
              <Button mode="contained" style={s.button} onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
                {isSubmitting ? t("auth.loggingIn") : t("auth.login")}
              </Button>
              {loginError && <Text style={[s.errorText, { color: theme.colors.error }]}>{loginError}</Text>}
              <Pressable style={{ flexDirection: "row" }} hitSlop={12} onPress={() => setVisible(true)}>
                <Text style={[s.linkText, { color: theme.colors.onSurface }]}>{t("auth.forgotPassword")} </Text>
                <Text
                  style={[
                    s.linkText,
                    {
                      color: theme.colors.tertiary,
                    },
                  ]}
                >
                  {t("auth.resetHere")}
                </Text>
              </Pressable>
              <Link style={[s.linkText, { color: theme.colors.onSurface }]} replace href="./register">
                <Text>{t("auth.notMember")} </Text>
                <Text
                  style={{
                    color: theme.colors.tertiary,
                  }}
                >
                  {t("auth.createAccountHere")}
                </Text>
              </Link>
            </View>
          </View>
        </ImageBackground>
      </KeyboardAwareScrollView>
      <ResetPasswordModal visible={visible} onDismiss={() => setVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    minHeight: HEIGHT,
    paddingBottom: 50,
  },
  backgroundImage: {
    justifyContent: "flex-start",
    alignItems: "center",
    flex: 1,
    paddingTop: HEIGHT * 0.15,
  },
  backButtonContainer: {
    position: "absolute",
    top: 0,
    left: 0,
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
    fontSize: 40,
    fontWeight: "bold",
  },
  textInputContainer: {
    flex: 1,
    // Pinned to the field width so a long error message wraps instead of widening the column.
    width: WIDTH * 0.65,
  },
  textInput: {
    flex: 1,
    width: WIDTH * 0.65,
  },
  surface: {
    gap: 10,
    padding: 22,
    borderRadius: SURFACE_BORDER_RADIUS,
    alignItems: "center",
    width: WIDTH * 0.8,
  },
  linkText: {
    fontWeight: 600,
    fontSize: 15,
  },
  text: {
    fontWeight: 400,
    paddingBottom: 8,
    paddingTop: 8,
    fontSize: 22,
    alignSelf: "center",
  },
  actionContainer: {
    gap: 12,
    alignItems: "center",
  },
  button: {
    width: WIDTH * 0.5,
    borderRadius: BORDER_RADIUS,
  },
  errorContainer: {
    // Doubles as the gap between fields, so it can't collapse to nothing — but a fixed
    // height reserved 30px per field for a message that is usually absent. minHeight
    // keeps the spacing and lets the row grow only when there is something to show.
    minHeight: 12,
    justifyContent: "center",
  },
  errorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 15,
    fontWeight: 600,
  },
});
