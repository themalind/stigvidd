import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

export default function SettingsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="about" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
