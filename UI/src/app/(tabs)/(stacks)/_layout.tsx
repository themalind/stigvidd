import { Stack } from "expo-router";

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    >
      <Stack.Screen name="trail/[identifier]" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="wishlist" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
