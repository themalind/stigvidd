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
import { createHike } from "../hikes";
import { CreateHikeRequest } from "@/data/types";

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
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/hikes",
      expect.objectContaining({ method: "POST" }),
    );
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
