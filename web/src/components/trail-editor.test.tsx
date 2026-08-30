// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  TrailResponse,
  TrailShortInfoResponse,
  UpdateTrailRequest,
} from "@/types/types";

const api = vi.hoisted(() => ({
  getTrailByIdentifier: vi.fn(),
  updateTrail: vi.fn(),
}));
vi.mock("@/api/trail", () => api);

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

import TrailEditor from "./trail-editor";

const short: TrailShortInfoResponse = {
  identifier: "trail-1",
  name: "Knalleleden",
  trailLength: 42,
  classification: 2,
  accessibility: false,
  city: "Borås",
} as TrailShortInfoResponse;

const full = {
  identifier: "trail-1",
  name: "Knalleleden",
  trailLength: 42,
  classification: 2,
  accessibility: true,
  accessibilityInfo: "Gravel throughout",
  trailSymbol: "symbol.png",
  description: "A long walk",
  fullDescription: "A very long walk",
  tags: '["forest"]',
  city: "Borås",
  visitorInformation: {
    gettingThere: "Bus 100",
    publicTransport: "Yes",
    parking: "By the church",
    illumination: true,
    illuminationText: "First 3 km",
    maintainedBy: "Borås stad",
    winterMaintenance: false,
  },
} as TrailResponse;

const open = () => userEvent.click(screen.getByRole("button"));
const saveButton = () => screen.getByRole("button", { name: /Save changes/ });
const sent = () => api.updateTrail.mock.calls[0][1] as UpdateTrailRequest;

beforeEach(() => {
  api.getTrailByIdentifier.mockResolvedValue(full);
  api.updateTrail.mockResolvedValue(full);
});

