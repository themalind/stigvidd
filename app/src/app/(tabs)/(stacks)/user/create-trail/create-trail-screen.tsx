import { authStateAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import LoadingIndicator from "@/components/loading-indicator";
import TrailCreator from "@/components/trail/trail-creator/trail-creator";
import { Redirect, useFocusEffect } from "expo-router";
import { useAtom } from "jotai";
import React, { useRef } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function CreateTrailScreen() {
  const [{ isLoading, isError, error }] = useAtom(stigviddUserAtom);
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [authState] = useAtom(authStateAtom);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError && error) {
    return <Text style={{ color: theme.colors.error }}>{error.message}</Text>;
  }

  return (
    <ScrollView ref={scrollViewRef} contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}>
      <TrailCreator />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    // borderColor: "#f00",
    // borderWidth: 1,
    flexGrow: 1,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
});
