// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { retryUnlessAuthFailure, withUnauthorizedRetry } from "@/api/unauthorized";
import { handleUnauthorized, SessionUnavailableError } from "@/services/keycloak-auth";

jest.mock("@/services/keycloak-auth", () => ({
  ...jest.requireActual("@/services/keycloak-auth"),
  handleUnauthorized: jest.fn(),
}));

const mockHandleUnauthorized = handleUnauthorized as jest.MockedFunction<typeof handleUnauthorized>;

beforeEach(() => {
  mockHandleUnauthorized.mockReset();
});

describe("withUnauthorizedRetry", () => {
  it("retries once with the refreshed token after a 401", async () => {
    mockHandleUnauthorized.mockResolvedValue("refreshed");
    const request = jest.fn().mockRejectedValueOnce(new ApiError("expired", 401)).mockResolvedValue("saved");

    await expect(withUnauthorizedRetry(request)).resolves.toBe("saved");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each(["unavailable", "expired", "rejected"] as const)(
    "gives up with the 401 when the refresh is %s",
    async (outcome) => {
      mockHandleUnauthorized.mockResolvedValue(outcome);
      const request = jest.fn().mockRejectedValue(new ApiError("expired", 401));

      await expect(withUnauthorizedRetry(request)).rejects.toMatchObject({ status: 401 });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it("passes other failures straight through without refreshing", async () => {
    const request = jest.fn().mockRejectedValue(new ApiError("server error", 500));

    await expect(withUnauthorizedRetry(request)).rejects.toMatchObject({ status: 500 });
    expect(mockHandleUnauthorized).not.toHaveBeenCalled();
  });
});

describe("retryUnlessAuthFailure", () => {
  it("does not retry a 401", () => {
    expect(retryUnlessAuthFailure(0, new ApiError("expired", 401))).toBe(false);
  });

  it("does not retry while Keycloak is unreachable", () => {
    expect(retryUnlessAuthFailure(0, new SessionUnavailableError())).toBe(false);
  });

  it("retries other failures up to three times", () => {
    const error = new ApiError("server error", 500);
    expect(retryUnlessAuthFailure(2, error)).toBe(true);
    expect(retryUnlessAuthFailure(3, error)).toBe(false);
  });
});
