// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ActiveHike, Segment } from "@/data/types";
import { recordingRequestKey } from "@/utils/recording-request-key";

function segment(pointCount: number, startTime: number): Segment {
  const coordinates = Array.from({ length: pointCount }, (_, i) => ({
    data: { latitude: 57.72, longitude: 12.94 },
    timeStamp: startTime + i * 1000,
  }));
  return { coordinates, distance: 0, startTime };
}

function recording(...segments: Segment[]): ActiveHike {
  return { segments, totalDistance: 0, totalTime: 0 };
}

it("is a uuid the API can bind", () => {
  expect(recordingRequestKey(recording(segment(3, 1000)))).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

it("is the same for a recording restored after the app was closed", () => {
  expect(recordingRequestKey(recording(segment(3, 1000)))).toBe(recordingRequestKey(recording(segment(3, 1000))));
});

it("changes when the walk continues, so the longer walk is not taken for a retry", () => {
  const first = segment(3, 1000);

  expect(recordingRequestKey(recording(first, segment(2, 9000)))).not.toBe(recordingRequestKey(recording(first)));
});

it("differs between two walks", () => {
  expect(recordingRequestKey(recording(segment(3, 1000)))).not.toBe(recordingRequestKey(recording(segment(3, 2000))));
});
