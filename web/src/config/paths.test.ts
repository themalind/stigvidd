// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, it } from "vitest";
import { paths } from "./paths";

it("gives the router its pattern and a link its address from one builder", () => {
  expect(paths.hikeSubmission(":identifier")).toBe("/hike-submissions/:identifier");
  expect(paths.trailImportSession(42)).toBe("/trail-import/42");
});

it("adds a search only when there is one", () => {
  expect(paths.trails()).toBe("/trails");
  expect(paths.trails({})).toBe("/trails");
  expect(paths.trails({ missing: "Images" })).toBe("/trails?missing=Images");
  expect(paths.mailOutbox({ status: "Failed" })).toBe("/mail-outbox?status=Failed");
});
