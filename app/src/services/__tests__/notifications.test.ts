// jest.mock calls are hoisted by babel-jest so they run before the module is imported.
// The mutable `mockIsDevice` variable is safe to use in the getter because the getter
// is only evaluated when tests run, not during factory execution.
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
}));

import * as Notifications from "expo-notifications";
import { registerPushToken } from "@/api/notifications";
import {
  NOTIFICATION_QUERY_KEYS,
  NOTIFICATION_ROUTES,
  registerForPushNotificationsAsync,
} from "../notifications";

const mockGetPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockRegisterPushToken = registerPushToken as jest.Mock;

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
