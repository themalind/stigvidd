// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { resendVerification, verifyEmailCode } from "@/api/auth";
import { asTranslationKey } from "@/i18n";
import { showSuccessAtom } from "@/atoms/snackbar-atoms";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import BackButton from "@/components/back-button";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useAtom, useSetAtom } from "jotai";
import React, { useEffect, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Appearance, Dimensions, ImageBackground, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Button, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const WIDTH = Dimensions.get("screen").width;

// Mirrors EmailVerification:ResendCooldownSeconds on the backend. A shorter value here would
// only produce a request the backend silently ignores, which would look like a broken button.
const RESEND_COOLDOWN_SECONDS = 60;

const verifyFields = z.object({
  code: z.string({ required_error: "auth.validation.codeRequired" }).regex(/^[0-9]{6}$/, "auth.validation.codeInvalid"),
});

type FormFields = z.infer<typeof verifyFields>;

const addOpacity = (color: string, opacity: number): string => {
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${opacity})`);
  if (color.startsWith("hsl(")) return color.replace("hsl(", "hsla(").replace(")", `, ${opacity})`);
  return color;
};

/** Maps the backend's failure code onto the field, so the message lands under the input. */
function messageForCode(code: string): string {
  if (code === "invalid-code") return "auth.validation.codeIncorrect";
  if (code === "code-expired") return "auth.validation.codeExpired";
  if (code === "too-many-attempts") return "auth.validation.codeTooManyAttempts";
  return "auth.unknownError";
}

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = Appearance.getColorScheme();
  const showSuccess = useSetAtom(showSuccessAtom);

  const [verifyError, setVerifyError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;

  const background =
    finalTheme === "dark"
      ? require("../../../assets/images/register-dark-background-2.jpg")
      : require("../../../assets/images/lightmode_register.jpg");

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({ resolver: zodResolver(verifyFields) });

  // One interval for the whole countdown rather than one timeout per tick, so a re-render
  // mid-countdown cannot leave two of them running.
  useEffect(() => {
    if (cooldown <= 0) return;

    const id = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setVerifyError("");

    if (!email) {
      setVerifyError(t("auth.unknownError"));
      return;
    }

    try {
      await verifyEmailCode(email, data.code);
    } catch (error) {
      if (error instanceof ApiError) {
        setError("code", { message: messageForCode(error.message) });
        return;
      }
      setVerifyError(t("auth.unknownError"));
      return;
    }

    // Verified, but still signed out: the account was only just enabled at Keycloak, and the
    // password is not held anywhere on this screen. Log in is the next step, not a session.
    showSuccess(t("auth.emailVerifiedPleaseLogin"));
    router.replace("./login");
  };

  const onResend = async () => {
    if (!email || cooldown > 0 || resending) return;

    setVerifyError("");
    setResending(true);

    try {
      await resendVerification(email);
      // The backend answers 204 whether or not it actually sent anything, so this message
      // deliberately promises nothing more than that the request was made.
      showSuccess(t("auth.verificationResent"));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setVerifyError(t("auth.unknownError"));
    } finally {
      setResending(false);
    }
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
          <View style={s.backButtonContainer}>
            <BackButton />
          </View>
          <View style={[s.surface, { backgroundColor: addOpacity(theme.colors.surface, 0.9) }]}>
            <Text style={[s.title, { color: theme.colors.onSurface }]}>{t("auth.verifyEmailTitle")}</Text>
            <Text testID="verify-email-intro" style={[s.intro, { color: theme.colors.onSurfaceVariant }]}>
              {email ? t("auth.verifyEmailIntro", { email }) : t("auth.verifyEmailIntroNoAddress")}
            </Text>

            <View style={s.fieldContainer}>
              <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    testID="verify-email-code"
                    error={!!errors.code}
                    dense
                    style={s.textInput}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    label={t("auth.verificationCode")}
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={6}
                    onSubmitEditing={handleSubmit(onSubmit)}
                    theme={{ colors: { primary: theme.colors.onSurface } }}
                  />
                )}
                name="code"
              />
              <View style={s.errorContainer}>
                {errors.code && (
                  <Text
                    testID="verify-email-code-error"
                    style={[
                      s.errorBadge,
                      { color: theme.colors.onErrorContainer, backgroundColor: theme.colors.errorContainer },
                    ]}
                  >
                    {errors.code?.message ? t(asTranslationKey(errors.code.message)) : ""}
                  </Text>
                )}
              </View>

              <View style={s.actionContainer}>
                <Button
                  testID="verify-email-submit"
                  mode="contained"
                  style={s.button}
                  onPress={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("auth.verifying") : t("auth.verify")}
                </Button>

                <Button
                  testID="verify-email-resend"
                  mode="text"
                  onPress={onResend}
                  disabled={cooldown > 0 || resending || !email}
                >
                  {cooldown > 0 ? t("auth.resendInSeconds", { seconds: cooldown }) : t("auth.resendVerification")}
                </Button>

                {verifyError && <Text style={[s.errorText, { color: theme.colors.error }]}>{verifyError}</Text>}

                <Link replace href="./login">
                  <Text style={[s.linkText, { color: theme.colors.tertiary }]}>{t("auth.backToLogin")}</Text>
                </Link>
              </View>
            </View>
          </View>
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
    // flexGrow (not flex: 1) for the same reason as the register screen: the basis stays
    // "auto", so a surface taller than the viewport actually scrolls instead of clipping.
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  backButtonContainer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  surface: {
    gap: 10,
    padding: 22,
    borderRadius: SURFACE_BORDER_RADIUS,
    alignItems: "center",
    width: WIDTH * 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  intro: {
    width: WIDTH * 0.65,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  fieldContainer: {
    width: WIDTH * 0.65,
  },
  textInput: {
    width: WIDTH * 0.65,
  },
  actionContainer: {
    paddingTop: 12,
    gap: 8,
    alignItems: "center",
  },
  button: {
    width: WIDTH * 0.5,
    borderRadius: BORDER_RADIUS,
  },
  linkText: {
    fontWeight: 600,
    fontSize: 15,
    paddingTop: 4,
  },
  errorContainer: {
    // Same reasoning as the register screen: minHeight keeps the spacing without reserving
    // a full row for a message that is usually absent.
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
