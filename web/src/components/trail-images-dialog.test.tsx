// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrailImageResponse, TrailShortInfoResponse } from "@/types/types";

const api = vi.hoisted(() => ({
  getTrailByIdentifier: vi.fn(),
  addTrailImages: vi.fn(),
  deleteTrailImage: vi.fn(),
}));
vi.mock("@/api/trail", () => api);

const toasts = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => toasts);

import TrailImagesDialog from "./trail-images-dialog";

const trail: TrailShortInfoResponse = {
  identifier: "t-1",
  name: "Knalleleden",
  trailLength: 4000,
  accessibility: true,
  classification: 1,
  city: "Borås",
};

const image = (identifier: string): TrailImageResponse => ({
  identifier,
  imageUrl: `https://media.test/${identifier}.jpg`,
});

/** The dialog fetches nothing until it is opened. */
async function open(images = [image("img-1"), image("img-2")]) {
  api.getTrailByIdentifier.mockResolvedValue({ trailImagesResponse: images });
  render(<TrailImagesDialog data={trail} selected={true} />);
  await userEvent.click(screen.getByRole("button"));
  await waitFor(() =>
    expect(screen.getAllByTitle("Delete image")).toHaveLength(images.length),
  );
}

const deleteButtons = () => screen.getAllByTitle("Delete image");

beforeEach(() => {
  api.deleteTrailImage.mockResolvedValue(undefined);
  api.addTrailImages.mockResolvedValue([]);
});

describe("opening the dialog", () => {
  it("fetches the trail's images", async () => {
    await open();

    expect(api.getTrailByIdentifier).toHaveBeenCalledWith({
      identifier: "t-1",
    });
  });

  it("shows nothing to delete for a trail with no images", async () => {
    api.getTrailByIdentifier.mockResolvedValue({ trailImagesResponse: [] });
    render(<TrailImagesDialog data={trail} selected={true} />);

    await userEvent.click(screen.getByRole("button"));

    await screen.findByText("Manage images for this trail.");
    expect(screen.queryByTitle("Delete image")).not.toBeInTheDocument();
  });

  it("says so when the images cannot be loaded", async () => {
    api.getTrailByIdentifier.mockRejectedValue(new Error("nope"));
    render(<TrailImagesDialog data={trail} selected={true} />);

    await userEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(toasts.toast.error).toHaveBeenCalledWith("Failed to load images."),
    );
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

    expect(api.deleteTrailImage).not.toHaveBeenCalled();
    expect(deleteButtons()).toHaveLength(2);
  });

  it("deletes the image that was clicked, and only that one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await open();

    await userEvent.click(deleteButtons()[1]);

    await waitFor(() =>
      expect(api.deleteTrailImage).toHaveBeenCalledWith("img-2"),
    );
    expect(api.deleteTrailImage).toHaveBeenCalledOnce();
    await waitFor(() => expect(deleteButtons()).toHaveLength(1));
  });

  it("keeps the image, and says so, when the server refuses", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deleteTrailImage.mockRejectedValue(new Error("500"));
    await open();

    await userEvent.click(deleteButtons()[0]);

    await waitFor(() =>
      expect(toasts.toast.error).toHaveBeenCalledWith("Failed to delete image."),
    );
    expect(deleteButtons()).toHaveLength(2);
    expect(toasts.toast.success).not.toHaveBeenCalled();
    // The button is disabled while the request is in flight, so a failure that
    // never re-enables it leaves the image undeletable until the panel is reopened.
    expect(deleteButtons()[0]).toBeEnabled();
  });

  // While the enlarged view is open it is a modal of its own, and Radix makes the
  // grid behind it inert — so the delete button cannot be reached from there. The
  // `setEnlarged(null)` inside handleDelete is a second line of defence, not a path
  // a user can take, and driving it here would need an event no pointer can produce.
  it("opens an enlarged view when an image is clicked", async () => {
    await open();

    await userEvent.click(screen.getAllByRole("presentation")[0]);

    expect(await screen.findByText("Enlarged image")).toBeInTheDocument();
  });
});

describe("uploading", () => {
  it("adds what came back to the grid", async () => {
    api.addTrailImages.mockResolvedValue([image("img-3")]);
    await open();

    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    await userEvent.upload(
      input,
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    );

    await waitFor(() => expect(deleteButtons()).toHaveLength(3));
    expect(api.addTrailImages).toHaveBeenCalledWith("t-1", [
      expect.objectContaining({ name: "photo.jpg" }),
    ]);
  });

  it("keeps the grid as it was when the upload failed", async () => {
    api.addTrailImages.mockRejectedValue(new Error("500"));
    await open();

    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    await userEvent.upload(
      input,
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    );

    await waitFor(() =>
      expect(toasts.toast.error).toHaveBeenCalledWith("Failed to upload images."),
    );
    expect(deleteButtons()).toHaveLength(2);
  });
});
