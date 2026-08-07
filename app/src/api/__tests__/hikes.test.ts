jest.mock("@/api/api-config", () => ({ BASE_URL: "http://test/api/v1" }));

jest.mock("@/api/users", () => ({
  getUserToken: jest.fn(),
  ApiError: class ApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

import { getUserToken } from "@/api/users";
import { createHike, getHikeByIdentifier, hikeRouteQueryKey } from "../hikes";
import { ApiError } from "../api-error";
import { CreateHikeRequest, Hike } from "@/data/types";

const mockGetUserToken = getUserToken as jest.Mock;

function mockFetch(ok: boolean, body: unknown = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue(body),
    body: null,
  } as unknown as Response);
}

const baseRequest: CreateHikeRequest = {
  name: "Testpromenad",
  hikeLength: 5,
  duration: 3600,
  coordinates: [
    { latitude: 59.3, longitude: 18.0 },
    { latitude: 59.4, longitude: 18.1 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserToken.mockResolvedValue("bearer-token");
});

describe("createHike", () => {
  it("serializes coordinates as a JSON string in the request body", async () => {
    mockFetch(true);
    await createHike(baseRequest);

    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(typeof body.coordinates).toBe("string");
    expect(JSON.parse(body.coordinates)).toEqual(baseRequest.coordinates);
  });

  it("makes POST to /hikes", async () => {
    mockFetch(true);
    await createHike(baseRequest);
    expect(fetch).toHaveBeenCalledWith("http://test/api/v1/hikes", expect.objectContaining({ method: "POST" }));
  });

  it("returns success: true when the response is ok", async () => {
    mockFetch(true);
    const result = await createHike(baseRequest);
    expect(result).toEqual({ success: true });
  });

  it("throws when the response is not ok", async () => {
    mockFetch(false);
    await expect(createHike(baseRequest)).rejects.toThrow();
  });

  it("throws when there is no auth token", async () => {
    mockGetUserToken.mockResolvedValue(null);
    await expect(createHike(baseRequest)).rejects.toThrow("User not authenticated");
  });
});

describe("getHikeByIdentifier", () => {
  // The route the follow screen walks. The same endpoint serves the creator and anyone
  // the hike was shared with, which is what makes a shared hike walkable.
  const hike: Hike = {
    identifier: "abc-123",
    name: "Testpromenad",
    hikeLength: 5,
    duration: 3600,
    coordinates: '[{"latitude":59.3,"longitude":18.0}]',
    createdBy: "user-1",
    createdAt: "2026-08-04T10:00:00Z",
  };

  it("makes a GET to /hikes/{identifier}", async () => {
    mockFetch(true, hike);
    await getHikeByIdentifier("abc-123");
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/hikes/abc-123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends the bearer token", async () => {
    mockFetch(true, hike);
    await getHikeByIdentifier("abc-123");
    const { headers } = (fetch as jest.Mock).mock.calls[0][1];
    expect(headers.Authorization).toBe("Bearer bearer-token");
  });

  it("returns the parsed hike, including its coordinates", async () => {
    mockFetch(true, hike);
    await expect(getHikeByIdentifier("abc-123")).resolves.toEqual(hike);
  });

  it("throws an ApiError carrying the status when the response is not ok", async () => {
    mockFetch(false);
    await expect(getHikeByIdentifier("abc-123")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
    });
    await expect(getHikeByIdentifier("abc-123")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws when there is no auth token", async () => {
    mockGetUserToken.mockResolvedValue(null);
    await expect(getHikeByIdentifier("abc-123")).rejects.toThrow("User not authenticated");
  });
});

describe("hikeRouteQueryKey", () => {
  it("scopes the cached route to a single hike", () => {
    expect(hikeRouteQueryKey("abc-123")).toEqual(["hike-route", "abc-123"]);
    expect(hikeRouteQueryKey("abc-123")).not.toEqual(hikeRouteQueryKey("def-456"));
  });
});
