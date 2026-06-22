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
import { searchUsers } from "../friends";

const mockGetUserToken = getUserToken as jest.Mock;

function mockFetch(status: number, body: unknown = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserToken.mockResolvedValue("bearer-token");
});

describe("searchUsers", () => {
  it("returns empty array when status is 404", async () => {
    mockFetch(404);
    const result = await searchUsers("ghost");
    expect(result).toEqual([]);
  });

  it("returns the list of matching users", async () => {
    const matches = [
      { userIdentifier: "uid-1", nickName: "alice" },
      { userIdentifier: "uid-2", nickName: "alicia" },
    ];
    mockFetch(200, matches);
    const result = await searchUsers("ali");
    expect(result).toEqual(matches);
  });

  it("calls the search endpoint with the query URL-encoded", async () => {
    mockFetch(200, []);
    await searchUsers("a b&c");
    expect(fetch).toHaveBeenCalledWith(
      "http://test/api/v1/users/search?username=a%20b%26c",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws on other error statuses", async () => {
    mockFetch(500);
    await expect(searchUsers("alice")).rejects.toThrow();
  });

  it("throws when there is no auth token", async () => {
    mockGetUserToken.mockResolvedValue(null);
    await expect(searchUsers("alice")).rejects.toThrow("User not authenticated");
  });
});
