// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/core/api-error";
import en from "@/i18n/locales/en.json";
import sv from "@/i18n/locales/sv.json";
import { readFileSync } from "fs";
import { join } from "path";
import { EVENT_ERROR_CODES, eventErrorKey } from "../event-errors";

describe("EVENT_ERROR_CODES", () => {
  it("lists exactly the backend's EventErrorCodes", () => {
    const source = readFileSync(
      join(__dirname, "../../../../../backend/Core/Services/Events/EventErrorCodes.cs"),
      "utf8",
    );
    const backend = [...source.matchAll(/public const string \w+ = "([^"]+)";/g)].map((match) => match[1]);

    expect(backend.length).toBeGreaterThan(0);
    expect([...EVENT_ERROR_CODES].sort()).toEqual(backend.sort());
  });
});

describe("eventErrorKey", () => {
  it.each(EVENT_ERROR_CODES)("has Swedish and English copy for %s", (code) => {
    expect(sv.events.errors[code]).toEqual(expect.any(String));
    expect(en.events.errors[code]).toEqual(expect.any(String));
  });

  it("maps a known code to its copy", () => {
    expect(eventErrorKey(new ApiError("x", 409, "registration_closed"))).toBe("events.errors.registration_closed");
  });

  it("gives nothing for an unknown code, an uncoded ApiError or a plain Error", () => {
    expect(eventErrorKey(new ApiError("x", 409, "something_new"))).toBeUndefined();
    expect(eventErrorKey(new ApiError("x", 500))).toBeUndefined();
    expect(eventErrorKey(new Error("offline"))).toBeUndefined();
  });

  it("keeps the reason on actions other than join", () => {
    expect(eventErrorKey(new ApiError("x", 403, "removed_from_event"))).toBe("events.errors.removed_from_event");
  });
});
