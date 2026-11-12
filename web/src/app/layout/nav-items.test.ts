// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy } from "react";
import { describe, expect, it } from "vitest";
import { Gauge, Import, Route, Waves } from "lucide-react";
import type { AppPage, NavGroup } from "../pages";
import { buildNav, isUnder } from "./nav-items";

const component = lazy(() => Promise.resolve({ default: () => null }));
const imports: NavGroup = { title: "Import", icon: Import };

const page = (path: string, extra: Partial<AppPage> = {}): AppPage => ({
  path,
  title: path,
  component,
  icon: Gauge,
  ...extra,
});

describe("buildNav", () => {
  it("puts a group where its first page is and gathers the rest into it", () => {
    const nav = buildNav([
      page("/dashboard"),
      page("/trail-import", { icon: Route, group: imports }),
      page("/moderation"),
      page("/facility-import", { icon: Waves, group: imports }),
    ]);

    expect(nav.map((item) => (item.kind === "page" ? item.path : item.group.title))).toEqual([
      "/dashboard",
      "Import",
      "/moderation",
    ]);
    const group = nav[1];
    if (group?.kind !== "group") throw new Error("expected a group");
    expect(group.pages.map((child) => child.path)).toEqual(["/trail-import", "/facility-import"]);
  });

  it("leaves out pages without an icon", () => {
    const nav = buildNav([page("/trail-import/:id", { icon: undefined, group: imports })]);

    expect(nav).toEqual([]);
  });
});

describe("isUnder", () => {
  it("matches the page and its detail routes, not a sibling with the same prefix", () => {
    expect(isUnder("/trail-import", "/trail-import")).toBe(true);
    expect(isUnder("/trail-import/12", "/trail-import")).toBe(true);
    expect(isUnder("/trail-imports", "/trail-import")).toBe(false);
    expect(isUnder("/user-walks", "/user-walks?status=x")).toBe(true);
  });
});
