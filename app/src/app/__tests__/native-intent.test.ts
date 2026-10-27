// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { redirectSystemPath } from "@/app/+native-intent";

const TRAIL_ROUTE = "/trails/trail/abc-123";

function redirect(path: string) {
  return redirectSystemPath({ path, initial: true });
}

describe("redirectSystemPath", () => {
  it("sends a shared https link to the trail in the trails tab", () => {
    expect(redirect("https://link.stigvidd.se/trail/abc-123")).toBe(TRAIL_ROUTE);
  });

  it("sends the custom-scheme link to the same place", () => {
    expect(redirect("stigvidd://trail/abc-123")).toBe(TRAIL_ROUTE);
  });

  it("accepts a bare path", () => {
    expect(redirect("/trail/abc-123")).toBe(TRAIL_ROUTE);
  });

  it("ignores a query string", () => {
    expect(redirect("https://link.stigvidd.se/trail/abc-123?utm=x")).toBe(TRAIL_ROUTE);
  });

  it("leaves every other link alone", () => {
    expect(redirect("stigvidd://hike/abc-123")).toBe("stigvidd://hike/abc-123");
    expect(redirect("https://link.stigvidd.se/other/trail/abc-123")).toBe(
      "https://link.stigvidd.se/other/trail/abc-123",
    );
  });
});
