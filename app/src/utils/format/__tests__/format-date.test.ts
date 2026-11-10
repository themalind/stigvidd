// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { formatDate } from "../format-date";

describe("formatDate", () => {
  it("extracts the date part from an ISO 8601 string", () => {
    expect(formatDate("2024-03-25T12:30:00")).toBe("2024-03-25");
  });

  it("works with time zone offset", () => {
    expect(formatDate("2024-03-25T12:30:00+02:00")).toBe("2024-03-25");
  });

  it("returns the full string when there is no T separator", () => {
    expect(formatDate("2024-03-25")).toBe("2024-03-25");
  });

  it("handles midnight (00:00:00)", () => {
    expect(formatDate("2024-01-01T00:00:00")).toBe("2024-01-01");
  });
});
