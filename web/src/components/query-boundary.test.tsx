// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSuspenseQuery } from "@tanstack/react-query";
import { renderWithProviders } from "@/testing/render";
import { QueryBoundary } from "./query-boundary";

const load = vi.fn<() => Promise<string>>();

function Greeting() {
  const { data } = useSuspenseQuery({ queryKey: ["greeting"], queryFn: load });
  return <p>{data}</p>;
}

beforeEach(() => {
  // keep-comment: React logs every error a boundary catches, and these tests provoke them on purpose
  vi.spyOn(console, "error").mockImplementation(() => {});
  load.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QueryBoundary", () => {
  it("shows the loading state until the data is there", async () => {
    load.mockResolvedValue("Hej");
    renderWithProviders(
      <QueryBoundary>
        <Greeting />
      </QueryBoundary>,
    );

    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    expect(await screen.findByText("Hej")).toBeInTheDocument();
  });

  it("shows the failure, and fetches again when asked to", async () => {
    load.mockRejectedValueOnce(new Error("The API is down.")).mockResolvedValueOnce("Hej");
    renderWithProviders(
      <QueryBoundary>
        <Greeting />
      </QueryBoundary>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("The API is down.");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Hej")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("clears the failure when a reset key changes, such as navigating away", async () => {
    load.mockRejectedValueOnce(new Error("The API is down.")).mockResolvedValueOnce("Hej");
    const { rerender } = renderWithProviders(
      <QueryBoundary resetKeys={["/one"]}>
        <Greeting />
      </QueryBoundary>,
    );
    await screen.findByRole("alert");

    rerender(
      <QueryBoundary resetKeys={["/two"]}>
        <Greeting />
      </QueryBoundary>,
    );

    expect(await screen.findByText("Hej")).toBeInTheDocument();
  });
});
