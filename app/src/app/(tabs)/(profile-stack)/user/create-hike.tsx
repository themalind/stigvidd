import { authStateAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import BackButton from "@/components/back-button";
import LoadingIndicator from "@/components/loading-indicator";
import TrailCreator from "@/components/trail/trail-creator/trail-creator";
import * as Location from "expo-location";
import { Redirect, useFocusEffect } from "expo-router";
import { useAtom } from "jotai";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function CreateHikeScreen() {
  const [{ isLoading, isError, error }] = useAtom(stigviddUserAtom);
  const [authState] = useAtom(authStateAtom);
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ granted }) => {
      setLocationGranted(granted);
    });
  }, []);

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading || locationGranted === null) {
    return <LoadingIndicator />;
  }

  if (!locationGranted) {
    return (
      <Text style={{ color: theme.colors.error }}>Du behöver dela din plats för att kunna skapa en egen promenad.</Text>
    );
  }

  if (isError && error) {
    return <Text style={{ color: theme.colors.error }}>{error.message}</Text>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <BackButton />
      <ScrollView ref={scrollViewRef} contentContainerStyle={s.container}>
        <TrailCreator />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
});
