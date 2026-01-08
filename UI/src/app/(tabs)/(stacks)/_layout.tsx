import { authStateAtom } from "@/providers/auth-atoms";
import { Stack } from "expo-router";
import { useAtom } from "jotai";

export default function StackLayout() {
  const [authState] = useAtom(authStateAtom);
  console.log("StackLayout authState:", authState);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    >
      <Stack.Screen name="trail/[identifier]" />
      <Stack.Protected guard={authState.isAuthenticated === true}>
        <Stack.Screen name="user/favorites" />
        <Stack.Screen name="user/wishlist" />
      </Stack.Protected>
      <Stack.Screen name="about" />
    </Stack>
  );
}
