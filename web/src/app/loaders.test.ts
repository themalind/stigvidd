// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs, Params, ShouldRevalidateFunctionArgs } from "react-router";
import { mailTemplateQueryOptions } from "@/features/mail/api/mail-templates";
import { createTestQueryClient } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock("@/lib/keycloak-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/keycloak-auth")>()),
  hasSession: () => auth.signedIn,
}));

import { detailLoaders, onlyWhenParamsChange } from "./loaders";

const args = (params: Params) => ({ params, request: new Request("http://admin.test/") }) as LoaderFunctionArgs;
const paths = () => api.mock.calls.map((call) => `${call.method} ${call.path}`);

let release: () => void = () => {};

beforeEach(() => {
  auth.signedIn = true;
  api.mock.reset();
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  for (const path of [
    "/api/v1/admin/hike-submissions/sub-1",
    "/api/v1/admin/hike-submissions/sub-1/similar-routes",
    "/api/v1/admin/mail-templates/welcome",
    "/api/v1/admin/trail-import/sessions/4",
    "/api/v1/admin/trails",
  ]) {
    api.mock.on("GET", path, () => held.then(() => ({ path })));
  }
});

describe("the detail loaders", () => {
  it("start a review's detail and its similar routes together, without waiting for either", () => {
    const result = detailLoaders(createTestQueryClient()).hikeSubmission(args({ identifier: "sub-1" }));

    expect(result).toBeNull();
    expect(paths()).toEqual([
      "GET /api/v1/admin/hike-submissions/sub-1",
      "GET /api/v1/admin/hike-submissions/sub-1/similar-routes",
    ]);
  });

  it("start an import session and the trail list it links against", () => {
    detailLoaders(createTestQueryClient()).trailImportSession(args({ sessionId: "4" }));

    expect(paths()).toEqual(["GET /api/v1/admin/trail-import/sessions/4", "GET /api/v1/admin/trails"]);
  });

  it("hand the page the request already in flight rather than a second one", async () => {
    const client = createTestQueryClient();
    detailLoaders(client).mailTemplate(args({ identifier: "welcome" }));

    const page = client.ensureQueryData(mailTemplateQueryOptions("welcome"));
    release();

    expect(await page).toEqual({ path: "/api/v1/admin/mail-templates/welcome" });
    expect(paths()).toEqual(["GET /api/v1/admin/mail-templates/welcome"]);
  });

  // keep-comment: on a cold start the session is still being restored, and a request would race that refresh grant
  it("ask for nothing before a session exists", () => {
    auth.signedIn = false;
    const loaders = detailLoaders(createTestQueryClient());

    loaders.hikeSubmission(args({ identifier: "sub-1" }));
    loaders.mailTemplate(args({ identifier: "welcome" }));
    loaders.trailImportSession(args({ sessionId: "4" }));

    expect(api.mock.calls).toHaveLength(0);
  });
});

describe("revalidation", () => {
  const change = (currentParams: Params, nextParams: Params) =>
    onlyWhenParamsChange({ currentParams, nextParams } as ShouldRevalidateFunctionArgs);

  it("is skipped when only the search params changed", () => {
    expect(change({ sessionId: "4" }, { sessionId: "4" })).toBe(false);
  });

  it("happens when the route moves to another record", () => {
    expect(change({ sessionId: "4" }, { sessionId: "5" })).toBe(true);
  });
});
