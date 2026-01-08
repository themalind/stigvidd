import { authStateAtom } from "@/providers/auth-atoms";
import { Stack } from "expo-router";
import { useAtom } from "jotai";

export default function AuthLayout() {
  const [authState] = useAtom(authStateAtom);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={authState.isAuthenticated === false}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}
