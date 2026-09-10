// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// babel-jest hoists jest.mock above the import. The getter reads mockIsDevice when a test runs,
// not while the factory is evaluated, so the variable is safe to use there.
let mockIsDevice = true;

jest.mock("expo-device", () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  AndroidImportance: { MAX: 5 },
}));

jest.mock("@/api/notifications", () => ({
  registerPushToken: jest.fn().mockResolvedValue(undefined),
  unregisterPushToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import * as Notifications from "expo-notifications";
import { registerPushToken, unregisterPushToken } from "@/api/notifications";
import { logger } from "@/services/logger";
import { Platform } from "react-native";
import {
  NOTIFICATION_QUERY_KEYS,
  NOTIFICATION_ROUTES,
  registerForPushNotificationsAsync,
  unregisterForPushNotificationsAsync,
} from "../notifications";

const mockGetPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockRegisterPushToken = registerPushToken as jest.Mock;
const mockUnregisterPushToken = unregisterPushToken as jest.Mock;
const mockSetChannel = Notifications.setNotificationChannelAsync as jest.Mock;
const mockAddPushTokenListener = Notifications.addPushTokenListener as jest.Mock;

// setNotificationHandler runs at import time, and beforeEach clears the record of that call.
const foregroundHandler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];

const realPlatformOs = Platform.OS;

function setPlatform(os: "ios" | "android") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

afterEach(() => {
  setPlatform(realPlatformOs as "ios" | "android");
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDevice = true;
});

// ── Routing maps ──────────────────────────────────────────────────────────────

describe("NOTIFICATION_QUERY_KEYS", () => {
  it("has an entry for friend_request", () => {
    expect(NOTIFICATION_QUERY_KEYS["friend_request"]).toBeDefined();
  });

  it("has an entry for friend_request_accepted", () => {
    expect(NOTIFICATION_QUERY_KEYS["friend_request_accepted"]).toBeDefined();
  });

  it("has an entry for hike_share", () => {
    expect(NOTIFICATION_QUERY_KEYS["hike_share"]).toBeDefined();
  });

  it("maps friend_request to the incoming friends query key", () => {
    expect(NOTIFICATION_QUERY_KEYS["friend_request"]).toEqual(["friends", "incoming"]);
  });

  it("maps hike_share to the incoming shared-hikes query key", () => {
    expect(NOTIFICATION_QUERY_KEYS["hike_share"]).toEqual(["shared-hikes"]);
  });
});

describe("NOTIFICATION_ROUTES", () => {
  it("has a route for friend_request", () => {
    expect(NOTIFICATION_ROUTES["friend_request"]).toBeDefined();
  });

  it("has a route for friend_request_accepted", () => {
    expect(NOTIFICATION_ROUTES["friend_request_accepted"]).toBeDefined();
  });

  it("has a route for hike_share", () => {
    expect(NOTIFICATION_ROUTES["hike_share"]).toBeDefined();
  });

  it("routes hike_share to the shared-hikes screen", () => {
    expect(NOTIFICATION_ROUTES["hike_share"]).toContain("shared-hikes");
  });

  it("routes friend_request to the friends screen", () => {
    expect(NOTIFICATION_ROUTES["friend_request"]).toContain("friends");
  });
});

// ── registerForPushNotificationsAsync ────────────────────────────────────────

describe("registerForPushNotificationsAsync", () => {
  it("returns early without requesting permissions when not on a physical device", async () => {
    mockIsDevice = false;
    await registerForPushNotificationsAsync();
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it("does not register a token when permission is already denied", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "denied" });
    mockRequestPermissionsAsync.mockResolvedValue({ status: "denied" });

    await registerForPushNotificationsAsync();

    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it("does not prompt again if permission was previously granted", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[test]" });

    await registerForPushNotificationsAsync();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permission when status is undetermined", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[test]" });

    await registerForPushNotificationsAsync();

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("registers the expo token with the backend when permission is granted", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[abc]" });

    await registerForPushNotificationsAsync();

    expect(mockRegisterPushToken).toHaveBeenCalledWith("ExponentPushToken[abc]", expect.any(String));
  });
});

describe("the Android notification channel", () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[abc]" });
  });

  // Android shows nothing at all without a channel, and it has to exist before the
  // permission is asked for.
  it("is created before permission is requested", async () => {
    setPlatform("android");
    const order: string[] = [];
    mockSetChannel.mockImplementation(async () => order.push("channel"));
    mockGetPermissionsAsync.mockImplementation(async () => {
      order.push("permission");
      return { status: "granted" };
    });

    await registerForPushNotificationsAsync();

    expect(order).toEqual(["channel", "permission"]);
  });

  it("is created at the importance that lets a banner through", async () => {
    setPlatform("android");
    await registerForPushNotificationsAsync();

    expect(mockSetChannel).toHaveBeenCalledWith("default", expect.objectContaining({ importance: 5 }));
  });

  it("is not created on iOS, which has no channels", async () => {
    setPlatform("ios");
    await registerForPushNotificationsAsync();

    expect(mockSetChannel).not.toHaveBeenCalled();
  });

  // A simulator has no APNs/FCM identity, but the channel call itself is harmless and comes
  // before that guard.
  it("is created even on an emulator", async () => {
    setPlatform("android");
    mockIsDevice = false;
    await registerForPushNotificationsAsync();

    expect(mockSetChannel).toHaveBeenCalled();
  });
});

