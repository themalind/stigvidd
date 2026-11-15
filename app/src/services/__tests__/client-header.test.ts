// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

type ClientHeader = typeof import("../client-header");

function load(modelName: string | null): ClientHeader {
  let mod: ClientHeader | undefined;
  jest.isolateModules(() => {
    jest.doMock("expo-device", () => ({ modelName }));
    jest.doMock("../app-info", () => ({
      getAppInfo: () => ({ appVersion: "1.0.1", buildNumber: "13", platform: "android", osVersion: "36" }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- keep-comment: isolateModules needs require
    mod = require("../client-header");
  });
  if (!mod) throw new Error("expected the module");
  return mod;
}

describe("clientHeaderValue", () => {
  it("names the app build, platform, OS version and model", () => {
    expect(load("Pixel 7").clientHeaderValue()).toBe("app=1.0.1;build=13;platform=android;os=36;model=Pixel 7");
  });

  it("keeps a model name from breaking the header or its key=value format", () => {
    expect(load("Galaxy;x=1\nÅ™").clientHeaderValue()).toMatch(/;model=Galaxy x 1$/);
  });

  it("says unknown when the device reports no model", () => {
    expect(load(null).clientHeaderValue()).toMatch(/;model=unknown$/);
  });
});
