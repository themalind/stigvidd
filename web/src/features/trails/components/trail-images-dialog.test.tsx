// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrailImageResponse } from "@/api/generated/model";
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

const toasts = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => toasts);

import TrailImagesDialog from "./trail-images-dialog";

const TRAIL = "/api/v1/admin/trails/t-1";
const IMAGES = `${TRAIL}/images`;
const trail = { identifier: "t-1", name: "Knalleleden" };

const image = (identifier: string): TrailImageResponse => ({
  identifier,
  imageUrl: `https://media.test/${identifier}.jpg`,
});

let stored: TrailImageResponse[] = [];

async function open(images = [image("img-1"), image("img-2")]) {
  stored = images;
  renderWithProviders(<TrailImagesDialog data={trail} selected={true} />);
  await userEvent.click(screen.getByRole("button"));
  await screen.findByText("Manage images for this trail.");
  await waitFor(() => expect(screen.queryAllByTitle("Delete image")).toHaveLength(images.length));
}

const deleteButtons = () => screen.getAllByTitle("Delete image");
const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[type=file]");
  if (!input) throw new Error("expected a file input");
  return input;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  api.mock.on("GET", TRAIL, () => trailDetail({ identifier: "t-1", trailImagesResponse: stored }));
  api.mock.on("POST", IMAGES, () => {
    const added = [image("img-3")];
    stored = [...stored, ...added];
    return added;
  });
  for (const id of ["img-1", "img-2"]) {
    api.mock.on("DELETE", `/api/v1/admin/trails/images/${id}`, () => {
      stored = stored.filter((i) => i.identifier !== id);
      return undefined;
    });
  }
});

describe("opening the dialog", () => {
  it("fetches nothing until it is opened", () => {
    renderWithProviders(<TrailImagesDialog data={trail} selected={true} />);

    expect(api.mock.calls).toHaveLength(0);
  });

  it("offers no way in when the row is not selected", () => {
    renderWithProviders(<TrailImagesDialog data={trail} selected={false} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("fetches the trail's images", async () => {
    await open();

    expect(calls("GET", TRAIL)).toHaveLength(1);
  });

  it("shows nothing to delete for a trail with no images", async () => {
    await open([]);

    expect(screen.queryByTitle("Delete image")).not.toBeInTheDocument();
  });

  it("says so when the images cannot be loaded, and can try again", async () => {
    api.mock.on("GET", TRAIL, () => {
      throw new ApiError("Not found", 404);
    });
    renderWithProviders(<TrailImagesDialog data={trail} selected={true} />);

    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("Failed to load images.")).toBeVisible();

    api.mock.on("GET", TRAIL, () => trailDetail({ identifier: "t-1", trailImagesResponse: [image("img-1")] }));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(deleteButtons()).toHaveLength(1));
  });
});

// The delete is immediate and irreversible — there is no undo and no trash. The
// button sits under the pointer on hover, one click from the image itself.
describe("deleting an image", () => {
  it("asks first", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await open();

    await userEvent.click(deleteButtons()[0]);

    expect(confirm).toHaveBeenCalledWith("Delete this image?");
  });

  it("deletes nothing when the answer is no", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await open();

    await userEvent.click(deleteButtons()[0]);

    expect(api.mock.calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
    expect(deleteButtons()).toHaveLength(2);
  });

  it("deletes the image that was clicked, and only that one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await open();

    await userEvent.click(deleteButtons()[1]);

    await waitFor(() => expect(deleteButtons()).toHaveLength(1));
    expect(api.mock.calls.filter((call) => call.method === "DELETE").map((call) => call.path)).toEqual([
      "/api/v1/admin/trails/images/img-2",
    ]);
    expect(toasts.toast.success).toHaveBeenCalledWith("Image deleted.");
  });

  it("keeps the image, and says so, when the server refuses", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.mock.on("DELETE", "/api/v1/admin/trails/images/img-1", () => {
      throw new ApiError("Server error", 500);
    });
    await open();

    await userEvent.click(deleteButtons()[0]);

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("Failed to delete image."));
    expect(deleteButtons()).toHaveLength(2);
    expect(toasts.toast.success).not.toHaveBeenCalled();
    // The button is disabled while the request is in flight, so a failure that
    // never re-enables it leaves the image undeletable until the panel is reopened.
    expect(deleteButtons()[0]).toBeEnabled();
  });

  it("keeps every image that is being deleted locked, not just the last one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    for (const id of ["img-1", "img-2"]) {
      api.mock.on("DELETE", `/api/v1/admin/trails/images/${id}`, () => new Promise(() => {}));
    }
    await open();

    await userEvent.click(deleteButtons()[0]);
    await userEvent.click(deleteButtons()[1]);

    await waitFor(() => expect(deleteButtons()[1]).toBeDisabled());
    expect(deleteButtons()[0]).toBeDisabled();
  });

  it("opens an enlarged view when an image is clicked", async () => {
    await open();

    await userEvent.click(screen.getAllByRole("presentation")[0]);

    expect(await screen.findByText("Enlarged image")).toBeInTheDocument();
  });
});

describe("uploading", () => {
  it("adds what came back to the grid and says how many", async () => {
    await open();

    await userEvent.upload(fileInput(), new File(["x"], "photo.jpg", { type: "image/jpeg" }));

    await waitFor(() => expect(deleteButtons()).toHaveLength(3));
    const body = calls("POST", IMAGES)[0].body;
    if (!(body instanceof FormData)) throw new Error("expected a multipart body");
    expect(body.getAll("images")).toEqual([expect.objectContaining({ name: "photo.jpg" })]);
    expect(toasts.toast.success).toHaveBeenCalledWith("1 image uploaded.");
  });

  it("keeps the grid as it was when the upload failed", async () => {
    api.mock.on("POST", IMAGES, () => {
      throw new ApiError("Server error", 500);
    });
    await open();

    await userEvent.upload(fileInput(), new File(["x"], "photo.jpg", { type: "image/jpeg" }));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("Failed to upload images."));
    expect(deleteButtons()).toHaveLength(2);
    expect(fileInput().value).toBe("");
  });
});
