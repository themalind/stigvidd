// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrailResponse, UpdateTrailRequest } from "@/api/generated/model";
import { ApiError } from "@/api/mutator";
import { trailDetail } from "@/testing/fixtures/trails";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

import TrailEditor from "./trail-editor";

const TRAIL = "/api/v1/admin/trails/trail-1";
const short = { identifier: "trail-1" };
const full = trailDetail();

const render = (ui: React.ReactElement) => renderWithProviders(ui);
const puts = () => api.mock.calls.filter((call) => call.method === "PUT");
const sent = () => puts()[0].body as UpdateTrailRequest;

const open = () => userEvent.click(screen.getByRole("button"));
const saveButton = () => screen.getByRole("button", { name: /Save changes/ });

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  api.mock.on("GET", TRAIL, () => full);
  api.mock.on("PUT", TRAIL, () => full);
});

describe("TrailEditor", () => {
  it("offers no way in for a row that is not selected", () => {
    render(<TrailEditor data={short} selected={false} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("fetches the whole trail when the panel opens", async () => {
    render(<TrailEditor data={short} selected />);

    await open();

    await waitFor(() => expect(api.mock.calls.filter((call) => call.path === TRAIL)).toHaveLength(1));
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

    await waitFor(() => expect(puts()).toHaveLength(1));
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
      api.mock.on("GET", TRAIL, () => {
        throw new ApiError("Not found", 404);
      });
    });

    it("says so instead of showing an empty form", async () => {
      render(<TrailEditor data={short} selected />);
      await open();

      expect(await screen.findByText(/could not be loaded/)).toBeVisible();
      expect(screen.queryByDisplayValue("Knalleleden")).not.toBeInTheDocument();
    });

    it("will not save the empty form over the trail", async () => {
      render(<TrailEditor data={short} selected />);
      await open();

      await waitFor(() => expect(saveButton()).toBeDisabled());

      await userEvent.click(saveButton());

      expect(puts()).toHaveLength(0);
    });
  });

  it("keeps Save out of reach while the trail is still on its way", async () => {
    let arrive: (trail: TrailResponse) => void = () => {};
    api.mock.on(
      "GET",
      TRAIL,
      () =>
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
    api.mock.on("PUT", TRAIL, () => {
      throw new ApiError("Conflict", 409);
    });

    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");
    await userEvent.click(saveButton());

    await waitFor(() => expect(toasted.error).toHaveBeenCalledWith("Failed to update trail."));
    expect(toasted.success).not.toHaveBeenCalled();
  });

  it("lets go of the button again after a save that failed", async () => {
    api.mock.on("PUT", TRAIL, () => {
      throw new ApiError("Conflict", 409);
    });

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

    await waitFor(() => expect(puts()).toHaveLength(1));
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

    await waitFor(() => expect(puts()).toHaveLength(1));
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

  it("names every field by its label", async () => {
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");

    expect(screen.getByLabelText("Name")).toHaveValue("Knalleleden");
    expect(screen.getByLabelText("Parking")).toHaveValue("By the church");
    expect(screen.getByLabelText("Maintained By")).toHaveValue("Borås stad");
  });

  it("ticks a box when its label is clicked", async () => {
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");

    await userEvent.click(screen.getByText("Winter Maintenance"));
    await userEvent.click(saveButton());

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(sent().visitorInformation?.winterMaintenance).toBe(true);
  });

  it("fills a missing visitor block rather than sending nothing for it", async () => {
    api.mock.on("GET", TRAIL, () => ({ ...full, visitorInformation: null }));

    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");
    await userEvent.click(saveButton());

    await waitFor(() => expect(puts()).toHaveLength(1));
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

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(sent().trailSymbol).toHaveLength(40);
  });

  it("sends the existing links back with their identifiers", async () => {
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Borås Stad");
    await userEvent.click(saveButton());

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(sent().links).toEqual([{ identifier: "link-1", title: "Borås Stad", link: "https://www.boras.se" }]);
  });

  it("adds a new link without an identifier", async () => {
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Borås Stad");

    await userEvent.click(screen.getByRole("button", { name: /Add link/ }));
    await userEvent.type(screen.getByLabelText("Link 2 title"), "Karta");
    await userEvent.type(screen.getByLabelText("Link 2 address"), "https://example.com/karta");
    await userEvent.click(saveButton());

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(sent().links).toEqual([
      { identifier: "link-1", title: "Borås Stad", link: "https://www.boras.se" },
      { title: "Karta", link: "https://example.com/karta" },
    ]);
  });

  it("drops a removed link from what it sends", async () => {
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Borås Stad");

    await userEvent.click(screen.getByRole("button", { name: "Remove link 1" }));
    await userEvent.click(saveButton());

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(sent().links).toEqual([]);
  });

  it("will not save a link the API would reject", async () => {
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Borås Stad");

    await userEvent.click(screen.getByRole("button", { name: /Add link/ }));
    await userEvent.type(screen.getByLabelText("Link 2 title"), "Karta");
    await userEvent.type(screen.getByLabelText("Link 2 address"), "www.example.com");

    expect(screen.getByText(/starting with https:\/\//)).toBeVisible();
    expect(saveButton()).toBeDisabled();
  });

  // A tag is only committed to the form when the field is left, so saving
  // straight after typing one used to send the trail back without it.
  it("saves a tag that was typed but never entered", async () => {
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByDisplayValue("Knalleleden");

    await userEvent.type(screen.getByPlaceholderText("Add tag and press Enter"), "moss");
    await userEvent.click(saveButton());

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(sent().tags).toBe('["forest","moss"]');
  });
  it("can try again after a failed load, and then edit", async () => {
    api.mock.on("GET", TRAIL, () => {
      throw new ApiError("Not found", 404);
    });
    render(<TrailEditor data={short} selected />);
    await open();
    await screen.findByText(/could not be loaded/);

    api.mock.on("GET", TRAIL, () => full);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByDisplayValue("Knalleleden")).toBeVisible();
    expect(saveButton()).toBeEnabled();
  });

  it("refetches the trail after a save, since the save reply carries no images", async () => {
    const image = { identifier: "img-1", imageUrl: "https://media.test/img-1.jpg" };
    let stored = trailDetail({ trailImagesResponse: [image] });
    api.mock.on("GET", TRAIL, () => stored);
    api.mock.on("PUT", TRAIL, (request) => {
      stored = { ...stored, ...(request as object) };
      return { ...stored, trailImagesResponse: null };
    });
    const { client } = render(<TrailEditor data={short} selected />);
    client.setQueryData(["/api/v1/admin/trails"], []);
    await open();

    const name = await screen.findByDisplayValue("Knalleleden");
    await userEvent.clear(name);
    await userEvent.type(name, "Knalleleden norr");
    await userEvent.click(saveButton());

    await waitFor(() => expect(toasted.success).toHaveBeenCalledWith("Trail updated successfully."));
    expect(client.getQueryState(["/api/v1/admin/trails"])?.isInvalidated).toBe(true);
    await waitFor(() => expect(client.getQueryData<TrailResponse>([TRAIL])?.name).toBe("Knalleleden norr"));
    expect(client.getQueryData<TrailResponse>([TRAIL])?.trailImagesResponse).toEqual([image]);
  });

  it("fills the form from the server, not from an older cached copy", async () => {
    const { client } = render(<TrailEditor data={short} selected />);
    client.setQueryData([TRAIL], trailDetail({ name: "Gammalt namn" }));

    await open();

    expect(await screen.findByDisplayValue("Knalleleden")).toBeVisible();
    expect(screen.queryByDisplayValue("Gammalt namn")).not.toBeInTheDocument();
  });
});
