import { Stack } from "expo-router";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme } from "react-native-paper";

export default function SettingsLayout() {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="about" />
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Screen name="guide" />
    </Stack>
  );
}
