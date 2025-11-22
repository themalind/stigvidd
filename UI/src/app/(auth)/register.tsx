import { userThemeAtom } from "@/providers/user-theme-atom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useAtom } from "jotai";
import React from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import {
  Appearance,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Button, Surface, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const HEIGHT = Dimensions.get("screen").height;
const WIDTH = Dimensions.get("screen").width;

const registerFields = z
  .object({
    nickName: z
      .string({ required_error: "Nickname is required" })
      .min(1, "You need to enter a nickname!"),
    email: z
      .string({ required_error: "Email is required" })
      .email("You must enter an email!"),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must contain minimum of 8 characters!"),
    confirmPassword: z.string({
      required_error: "You must confirm your password!",
    }),
  })
  .superRefine(({ confirmPassword, password }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });
type FormFields = z.infer<typeof registerFields>;

const addOpacity = (rgbColor: string, opacity: number): string => {
  return rgbColor.replace("rgb", "rgba").replace(")", `, ${opacity})`);
};

export default function LoginScreen() {
  const theme = useTheme();
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = Appearance.getColorScheme();

  const finalTheme =
    userTheme === "auto" ? (colorScheme ?? "light") : userTheme;

  const background =
    finalTheme === "dark"
      ? require("../../assets/images/register-dark-background-2.jpg")
      : require("../../assets/images/register-background-2.jpg");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({ resolver: zodResolver(registerFields) });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    // Skapa och spara registrerad användare.
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0C290F" }}>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
        contentContainerStyle={s.scrollContent}
      >
        <ImageBackground
          resizeMode="cover"
          source={background}
          style={s.backgroundImage}
        >
          <Surface
            elevation={5}
            style={[
              s.surface,
              { backgroundColor: addOpacity(theme.colors.surface, 0.9) },
            ]}
          >
            <View style={s.logoContainer}>
              <Text style={[s.title, { color: theme.colors.onSurface }]}>
                Stigvidd
              </Text>
              <Image
                source={require("../../assets/images/mammaapp.png")}
                style={s.logo}
                contentFit="contain"
              />
            </View>
            <View style={s.textInputContainer}>
              <Text style={[s.text, { color: theme.colors.onSurface }]}>
                Skapa konto
              </Text>
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
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    error={!!errors.password}
                    style={s.textInput}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    label="Lösenord"
                    autoCapitalize="none"
                    secureTextEntry={true}
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
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    error={!!errors.confirmPassword}
                    style={s.textInput}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    label="Upprepa lösenord"
                    autoCapitalize="none"
                    secureTextEntry={true}
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
                <Button
                  mode="contained"
                  style={s.button}
                  onPress={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Skapar konto..." : "Skapa konto"}
                </Button>
                <Link
                  style={[s.linkText, { color: theme.colors.onSurface }]}
                  replace
                  href="./login"
                >
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
    minHeight: HEIGHT,
  },
  backgroundImage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: HEIGHT,
  },
  logoContainer: {
    flexDirection: "row",
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
});
