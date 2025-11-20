import { Stack } from "expo-router";

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Header och tabs syns från parent
      }}
    >
      {/* Gömmer från tabs */}
      <Stack.Screen name="trail/[id]" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
