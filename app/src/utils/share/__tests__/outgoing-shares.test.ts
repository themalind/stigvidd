// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { OutgoingSharedHike, ShareRecipient } from "@/data/types";
import { recipientsOf, sharesTo } from "../outgoing-shares";

const to = (identifier: string, sharedAt: string): ShareRecipient => ({ identifier, nickName: identifier, sharedAt });

function hike(name: string, ...recipients: ShareRecipient[]): OutgoingSharedHike {
  return {
    hikeIdentifier: `hike-${name}`,
    hikeName: name,
    hikeLength: 5,
    duration: 3600000,
    coordinates: "[]",
    isOwnHike: true,
    lastSharedAt: recipients[0]?.sharedAt ?? "",
    recipients,
  };
}

const hikes = [
  hike("Rya åsar", to("anna", "2026-10-01T10:00:00Z"), to("bo", "2026-10-09T10:00:00Z")),
  hike("Kypesjön", to("anna", "2026-10-05T10:00:00Z")),
  hike("Öresjö", to("bo", "2026-10-07T10:00:00Z")),
];

describe("sharesTo", () => {
  it("lists what was sent to one person, newest first, dated by their share", () => {
    const shares = sharesTo(hikes, "anna");

    expect(shares.map((s) => s.hike.hikeName)).toEqual(["Kypesjön", "Rya åsar"]);
    expect(shares.map((s) => s.sharedAt)).toEqual(["2026-10-05T10:00:00Z", "2026-10-01T10:00:00Z"]);
  });

  it("is empty for someone nothing was sent to", () => {
    expect(sharesTo(hikes, "cissi")).toEqual([]);
  });
});

describe("recipientsOf", () => {
  it("returns the hike's recipients", () => {
    expect(recipientsOf(hikes, "hike-Rya åsar").map((r) => r.identifier)).toEqual(["anna", "bo"]);
  });

  it("is empty for a hike that was never shared", () => {
    expect(recipientsOf(hikes, "hike-unknown")).toEqual([]);
  });
});
