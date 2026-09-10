// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { hasReviewedTrailKey, useHasReviewedTrail } from "@/hooks/review/useHasReviewedTrail";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";

const mockHasReviewedTrail = jest.fn();

jest.mock("@/api/reviews", () => ({
  hasReviewedTrail: (...args: unknown[]) => mockHasReviewedTrail(...args),
}));

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

let mockUser: { identifier: string } | undefined;
jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom(() => ({ data: mockUser })) };
});

const TRAIL = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";

type Result = ReturnType<typeof useHasReviewedTrail>;

function render() {
  let hook!: Result;
  function Probe() {
    hook = useHasReviewedTrail(TRAIL);
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  return {
    ...rendered,
    settled: () => flushUntil(() => hook.isSuccess || hook.isError),
    // A function, not a getter: Babel's object-spread transform snapshots a getter declared
    // in the same literal as a spread, freezing it on the first render.
    hook: () => hook,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockUser = { identifier: "me" };
  mockHasReviewedTrail.mockResolvedValue(true);
});

describe("hasReviewedTrailKey", () => {
  // Two users on one device must not share the answer.
  it("keys the answer by trail and user", () => {
    expect(hasReviewedTrailKey(TRAIL, "me")).toEqual(["review-exists", TRAIL, "me"]);
  });

  it("is a prefix match for the key the review mutations invalidate", () => {
    expect(hasReviewedTrailKey(TRAIL, "me").slice(0, 2)).toEqual(["review-exists", TRAIL]);
  });
});

describe("useHasReviewedTrail", () => {
  it("asks about the trail it was given", async () => {
    const harness = render();
    await harness.settled();

    expect(mockHasReviewedTrail).toHaveBeenCalledWith(TRAIL);
  });

  it("returns the server's answer", async () => {
    const harness = render();
    await harness.settled();

    expect(harness.hook().data).toBe(true);
  });

  it("returns false when the user has not reviewed the trail", async () => {
    mockHasReviewedTrail.mockResolvedValue(false);
    const harness = render();
    await harness.settled();

    expect(harness.hook().data).toBe(false);
  });

  it("asks nothing while signed out", async () => {
    mockIsAuthenticated = false;
    const harness = render();
    await harness.settled();

    expect(mockHasReviewedTrail).not.toHaveBeenCalled();
    expect(harness.hook().data).toBeUndefined();
  });

  // The key needs the identifier, so asking before it arrives would cache under the wrong key.
  it("asks nothing before the user is known", async () => {
    mockUser = undefined;
    const harness = render();
    await harness.settled();

    expect(mockHasReviewedTrail).not.toHaveBeenCalled();
  });
});