describe("TrailEditor", () => {
  it("offers no way in for a row that is not selected", () => {
    render(<TrailEditor data={short} selected={false} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("fetches the whole trail when the panel opens", async () => {
    render(<TrailEditor data={short} selected />);

    await open();

    await waitFor(() =>
      expect(api.getTrailByIdentifier).toHaveBeenCalledWith({
        identifier: "trail-1",
      }),
    );
  });

  it("fills the form from the trail rather than from the row", async () => {
    render(<TrailEditor data={short} selected />);
    await open();

    expect(await screen.findByDisplayValue("A very long walk")).toBeVisible();
    expect(screen.getByDisplayValue("Bus 100")).toBeVisible();
    expect(screen.getByDisplayValue("Borås stad")).toBeVisible();
  });

  it("sends the whole trail back, edits and untouched fields alike", async () => {
    render(<TrailEditor data={short} selected />);
    await open();

    const name = await screen.findByDisplayValue("Knalleleden");
    await userEvent.clear(name);
    await userEvent.type(name, "Knalleleden norr");
    await userEvent.click(saveButton());

    await waitFor(() => expect(api.updateTrail).toHaveBeenCalledOnce());
    expect(api.updateTrail.mock.calls[0][0]).toBe("trail-1");
    expect(sent()).toMatchObject({
      name: "Knalleleden norr",
      trailLength: 42,
      fullDescription: "A very long walk",
      tags: '["forest"]',
      visitorInformation: expect.objectContaining({ parking: "By the church" }),
    });
  });

  /**
   * The panel's own description says the changes are permanent and cannot be undone. The
   * form starts empty, so a failed load used to leave a live Save button over a blank
   * form: one click and the trail lost its name, description, tags, city and length.
   */
  describe("when the trail could not be loaded", () => {
    beforeEach(() => {
      api.getTrailByIdentifier.mockRejectedValue(new Error("offline"));
    });

    it("says so instead of showing an empty form", async () => {
      render(<TrailEditor data={short} selected />);
      await open();

      expect(await screen.findByText(/could not be loaded/)).toBeVisible();
      expect(screen.queryByDisplayValue("Knalleleden")).not.toBeInTheDocument();
      expect(toasted.error).toHaveBeenCalledWith("Failed to load trail data.");
    });

    it("will not save the empty form over the trail", async () => {
      render(<TrailEditor data={short} selected />);
      await open();

      await waitFor(() => expect(saveButton()).toBeDisabled());

      await userEvent.click(saveButton());

      expect(api.updateTrail).not.toHaveBeenCalled();
    });
  });

  it("keeps Save out of reach while the trail is still on its way", async () => {
    let arrive: (trail: TrailResponse) => void = () => {};
    api.getTrailByIdentifier.mockReturnValue(
      new Promise<TrailResponse>((resolve) => {
        arrive = resolve;
      }),
    );

    render(<TrailEditor data={short} selected />);
    await open();

    expect(await screen.findByText("Loading...")).toBeVisible();
    expect(saveButton()).toBeDisabled();

    arrive(full);

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it("reports a save that failed rather than a save that did not happen", async () => {
    api.updateTrail.mockRejectedValue(new Error("409"));

    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(toasted.error).toHaveBeenCalledWith("Failed to update trail."),
    );
    expect(toasted.success).not.toHaveBeenCalled();
  });

  it("lets go of the button again after a save that failed", async () => {
    api.updateTrail.mockRejectedValue(new Error("409"));

    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");
    await userEvent.click(saveButton());

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it("reads a length typed into the number box as a number", async () => {
    render(<TrailEditor data={short} selected />);
    await open();

    const length = await screen.findByDisplayValue("42");
    await userEvent.clear(length);
    await userEvent.type(length, "12.5");
    await userEvent.click(saveButton());

    await waitFor(() => expect(api.updateTrail).toHaveBeenCalled());
    expect(sent().trailLength).toBe(12.5);
  });

  // The visitor block is nested, and each field spreads the block it sits in. Writing one
  // must not drop the six beside it.
  it("keeps the rest of the visitor block when one of its fields is edited", async () => {
    render(<TrailEditor data={short} selected />);
    await open();

    const parking = await screen.findByDisplayValue("By the church");
    await userEvent.clear(parking);
    await userEvent.type(parking, "By the lake");
    await userEvent.click(saveButton());

    await waitFor(() => expect(api.updateTrail).toHaveBeenCalled());
    expect(sent().visitorInformation).toEqual({
      gettingThere: "Bus 100",
      publicTransport: "Yes",
      parking: "By the lake",
      illumination: true,
      illuminationText: "First 3 km",
      maintainedBy: "Borås stad",
      winterMaintenance: false,
    });
  });

  it("fills a missing visitor block rather than sending nothing for it", async () => {
    api.getTrailByIdentifier.mockResolvedValue({
      ...full,
      visitorInformation: null,
    } as unknown as TrailResponse);

    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");
    await userEvent.click(saveButton());

    await waitFor(() => expect(api.updateTrail).toHaveBeenCalled());
    expect(sent().visitorInformation).toEqual({
      gettingThere: "",
      publicTransport: "",
      parking: "",
      illumination: false,
      illuminationText: "",
      maintainedBy: "",
      winterMaintenance: false,
    });
  });

  // The API rejects the whole request when one field is too long, so the field
  // has to stop the operator rather than the save.
  it("stops a field at the limit the API enforces", async () => {
    render(<TrailEditor data={short} selected />);
    await open();

    const symbol = await screen.findByDisplayValue("symbol.png");
    await userEvent.clear(symbol);
    await userEvent.type(symbol, "s".repeat(45));

    expect((symbol as HTMLInputElement).value).toHaveLength(40);
    expect(screen.getByText("40/40")).toBeTruthy();

    await userEvent.click(saveButton());

    await waitFor(() => expect(api.updateTrail).toHaveBeenCalled());
    expect(sent().trailSymbol).toHaveLength(40);
  });

  // A tag is only committed to the form when the field is left, so saving
  // straight after typing one used to send the trail back without it.
  it("saves a tag that was typed but never entered", async () => {
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");

    await userEvent.type(
      screen.getByPlaceholderText("Add tag and press Enter"),
      "moss",
    );
    await userEvent.click(saveButton());

    await waitFor(() => expect(api.updateTrail).toHaveBeenCalled());
    expect(sent().tags).toBe('["forest","moss"]');
  });
});
