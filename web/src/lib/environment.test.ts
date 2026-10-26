// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { isStagingRealm } from "./environment";

describe("isStagingRealm", () => {
  it("reads the production realm as not staging", () => {
    expect(isStagingRealm("stigvidd")).toBe(false);
  });

  it("reads the staging realm as staging", () => {
    expect(isStagingRealm("stigvidd-staging")).toBe(true);
  });

  it("reads an unrecognized realm as staging rather than as production", () => {
    expect(isStagingRealm("something-else")).toBe(true);
  });
});
