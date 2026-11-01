// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { EventPost } from "@/data/types";
import { firstUnreadPostId } from "@/hooks/events/useEventBoard";

function post(identifier: string, createdAt: string, isMine = false): EventPost {
  return {
    identifier,
    authorIdentifier: "u1",
    authorNickName: "Artemis",
    body: "Hej",
    isPinned: false,
    createdAt,
    isMine,
    canEdit: false,
    canDelete: false,
  };
}

const posts = [
  post("p3", "2026-11-01T10:00:00Z"),
  post("p2", "2026-11-01T09:00:00Z", true),
  post("p1", "2026-11-01T08:00:00Z"),
];

describe("firstUnreadPostId", () => {
  it("is the first post after the read marker", () => {
    expect(firstUnreadPostId(posts, "2026-11-01T08:00:00Z")).toBe("p3");
  });

  it("skips the user's own posts", () => {
    expect(firstUnreadPostId([posts[1]], "2026-11-01T07:00:00Z")).toBeUndefined();
  });

  it("is the first post when nothing has been read", () => {
    expect(firstUnreadPostId(posts, null)).toBe("p1");
  });

  it("is nothing when everything is read", () => {
    expect(firstUnreadPostId(posts, "2026-11-01T10:00:00Z")).toBeUndefined();
  });
});
