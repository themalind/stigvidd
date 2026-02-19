import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { AppStateStatus } from "react-native";
import { focusManager } from "@tanstack/react-query";

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

export function useAppState() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);

    return () => subscription.remove();
  }, []);
}

/*
Hooken useAppState lyssnar på om appen går till förgrund eller bakgrund. 
När appen är aktiv talar den om för React Query att den ska fortsätta uppdatera data, 
och när appen är i bakgrund pausar den automatiska datuhämtningar. 
Detta sparar resurser och ser till att data uppdateras när användaren kommer tillbaka.
*/
