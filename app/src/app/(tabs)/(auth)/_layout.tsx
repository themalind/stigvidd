import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme } from "react-native-paper";

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();
  const theme = useTheme();

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/(profile-stack)/profile-page" />;
  }

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
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
