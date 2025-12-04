import { Stack } from "expo-router";

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="trail/[identifier]" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
