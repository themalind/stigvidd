import { Stack } from "expo-router";

export default function TrailsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="trail/[identifier]" />
    </Stack>
  );
}
