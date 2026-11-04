// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { countOf, Pager } from "./pager";

it("steps one page either way", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Pager page={3} hasMore onChange={onChange} pageCount={5} summary="120 mails" />);

  expect(screen.getByText("Page 3 of 5")).toBeInTheDocument();
  expect(screen.getByText("120 mails")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Previous page" }));
  await user.click(screen.getByRole("button", { name: "Next page" }));

  expect(onChange.mock.calls).toEqual([[2], [4]]);
});

it("cannot go before the first page or past the last", () => {
  render(<Pager page={1} hasMore={false} onChange={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
});

it("holds Next while the next page is still on its way", () => {
  render(<Pager page={2} hasMore busy onChange={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
});

it("counts in the singular and the plural", () => {
  expect(countOf(1, "report")).toBe("1 report");
  expect(countOf(0, "report")).toBe("0 reports");
});
