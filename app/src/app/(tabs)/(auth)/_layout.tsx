import { authStateAtom } from "@/atoms/auth-atoms";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { useTheme } from "react-native-paper";

export default function AuthLayout() {
  const [authState] = useAtom(authStateAtom);
  const theme = useTheme();

  useEffect(() => {
    if (authState.isAuthenticated) {
      router.replace("/(tabs)/(profile-stack)/profile-page");
    }
  }, [authState.isAuthenticated]);

  return (
    <>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "none",
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </>
  );
}
