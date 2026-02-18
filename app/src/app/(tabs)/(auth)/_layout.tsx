import { authStateAtom } from "@/atoms/auth-atoms";
import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAtom } from "jotai";
import { useTheme } from "react-native-paper";

export default function AuthLayout() {
  const [authState] = useAtom(authStateAtom);
  const theme = useTheme();

  if (authState.isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </>
  );
}
