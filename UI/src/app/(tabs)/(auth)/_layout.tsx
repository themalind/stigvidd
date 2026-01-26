import { authStateAtom } from "@/atoms/auth-atoms";
import { Redirect, Stack } from "expo-router";
import { useAtom } from "jotai";

export default function AuthLayout() {
  const [authState] = useAtom(authStateAtom);

  if (authState.isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
