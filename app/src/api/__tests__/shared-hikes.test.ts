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
import {
  getIncomingSharedHikes,
  getIncomingSharedHike,
  acceptSharedHike,
  rejectSharedHike,
} from "../shared-hikes";

const mockGetUserToken = getUserToken as jest.Mock;

function mockFetch(ok: boolean, body: unknown = []) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserToken.mockResolvedValue("bearer-token");
});

describe("getIncomingSharedHikes", () => {
  it("makes GET to /hikesharerecipient/incoming", async () => {
    mockFetch(true, []);
    await getIncomingSharedHikes();
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/hikesharerecipient/incoming",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("includes the Authorization header", async () => {
    mockFetch(true, []);
    await getIncomingSharedHikes();
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer bearer-token" }) }),
    );
  });

  it("returns the parsed response array", async () => {
    const data = [{ hikeIdentifier: "id-1", hikeName: "Test", hikeLength: 5, duration: 3600 }];
    mockFetch(true, data);
    const result = await getIncomingSharedHikes();
    expect(result).toEqual(data);
  });

  it("throws when the response is not ok", async () => {
    mockFetch(false);
    await expect(getIncomingSharedHikes()).rejects.toThrow();
  });

  it("throws when there is no auth token", async () => {
    mockGetUserToken.mockResolvedValue(null);
    await expect(getIncomingSharedHikes()).rejects.toThrow("User not authenticated");
  });
});

describe("getIncomingSharedHike", () => {
  it("makes GET to /hikesharerecipient/incoming/{hikeIdentifier}", async () => {
    mockFetch(true, {});
    await getIncomingSharedHike("hike-abc");
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/hikesharerecipient/incoming/hike-abc",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws when the response is not ok", async () => {
    mockFetch(false);
    await expect(getIncomingSharedHike("hike-abc")).rejects.toThrow();
  });
});

describe("acceptSharedHike", () => {
  it("makes PUT to /hikesharerecipient/accept/{hikeIdentifier}", async () => {
    mockFetch(true, {});
    await acceptSharedHike("hike-abc");
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/hikesharerecipient/accept/hike-abc",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("returns success: true when the response is ok", async () => {
    mockFetch(true, {});
    const result = await acceptSharedHike("hike-abc");
    expect(result).toEqual({ success: true });
  });

  it("throws when the response is not ok", async () => {
    mockFetch(false);
    await expect(acceptSharedHike("hike-abc")).rejects.toThrow();
  });

  it("throws when there is no auth token", async () => {
    mockGetUserToken.mockResolvedValue(null);
    await expect(acceptSharedHike("hike-abc")).rejects.toThrow("User not authenticated");
  });
});

describe("rejectSharedHike", () => {
  it("makes DELETE to /hikesharerecipient/reject/{hikeIdentifier}", async () => {
    mockFetch(true, {});
    await rejectSharedHike("hike-abc");
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/hikesharerecipient/reject/hike-abc",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("returns success: true when the response is ok", async () => {
    mockFetch(true, {});
    const result = await rejectSharedHike("hike-abc");
    expect(result).toEqual({ success: true });
  });

  it("throws when the response is not ok", async () => {
    mockFetch(false);
    await expect(rejectSharedHike("hike-abc")).rejects.toThrow();
  });

  it("throws when there is no auth token", async () => {
    mockGetUserToken.mockResolvedValue(null);
    await expect(rejectSharedHike("hike-abc")).rejects.toThrow("User not authenticated");
  });
});
