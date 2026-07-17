jest.mock("@/api/api-config", () => ({ BASE_URL: "http://test/api/v1" }));

jest.mock("../users", () => ({
  getUserToken: jest.fn(),
}));

jest.mock("react-native-uuid", () => ({
  __esModule: true,
  default: { v4: () => "test-uuid" },
}));

// addTrail builds a FormData; provide a minimal stub so the test runs under Node.
class FormDataStub {
  append() {}
}
(global as unknown as { FormData: unknown }).FormData = FormDataStub;

import { getUserToken } from "../users";
import { addTrail } from "../trails";
import { CreateTrailRequest } from "@/data/types";

const mockGetUserToken = getUserToken as jest.Mock;

function mockFetch(ok: boolean, status = ok ? 200 : 500) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    body: null,
  } as unknown as Response);
}

const baseRequest = {
  name: "Testled",
  trailLength: 5,
  classification: 1,
  accessibility: false,
  accessibilityInfo: "",
  trailSymbol: "circle",
  trailSymbolImage: "file:///symbol.jpg",
  description: "kort",
  fullDescription: "lång",
  coordinates: "59.3,18.0",
  tags: "",
  isVerified: false,
  city: "Borås",
} as unknown as CreateTrailRequest;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserToken.mockResolvedValue("bearer-token");
});

describe("addTrail", () => {
  it("makes POST to /trails/create", async () => {
    mockFetch(true);
    await addTrail(baseRequest);
    expect(fetch).toHaveBeenCalledWith("http://test/api/v1/trails/create", expect.objectContaining({ method: "POST" }));
  });

  it("returns success: true when the response is ok", async () => {
    mockFetch(true);
    const result = await addTrail(baseRequest);
    expect(result).toEqual({ success: true });
  });

  it("throws when the response is not ok", async () => {
    mockFetch(false, 400);
    await expect(addTrail(baseRequest)).rejects.toThrow();
  });

  it("throws when there is no auth token", async () => {
    mockGetUserToken.mockResolvedValue(null);
    await expect(addTrail(baseRequest)).rejects.toThrow("User not authenticated");
  });
});
