import { signInUser } from "@/api/auth";
import { getLoginErrorMessage } from "@/api/firebase-errors";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import PasswordInputField from "@/components/password-input-field";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useAtom } from "jotai";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { Appearance, Dimensions, ImageBackground, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Button, Surface, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const HEIGHT = Dimensions.get("screen").height;
const WIDTH = Dimensions.get("screen").width;

const addOpacity = (rgbColor: string, opacity: number): string => {
  return rgbColor.replace("rgb", "rgba").replace(")", `, ${opacity})`);
};

const loginFields = z.object({
  email: z.string({ required_error: "Du måste ange en e-post" }).email("Ange en giltig e-post"),
  password: z.string({ required_error: "Ange ett lösenord" }).min(8, "Lösenordet måste vara minst 8 tecken"),
});

type FormFields = z.infer<typeof loginFields>;

export default function LoginScreen() {
  const theme = useTheme();
  const [firebaseError, setFirebaseError] = useState("");
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = Appearance.getColorScheme();
  const finalTheme = userTheme === "auto" ? (colorScheme ?? "light") : userTheme;
  const background =
    finalTheme === "dark"
      ? require("../../../assets/images/aurora_borealis2.jpg")
      : require("../../../assets/images/login-background-2.jpg");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({ resolver: zodResolver(loginFields) });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    setFirebaseError("");

    const result = await signInUser(data);

    if (!result.success || !result.user) {
      const errorCode = result.error?.code || "unknown";
      setFirebaseError(getLoginErrorMessage(errorCode));
      return;
    }

    console.log("Inloggad", result.user.email);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={{ backgroundColor: "rgb(0,0,0)" }} edges={["top"]}>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        scrollEnabled={false}
        contentContainerStyle={s.scrollContent}
      >
        <ImageBackground resizeMode="cover" source={background} style={s.backgroundImage}>
          <Surface
            elevation={5}
            style={[
              s.surface,
              {
                backgroundColor: addOpacity(theme.colors.surface, 0.9),
              },
            ]}
          >
            <View style={s.logoContainer}>
              <Text style={[s.title, { color: theme.colors.onSurface }]}>Stigvidd</Text>
              <Image source={require("../../../assets/images/mammaapp.png")} style={s.logo} contentFit="contain" />
            </View>
            <View style={s.textInputContainer}>
              <Text style={[s.text, { color: theme.colors.onSurface }]}>Logga in</Text>
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
                    {errors.email.message}
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
                    {errors.password.message}
                  </Text>
                )}
              </View>
            </View>
            <View style={s.actionContainer}>
              <Button mode="contained" style={s.button} onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
                {isSubmitting ? "Loggar in..." : "Logga in"}
              </Button>
              {firebaseError && <Text style={[s.errorText, { color: theme.colors.error }]}>{firebaseError}</Text>}
              <Link style={[s.linkText, { color: theme.colors.onSurface }]} replace href="./register">
                <Text>Inte medlem? </Text>
                <Text
                  style={{
                    color: theme.colors.tertiary,
                  }}
                >
                  Skapa konto här.
                </Text>
              </Link>
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
    justifyContent: "flex-start",
    alignItems: "center",
    flex: 1,
    paddingTop: HEIGHT * 0.15,
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
  },
  textInput: {
    flex: 1,
    width: WIDTH * 0.65,
  },
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  surface: {
    gap: 15,
    padding: 30,
    borderRadius: 10,
    alignItems: "center",
    width: WIDTH * 0.8,
  },
  linkText: {
    fontWeight: 600,
    fontSize: 15,
  },
  text: {
    fontWeight: 400,
    paddingBottom: 15,
    paddingTop: 15,
    fontSize: 25,
    alignSelf: "center",
  },
  actionContainer: {
    gap: 15,
    alignItems: "center",
  },
  button: {
    width: WIDTH * 0.5,
  },
  errorContainer: {
    height: 30,
  },
  errorText: {
    fontSize: 15,
    fontWeight: 600,
  },
});
