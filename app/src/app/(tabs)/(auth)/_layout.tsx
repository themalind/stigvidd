import { authStateAtom } from "@/atoms/auth-atoms";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAtom } from "jotai";
import { useTheme } from "react-native-paper";

export default function AuthLayout() {
  const [authState] = useAtom(authStateAtom);
  const theme = useTheme();

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
        <Stack.Protected guard={!authState.isAuthenticated}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
