// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { emptyMediaFilters, type MediaFilterState, type MediaSortValue } from "@/features/media/utils/media-browse";
import { MediaFilters } from "./media-filters";

const onFiltersChange = vi.fn<(next: MediaFilterState) => void>();
const onSortChange = vi.fn<(next: MediaSortValue) => void>();

function Harness({ initial }: { initial: MediaFilterState }) {
  const [filters, setFilters] = useState(initial);
  return (
    <MediaFilters
      filters={filters}
      onFiltersChange={(next) => {
        onFiltersChange(next);
        setFilters(next);
      }}
      sort="newest"
      onSortChange={onSortChange}
    />
  );
}

function show(filters: Partial<MediaFilterState> = {}) {
  render(<Harness initial={{ ...emptyMediaFilters, ...filters }} />);
}

const lastFilters = () => onFiltersChange.mock.calls.at(-1)?.[0];

beforeEach(() => {
  onFiltersChange.mockReset();
  onSortChange.mockReset();
});

it("applies a chip at once and shows what the list is narrowed by", async () => {
  show();

  await userEvent.click(screen.getByRole("button", { name: /Needs work/ }));
  await userEvent.click(within(screen.getByRole("group", { name: "Owner" })).getByRole("button", { name: "Symbols" }));

  expect(lastFilters()).toMatchObject({ needsWork: true, ownerType: "TrailSymbol" });
  expect(screen.getByText("Showing: needs work · TrailSymbol")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Needs work/ })).toHaveAttribute("aria-pressed", "true");
});

it("labels formats in capitals but sends them as the API spells them", async () => {
  show();

  await userEvent.click(within(screen.getByRole("group", { name: "Format" })).getByRole("button", { name: "WEBP" }));

  expect(lastFilters()).toMatchObject({ format: "webp" });
});

it("holds the size filters as a draft until they are applied", async () => {
  show();

  await userEvent.click(screen.getByRole("button", { name: "More filters" }));
  await userEvent.type(screen.getByLabelText("Minimum width"), "1200");
  await userEvent.type(screen.getByLabelText("Maximum size in KB"), "500");
  expect(onFiltersChange).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  expect(lastFilters()).toMatchObject({ minWidth: "1200", maxSizeKb: "500" });
  expect(screen.getByText("Showing: ≥ 1200 px wide · ≤ 500 KB")).toBeInTheDocument();
});

it("keeps an unapplied draft when a chip is clicked", async () => {
  show();

  await userEvent.click(screen.getByRole("button", { name: "More filters" }));
  await userEvent.type(screen.getByLabelText("Minimum height"), "300");
  await userEvent.click(screen.getByRole("button", { name: /Needs work/ }));

  expect(lastFilters()).toMatchObject({ needsWork: true, minHeight: "" });
  expect(screen.getByLabelText("Minimum height")).toHaveValue(300);
});

it("clears every filter, the draft included, with Show all", async () => {
  show({ needsWork: true, format: "png", minWidth: "800" });

  await userEvent.click(screen.getByRole("button", { name: "Show all" }));

  expect(lastFilters()).toEqual(emptyMediaFilters);
  expect(screen.queryByText(/Showing:/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "More filters" }));
  expect(screen.getByLabelText("Minimum width")).toHaveValue(null);
});

it("hands a new sort order up", async () => {
  show();

  await userEvent.selectOptions(screen.getByLabelText("Sort"), "largest");

  expect(onSortChange).toHaveBeenCalledWith("largest");
});

it("hides the extra filters again", async () => {
  show();

  await userEvent.click(screen.getByRole("button", { name: "More filters" }));
  await userEvent.click(screen.getByRole("button", { name: "Fewer filters" }));

  expect(screen.queryByLabelText("Minimum width")).not.toBeInTheDocument();
});
