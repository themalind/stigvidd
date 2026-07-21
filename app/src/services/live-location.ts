// JS wrapper for the local native module in `app/modules/expo-live-location/`
// (Swift, Apple-only). It lives here rather than inside the module folder so the
// module directory stays purely native: a stray .ts file there sits outside
// tsconfig's `include`, which makes the editor's TS server type it as a loose file
// with the DOM lib and produce phantom conflicts against React Native's types
// (FormData, AbortController, …). Expo autolinking only needs
// `expo-module.config.json` + `ios/`, and requireNativeModule matches on the name
// string, so nothing depends on this file's location.
import { NativeModule, requireNativeModule } from "expo";
import type { EventSubscription } from "expo-modules-core";
import { Platform } from "react-native";

// A raw GPS fix delivered by the native iOS 18+ background engine. Deliberately the
// minimal shape needed to run through the JS evaluatePoint filter — no app types
// leak into the native layer.
export type LiveFix = {
  latitude: number;
  longitude: number;
  // Horizontal accuracy in metres (negative when iOS can't determine it).
  accuracy: number;
  // Milliseconds since the Unix epoch.
  timestamp: number;
};

type LiveLocationModuleEvents = {
  onLocation(fix: LiveFix): void;
};

declare class ExpoLiveLocationNativeModule extends NativeModule<LiveLocationModuleEvents> {
  // True only on iOS 18+, where the background-capable Core Location API exists.
  isAvailable(): boolean;
  // Starts the background activity session + live-updates stream.
  start(): Promise<void>;
  // Stops the stream and releases the session.
  stop(): Promise<void>;
  // Returns every fix buffered since the last drain and clears the buffer.
  drain(): Promise<LiveFix[]>;
}

// The native module ships for Apple only. On Android/web `requireNativeModule`
// would throw, so guard on platform and fall back to null; callers treat a null
// module as "native background tracking unavailable" and use expo-location.
const nativeModule: ExpoLiveLocationNativeModule | null = (() => {
  if (Platform.OS !== "ios") return null;
  try {
    return requireNativeModule<ExpoLiveLocationNativeModule>("ExpoLiveLocation");
  } catch {
    return null;
  }
})();

// Whether to use the native iOS 18+ background engine. False on Android, on iOS < 18,
// and if the module failed to load for any reason.
export function isLiveLocationAvailable(): boolean {
  return nativeModule?.isAvailable() ?? false;
}

export function startLiveLocation(): Promise<void> {
  return nativeModule?.start() ?? Promise.resolve();
}

export function stopLiveLocation(): Promise<void> {
  return nativeModule?.stop() ?? Promise.resolve();
}

export function drainLiveLocation(): Promise<LiveFix[]> {
  return nativeModule?.drain() ?? Promise.resolve([]);
}

// Subscribes to live fixes for the foreground map tail. Returns null (no-op) when
// the native module isn't available.
export function addLiveLocationListener(listener: (fix: LiveFix) => void): EventSubscription | null {
  return nativeModule?.addListener("onLocation", listener) ?? null;
}
