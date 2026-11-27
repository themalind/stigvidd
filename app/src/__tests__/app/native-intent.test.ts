// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { redirectSystemPath } from "@/app/+native-intent";
import { router } from "expo-router";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));

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

  it("sends a shared event link to the event in the events tab", () => {
    expect(redirect("https://link.stigvidd.se/event/ev-1?lang=en")).toBe("/events/event/ev-1");
    expect(redirect("stigvidd://event/ev-1")).toBe("/events/event/ev-1");
  });

  it("leaves the app's own events-tab paths alone", () => {
    expect(redirect("/events/event/ev-1")).toBe("/events/event/ev-1");
    expect(redirect("/events/trail/abc-123")).toBe("/events/trail/abc-123");
  });

  it("leaves every other link alone", () => {
    expect(redirect("stigvidd://hike/abc-123")).toBe("stigvidd://hike/abc-123");
    expect(redirect("https://link.stigvidd.se/other/trail/abc-123")).toBe(
      "https://link.stigvidd.se/other/trail/abc-123",
    );
  });

  it("opens a shared link itself in a running app, so the tab's list stays beneath", () => {
    const result = redirectSystemPath({ path: "https://link.stigvidd.se/trail/abc-123", initial: false });

    expect(result).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(TRAIL_ROUTE, expect.objectContaining({ withAnchor: true }));
  });

  it("leaves other links in a running app to the router", () => {
    (router.navigate as jest.Mock).mockClear();

    expect(redirectSystemPath({ path: "stigvidd://hike/abc-123", initial: false })).toBe("stigvidd://hike/abc-123");
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
