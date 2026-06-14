import { registerPushToken } from "@/api/notifications";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Show banners while the app is open in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Maps data.type from the push payload → the React Query key to invalidate.
export const NOTIFICATION_QUERY_KEYS: Record<string, unknown[]> = {
  friend_request: ["friends", "incoming"],
  friend_request_accepted: ["friends"],
  hike_share: ["shared-hikes"],
};

// Maps data.type → the screen to navigate to when the user taps the notification.
export const NOTIFICATION_ROUTES: Record<string, string> = {
  friend_request: "/(tabs)/(profile-stack)/user/friends",
  friend_request_accepted: "/(tabs)/(profile-stack)/user/friends",
  hike_share: "/(tabs)/(profile-stack)/user/shared-hikes",
};

// Requests notification permissions, fetches an Expo push token, and sends it
// to the backend so the server can target this device. Safe to call on every
// app launch — it's a no-op on simulators and re-registers gracefully if the
// token has already been stored.
export async function registerForPushNotificationsAsync(): Promise<void> {
  // Android requires an explicit notification channel before any notification
  // can be displayed. The channel must be created before permission is requested.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Expo push tokens are only issued for physical devices; simulators/emulators
  // have no APNs/FCM identity and will throw if we proceed past this guard.
  if (!Device.isDevice) {
    console.log("registerForPushNotificationsAsync: skipped — not a physical device");
    return;
  }

  // Check the current permission status before prompting. iOS only shows the
  // system dialog once — if the user previously denied we cannot re-prompt.
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("registerForPushNotificationsAsync: permission denied");
    return;
  }

  // The project ID links the token to our EAS project so Expo can route
  // notifications through the correct APNs/FCM credentials.
  const projectId = "f436d9c7-ff9c-4a60-b51f-1aefd5672205";
  const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  // Persist the token in the backend so the server knows where to send pushes.
  await registerPushToken(expoToken, Platform.OS);

  // Re-register automatically if the token rotates (rare but possible).
  Notifications.addPushTokenListener(async ({ data: newToken }) => {
    await registerPushToken(newToken, Platform.OS);
  });
}
