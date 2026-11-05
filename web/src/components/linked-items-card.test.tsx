// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LinkedItemsCard, { type LinkItem } from "./linked-items-card";

const grill: LinkItem = { identifier: "f-1", label: "Grillplats Ramnasjön", detail: "Fire pit" };
const shelter: LinkItem = { identifier: "f-2", label: "Vindskydd Rya åsar", detail: "Shelter" };
const bath: LinkItem = { identifier: "f-3", label: "Badplats Öresjö", detail: "Swimming area" };

function renderCard(linked: LinkItem[], onLink = vi.fn(), onUnlink = vi.fn()) {
  render(
    <LinkedItemsCard
      title="Facilities"
      description="d"
      searchLabel="Search facilities"
      linked={linked}
      available={[grill, shelter, bath]}
      onLink={onLink}
      onUnlink={onUnlink}
    />,
  );
  return { onLink, onUnlink };
}

describe("LinkedItemsCard", () => {
  it("lists linked items and unlinks one", async () => {
    const { onUnlink } = renderCard([grill]);
    onUnlink.mockResolvedValue(undefined);

    await userEvent.click(screen.getByRole("button", { name: "Unlink Grillplats Ramnasjön" }));

    expect(onUnlink).toHaveBeenCalledWith("f-1");
  });

  it("suggests only unlinked matches, by name or type", async () => {
    renderCard([shelter]);

    await userEvent.type(screen.getByRole("textbox", { name: "Search facilities" }), "s");

    expect(screen.getByRole("button", { name: "Link Badplats Öresjö" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link Vindskydd Rya åsar" })).toBeNull();
  });

  it("links a suggestion", async () => {
    const { onLink } = renderCard([]);
    onLink.mockResolvedValue(undefined);

    await userEvent.type(screen.getByRole("textbox", { name: "Search facilities" }), "grill");
    await userEvent.click(screen.getByRole("button", { name: "Link Grillplats Ramnasjön" }));

    expect(onLink).toHaveBeenCalledWith("f-1");
  });

  it("names a match that is already linked instead of saying nothing matches", async () => {
    renderCard([grill]);

    await userEvent.type(screen.getByRole("textbox", { name: "Search facilities" }), "grill");

    expect(screen.getByText("Already linked here: Grillplats Ramnasjön")).toBeInTheDocument();
    expect(screen.queryByText("No matches.")).not.toBeInTheDocument();
  });

  it("says when nothing matches at all", async () => {
    renderCard([]);

    await userEvent.type(screen.getByRole("textbox", { name: "Search facilities" }), "zzz");

    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });
});
