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

  it("wraps the result in an array when found", async () => {
    const user = { userIdentifier: "uid-1", nickName: "alice" };
    mockFetch(200, user);
    const result = await searchUsers("alice");
    expect(result).toEqual([user]);
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
