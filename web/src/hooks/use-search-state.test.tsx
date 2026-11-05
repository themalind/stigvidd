// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { expect, it } from "vitest";
import { useSearchState } from "./use-search-state";

const DEFAULTS = { status: "Pending", type: "All" };

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const state = useSearchState(DEFAULTS);
      return { ...state, search: useLocation().search };
    },
    { wrapper },
  );
}

it("reads the address, falling back to the defaults and to page 1", () => {
  const { result } = setup("/x?type=Review");

  expect(result.current.values).toEqual({ status: "Pending", type: "Review" });
  expect(result.current.page).toBe(1);
});

it("ignores a page that is not a positive number", () => {
  expect(setup("/x?page=-3").result.current.page).toBe(1);
  expect(setup("/x?page=abc").result.current.page).toBe(1);
  expect(setup("/x?page=4").result.current.page).toBe(4);
});

it("keeps defaults out of the address and writes an overridden default explicitly", () => {
  const { result } = setup("/x?status=Upheld");

  act(() => result.current.update({ status: "Pending" }));
  expect(result.current.search).toBe("");

  act(() => result.current.update({ status: "All" }));
  expect(result.current.search).toBe("?status=All");
});

it("drops the page on a filter change but not on a page change", () => {
  const { result } = setup("/x?page=3&keep=me");

  act(() => result.current.setPage(4));
  expect(result.current.search).toBe("?page=4&keep=me");

  act(() => result.current.update({ type: "Event" }));
  expect(result.current.search).toBe("?keep=me&type=Event");
});

it("clears a value set to empty, undefined or false", () => {
  const { result } = setup("/x?type=Review&status=Upheld");

  act(() => result.current.update({ type: undefined, status: "" }));

  expect(result.current.search).toBe("");
});
