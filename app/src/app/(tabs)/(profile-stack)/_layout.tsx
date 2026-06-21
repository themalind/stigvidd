import { Stack } from "expo-router";
import { useAuth } from "@/components/auth/auth-provider";

export default function ProfileStackLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="profile-page" />
      <Stack.Screen name="about" />
      <Stack.Screen name="trail/[identifier]" />
      <Stack.Screen name="follow/[identifier]" />
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="user/favorites" />
        <Stack.Screen name="user/wishlist" />
        <Stack.Screen name="user/my-hikes" />
        <Stack.Screen name="user/create-hike" />
        <Stack.Screen name="user/shared-hikes" />
        <Stack.Screen name="user/friends" />
      </Stack.Protected>
    </Stack>
  );
}
