import { authStateAtom } from "@/atoms/auth-atoms";
import { Stack } from "expo-router";
import { useAtom } from "jotai";
import { useTheme } from "react-native-paper";

export default function SettingsLayout() {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="about" />
      <Stack.Protected guard={!authState.isAuthenticated}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Screen name="guide" />
    </Stack>
  );
}
