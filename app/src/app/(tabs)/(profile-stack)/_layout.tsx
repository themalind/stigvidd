import { authStateAtom } from "@/atoms/auth-atoms";
import { Stack } from "expo-router";
import { useAtom } from "jotai";

export default function ProfileStackLayout() {
  const [authState] = useAtom(authStateAtom);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="profile-page" />
      <Stack.Screen name="about" />
      <Stack.Screen name="trail/[identifier]" />
      <Stack.Protected guard={authState.isAuthenticated}>
        <Stack.Screen name="user/favorites" />
        <Stack.Screen name="user/wishlist" />
      </Stack.Protected>
    </Stack>
  );
}