describe("fetching the Expo token", () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
  });

  it("asks for it against the EAS project", async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[abc]" });
    await registerForPushNotificationsAsync();

    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: expect.any(String) });
  });

  // Fetching hits exp.host; a patchy network on launch must not surface as a crash, and the
  // next launch retries it anyway.
  it("gives up quietly when Expo cannot be reached", async () => {
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error("network down"));

    await expect(registerForPushNotificationsAsync()).resolves.toBeUndefined();
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("Could not fetch Expo push token", expect.any(Object));
  });

  it("sends the platform along with the token", async () => {
    setPlatform("android");
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[abc]" });
    await registerForPushNotificationsAsync();

    expect(mockRegisterPushToken).toHaveBeenCalledWith("ExponentPushToken[abc]", "android");
  });
});

describe("a rotated token", () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[abc]" });
  });

  it("is sent to the backend when Expo issues a new one", async () => {
    await registerForPushNotificationsAsync();
    const onRotate = mockAddPushTokenListener.mock.calls[0][0];

    await onRotate({ data: "ExponentPushToken[xyz]" });

    expect(mockRegisterPushToken).toHaveBeenLastCalledWith("ExponentPushToken[xyz]", expect.any(String));
  });

  // Registering twice across a login/logout cycle would otherwise stack listeners and send
  // the same rotation several times.
  it("is listened for exactly once across repeated registrations", async () => {
    const removePrevious = jest.fn();
    mockAddPushTokenListener.mockReturnValueOnce({ remove: removePrevious });

    await registerForPushNotificationsAsync();
    await registerForPushNotificationsAsync();

    expect(removePrevious).toHaveBeenCalledTimes(1);
    expect(mockAddPushTokenListener).toHaveBeenCalledTimes(2);
  });
});

// The token is remembered in module scope, so each test here registers before it signs out.
describe("logging out", () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[abc]" });
  });

  it("tells the backend to stop sending to this device", async () => {
    await registerForPushNotificationsAsync();
    await unregisterForPushNotificationsAsync();

    expect(mockUnregisterPushToken).toHaveBeenCalledWith("ExponentPushToken[abc]");
  });

  it("stops listening for rotations", async () => {
    const remove = jest.fn();
    mockAddPushTokenListener.mockReturnValueOnce({ remove });

    await registerForPushNotificationsAsync();
    await unregisterForPushNotificationsAsync();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  // Signing out twice, or before ever registering, must not send a request with no token.
  it("says nothing to the backend a second time", async () => {
    await registerForPushNotificationsAsync();
    await unregisterForPushNotificationsAsync();
    mockUnregisterPushToken.mockClear();

    await unregisterForPushNotificationsAsync();

    expect(mockUnregisterPushToken).not.toHaveBeenCalled();
  });
});

describe("a notification arriving while the app is open", () => {
  it("is shown as a banner, silently and without a badge", async () => {
    await expect(foregroundHandler.handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });
});
