// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SharedHike } from "@/data/types";
import { latestShareBySender, sharesFrom } from "../shares-by-sender";

function hike(name: string, sharedByIdentifier: string | null, sharedAt: string): SharedHike {
  return {
    hikeIdentifier: `hike-${name}`,
    hikeName: name,
    hikeLength: 1,
    duration: 1,
    coordinates: "",
    createdByName: null,
    sharedByName: null,
    sharedByIdentifier,
    sharedAt,
    allowResharing: false,
    images: [],
  };
}

const hikes = [
  hike("old", "anna", "2026-08-01T10:00:00Z"),
  hike("new", "anna", "2026-09-01T10:00:00Z"),
  hike("middle", "anna", "2026-08-15T10:00:00Z"),
  hike("bo", "bo", "2026-07-01T10:00:00Z"),
  hike("deleted sender", null, "2026-10-01T10:00:00Z"),
];

describe("latestShareBySender", () => {
  it("keeps each sender's newest hike, whatever the order", () => {
    const latest = latestShareBySender(hikes);

    expect(latest.get("anna")?.hikeName).toBe("new");
    expect(latest.get("bo")?.hikeName).toBe("bo");
  });

  it("leaves out hikes from a deleted account", () => {
    expect(latestShareBySender(hikes).size).toBe(2);
  });
});

describe("sharesFrom", () => {
  it("gives one sender's hikes, newest first", () => {
    expect(sharesFrom(hikes, "anna").map((h) => h.hikeName)).toEqual(["new", "middle", "old"]);
  });

  it("does not reorder the list it was given", () => {
    sharesFrom(hikes, "anna");
    expect(hikes[0].hikeName).toBe("old");
  });
});
