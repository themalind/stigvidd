// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminTrailListItemResponse, FacilityResponse, MediaItemResponse } from "@/api/generated/model";
import { saveStagedFiles, saveStagedTarget } from "@/features/media/utils/staged-media";
import { libraryPage, mediaItem } from "@/testing/fixtures/media";
import { trailListItem } from "@/testing/fixtures/trails";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

// keep-comment: jsdom's FormData refuses the Node File these tests need for IndexedDB, so the multipart calls (tested in src/api/images.test.ts) are replaced here
const images = vi.hoisted(() => ({
  addTrailImages: vi.fn(),
  setTrailSymbol: vi.fn(),
  addFacilityImages: vi.fn(),
  deleteTrailImage: vi.fn(),
  deleteFacilityImage: vi.fn(),
}));
vi.mock("@/api/images", () => images);

// Real everywhere except the one read whose timing is the thing under test.
const staged = vi.hoisted(() => ({ loadStagedFiles: vi.fn() }));
vi.mock("@/features/media/utils/staged-media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/media/utils/staged-media")>()),
  loadStagedFiles: staged.loadStagedFiles,
}));

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

// Its cropper is pointer maths over an image jsdom never loads.
vi.mock("@/features/media/components/image-crop", () => ({ default: () => <div data-testid="cropper" /> }));

import MediaPage from "./media";

// keep-comment: fake-indexeddb clones through Node's structuredClone, which turns a jsdom Blob into {} - see docs/notes/web-vitest-environment.md
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;

let objectUrls = 0;
// keep-comment: vitest copies the swap above onto jsdom's window, and its own createObjectURL then throws on a Node File
URL.createObjectURL = () => `blob:test/${++objectUrls}`;

const TRAILS = "/api/v1/admin/trails";
const FACILITIES = "/api/v1/admin/facilities";
const MEDIA = "/api/v1/admin/media";

const trail = (identifier: string, name: string) => trailListItem({ identifier, name, trailLength: 4, city: "" });
const facility = (identifier: string, name: string): FacilityResponse => ({
  identifier,
  name,
  facilityType: 1,
  isAccessible: false,
});
const item = (identifier: string, ownerIdentifier: string, ownerType: string) =>
  mediaItem({ identifier, ownerIdentifier, ownerType });

const image = (name: string, type = "image/jpeg") => new File(["bytes"], name, { type });

let trails: () => AdminTrailListItemResponse[] | Promise<AdminTrailListItemResponse[]>;
let facilities: () => FacilityResponse[];
let owned: MediaItemResponse[];

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

const show = () => renderWithProviders(<MediaPage />, { initialEntries: ["/media"] });

async function settled() {
  await waitFor(() => expect(calls("GET", FACILITIES)).toHaveLength(1));
  await act(() => Promise.resolve());
}

/** Radix renders its listbox in a portal; the trigger has to be opened first. */
async function pick(label: RegExp | string, option: RegExp | string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

const fileInput = () => screen.getByLabelText<HTMLInputElement>("Choose images");
const uploadButton = () => screen.getByRole("button", { name: /upload/i });
const previews = () => screen.queryAllByAltText("");
const storedTarget = () => JSON.parse(localStorage.getItem("stigvidd:media-upload-target") ?? "null");

let readStore: typeof import("@/features/media/utils/staged-media").loadStagedFiles;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  api.mock.reset();
  const real = await vi.importActual<typeof import("@/features/media/utils/staged-media")>(
    "@/features/media/utils/staged-media",
  );
  readStore = real.loadStagedFiles;
  staged.loadStagedFiles.mockImplementation(real.loadStagedFiles);

  trails = () => [trail("t-1", "Knalleleden"), trail("t-2", "Sjuhäradsrundan")];
  facilities = () => [facility("f-1", "Vindskydd")];
  owned = [];
  api.mock.on("GET", TRAILS, () => trails());
  api.mock.on("GET", FACILITIES, () => facilities());
  api.mock.on("GET", MEDIA, () => libraryPage(owned));

  images.addTrailImages.mockResolvedValue([{}]);
  images.setTrailSymbol.mockResolvedValue({});
  images.addFacilityImages.mockResolvedValue([{}]);
  images.deleteTrailImage.mockResolvedValue(undefined);
  images.deleteFacilityImage.mockResolvedValue(undefined);
});

describe("the target that was chosen last time", () => {
  it("is restored on the first render, without flashing the default", async () => {
    saveStagedTarget({ targetType: "facility", targetId: "f-1" });

    show();

    expect(screen.getByLabelText("Attach to")).toHaveTextContent("Facility");
    await settled();
  });

  it("falls back to the default for a stored type that is not one of the three", async () => {
    saveStagedTarget({ targetType: "trail-audio", targetId: "t-1" });

    show();
    await settled();

    expect(screen.getByLabelText("Attach to")).toHaveTextContent("Trail — gallery");
  });

  it("is remembered when it changes", async () => {
    show();
    await settled();

    await pick("Trail", /Sjuhäradsrundan/);

    expect(storedTarget()).toEqual({ targetType: "trail-gallery", targetId: "t-2" });
  });

  // A trail id left behind on a facility upload would attach the image to nothing —
  // and the trigger shows the placeholder either way, because a value matching no
  // option renders as empty. What is stored is what tells the two apart.
  it("is cleared when the kind of target changes", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);

    await pick("Attach to", "Facility");

    expect(storedTarget()).toEqual({ targetType: "facility", targetId: "" });
    expect(screen.getByLabelText("Facility")).toHaveTextContent("Select…");
  });

  it("is cleared even when there is no list to check it against", async () => {
    facilities = () => [];
    show();
    await settled();
    await pick("Trail", /Knalleleden/);

    await pick("Attach to", "Facility");
    await userEvent.upload(fileInput(), image("photo.jpg"));
    await userEvent.click(uploadButton());

    expect(toasts.error).toHaveBeenCalledWith("Choose what to attach the image(s) to.");
    expect(images.addFacilityImages).not.toHaveBeenCalled();
  });

  it("is dropped once the lists show it is gone", async () => {
    saveStagedTarget({ targetType: "trail-gallery", targetId: "deleted-trail" });

    show();

    await waitFor(() => expect(calls("GET", TRAILS)).toHaveLength(1));
    await waitFor(() => expect(screen.getByLabelText("Trail")).toHaveTextContent("Select…"));
    expect(screen.queryByText("Existing images")).toBeNull();
  });

  it("is kept when it is still there", async () => {
    saveStagedTarget({ targetType: "trail-gallery", targetId: "t-1" });

    show();

    await waitFor(() => expect(screen.getByLabelText("Trail")).toHaveTextContent("Knalleleden"));
  });

  it("is not dropped while the trails are still on their way", async () => {
    saveStagedTarget({ targetType: "trail-gallery", targetId: "t-1" });
    let arrive: () => void = () => {};
    trails = () =>
      new Promise((resolve) => {
        arrive = () => resolve([trail("t-1", "Knalleleden")]);
      });

    show();
    await settled();
    expect(screen.getByText("Existing images")).toBeInTheDocument();

    await act(async () => arrive());

    await waitFor(() => expect(screen.getByLabelText("Trail")).toHaveTextContent("Knalleleden"));
  });
});

describe("files staged before a refresh", () => {
  it("come back", async () => {
    await saveStagedFiles([image("beforehand.jpg")]);

    show();

    expect(await screen.findByText(/Staged for upload/)).toBeVisible();
    expect(previews()).toHaveLength(1);
  });

  // Held open on purpose: without the guard the restored set lands on top of the file
  // the user picked while waiting, and they upload something they never chose. Both
  // outcomes are one preview, so the count says nothing — the name is what tells them
  // apart, and the upload is where it does harm.
  it("give way to anything picked while the read was in flight", async () => {
    let finishRead: (files: File[]) => void = () => {};
    staged.loadStagedFiles.mockReturnValue(
      new Promise<File[]>((resolve) => {
        finishRead = resolve;
      }),
    );

    show();
    await userEvent.upload(fileInput(), image("just-picked.jpg"));
    await waitFor(() => expect(previews()).toHaveLength(1));

    await act(async () => finishRead([image("beforehand.jpg")]));
    await settled();

    await pick("Trail", /Knalleleden/);
    await userEvent.click(uploadButton());

    await waitFor(() => expect(images.addTrailImages).toHaveBeenCalledOnce());
    expect(images.addTrailImages.mock.calls[0][1].map((f: File) => f.name)).toEqual(["just-picked.jpg"]);
  });

  it("are kept in step with what is staged now", async () => {
    show();
    await settled();

    await userEvent.upload(fileInput(), image("photo.jpg"));

    await waitFor(async () => expect((await readStore()).map((f) => f.name)).toEqual(["photo.jpg"]));
  });

  // The persist effect runs on the very first render too, when `files` is still the
  // empty initial state. Letting it write then deletes what the read is on its way to
  // restore — the file is gone before anyone sees it.
  it("are not deleted by the empty first render", async () => {
    await saveStagedFiles([image("beforehand.jpg")]);
    staged.loadStagedFiles.mockReturnValue(new Promise<File[]>(() => {}));

    show();
    await settled();

    expect(await readStore()).toHaveLength(1);
  });

  it("can be removed one by one", async () => {
    show();
    await settled();
    await userEvent.upload(fileInput(), [image("a.jpg"), image("b.jpg")]);

    await userEvent.click(screen.getByRole("button", { name: "Remove a.jpg" }));

    expect(screen.queryByRole("button", { name: "Remove a.jpg" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove b.jpg" })).toBeInTheDocument();
  });
});

describe("the symbol, which takes a single image", () => {
  it("accepts one file at a time", async () => {
    show();
    await settled();

    await pick("Attach to", /Trail — symbol/);

    expect(fileInput()).not.toHaveAttribute("multiple");
  });

  it("trims what was already staged down to one", async () => {
    show();
    await settled();
    await userEvent.upload(fileInput(), [image("a.jpg"), image("b.jpg")]);
    await waitFor(() => expect(previews()).toHaveLength(2));

    await pick("Attach to", /Trail — symbol/);

    expect(previews()).toHaveLength(1);
  });

  it("goes to the symbol endpoint, one file, not the gallery", async () => {
    show();
    await settled();
    await pick("Attach to", /Trail — symbol/);
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), [image("symbol.png", "image/png"), image("other.png", "image/png")]);

    await userEvent.click(uploadButton());

    await waitFor(() => expect(images.setTrailSymbol).toHaveBeenCalledOnce());
    expect(images.setTrailSymbol.mock.calls[0][0]).toBe("t-1");
    expect(images.setTrailSymbol.mock.calls[0][1]).toBeInstanceOf(File);
    expect(images.addTrailImages).not.toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledWith("Trail symbol updated.");
  });
});

describe("the images already attached", () => {
  beforeEach(() => {
    owned = [item("m1", "t-1", "Trail"), item("m2", "t-1", "TrailSymbol"), item("m3", "f-1", "Facility")];
  });

  it("asks the library for the chosen owner only", async () => {
    show();
    await settled();

    await pick("Trail", /Knalleleden/);

    await waitFor(() => expect(calls("GET", MEDIA)).toHaveLength(1));
    expect(calls("GET", MEDIA)[0].url).toContain("OwnerIdentifier=t-1");
  });

  it("shows the gallery images, not the trail's symbol", async () => {
    show();
    await settled();

    await pick("Trail", /Knalleleden/);

    expect(await screen.findByAltText("alt for m1")).toHaveAttribute("src", "https://media.test/m1.webp");
    expect(screen.queryByAltText("alt for m2")).toBeNull();
  });

  it("shows the symbol, and offers no way to delete it", async () => {
    show();
    await settled();
    await pick("Attach to", /Trail — symbol/);
    await pick("Trail", /Knalleleden/);

    expect(await screen.findByAltText("alt for m2")).toHaveAttribute("src", "https://media.test/m2.webp");
    expect(screen.queryByTitle("Delete image")).toBeNull();
  });

  it("asks before deleting one, then refreshes the image and trail lists", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    const deleteButton = await screen.findByTitle("Delete image");
    owned = [];

    await userEvent.click(deleteButton);
    expect(images.deleteTrailImage).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(images.deleteTrailImage).toHaveBeenCalledWith("m1"));
    expect(await screen.findByText(/No images attached yet/)).toBeInTheDocument();
    await waitFor(() => expect(calls("GET", TRAILS)).toHaveLength(2));
    expect(toasts.success).toHaveBeenCalledWith("Image deleted.");
  });

  it("does nothing when the question is answered no", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);

    await userEvent.click(await screen.findByTitle("Delete image"));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(images.deleteTrailImage).not.toHaveBeenCalled();
  });

  it("sends a facility's image to the facility endpoint", async () => {
    show();
    await settled();
    await pick("Attach to", "Facility");
    await pick("Facility", "Vindskydd");

    await userEvent.click(await screen.findByTitle("Delete image"));
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(images.deleteFacilityImage).toHaveBeenCalledWith("m3"));
    expect(images.deleteTrailImage).not.toHaveBeenCalled();
  });

  it("says so, with a retry, when they cannot be loaded", async () => {
    api.mock.on("GET", MEDIA, () => {
      throw new Error("down");
    });
    show();
    await settled();

    await pick("Trail", /Knalleleden/);

    expect(await screen.findByText("The existing images could not be loaded.")).toBeInTheDocument();
  });
});

describe("uploading", () => {
  it("refuses without a target rather than guessing one", async () => {
    show();
    await settled();
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    expect(toasts.error).toHaveBeenCalledWith("Choose what to attach the image(s) to.");
    expect(images.addTrailImages).not.toHaveBeenCalled();
  });

  it("refuses without a file", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);

    await userEvent.click(uploadButton());

    expect(toasts.error).toHaveBeenCalledWith("Add at least one image.");
    expect(images.addTrailImages).not.toHaveBeenCalled();
  });

  it("sends the files and the processing options together, then refreshes the trails", async () => {
    images.addTrailImages.mockResolvedValue([{}, {}]);
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), [image("a.jpg"), image("b.jpg")]);

    await userEvent.click(uploadButton());

    await waitFor(() => expect(images.addTrailImages).toHaveBeenCalledOnce());
    const [identifier, files, options] = images.addTrailImages.mock.calls[0];
    expect(identifier).toBe("t-1");
    expect(files).toHaveLength(2);
    expect(options).toEqual({ maxWidth: 1920, maxHeight: 1920, quality: 82, format: "webp" });
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("2 image(s) added to trail."));
    await waitFor(() => expect(calls("GET", TRAILS)).toHaveLength(2));
  });

  it("sends the chosen processing options", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await pick("Max resolution", "Original");
    await pick("Format", "Keep original");
    await userEvent.upload(fileInput(), [image("a.jpg"), image("b.jpg")]);

    await userEvent.click(uploadButton());

    await waitFor(() => expect(images.addTrailImages).toHaveBeenCalledOnce());
    expect(images.addTrailImages.mock.calls[0][2]).toEqual({ quality: 82 });
  });

  it("clears what was staged once the upload has landed, and shows the new images", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), image("photo.jpg"));
    owned = [item("m-new", "t-1", "Trail")];

    await userEvent.click(uploadButton());

    expect(await screen.findByAltText("alt for m-new")).toBeInTheDocument();
    expect(screen.queryByText(/Staged for upload/)).toBeNull();
  });

  // The bytes are the one thing the reviewer cannot get back by pressing again.
  it("keeps the files staged when the upload failed", async () => {
    images.addTrailImages.mockRejectedValue(new Error("413"));
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("Upload failed."));
    expect(previews()).toHaveLength(1);
    expect(calls("GET", TRAILS)).toHaveLength(1);
  });

  it("lets go of the button again after a failure", async () => {
    images.addTrailImages.mockRejectedValue(new Error("413"));
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(uploadButton()).toBeEnabled();
  });

  it("goes to the facility endpoint for a facility, and leaves the trails alone", async () => {
    show();
    await settled();
    await pick("Attach to", "Facility");
    await pick("Facility", "Vindskydd");
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    await waitFor(() => expect(images.addFacilityImages).toHaveBeenCalledOnce());
    expect(images.addFacilityImages.mock.calls[0][0]).toBe("f-1");
    expect(images.addTrailImages).not.toHaveBeenCalled();
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("1 image(s) added to facility."));
    expect(calls("GET", TRAILS)).toHaveLength(1);
  });
});

describe("when a list cannot be loaded", () => {
  it("says which one, and still lets the others be used", async () => {
    facilities = () => {
      throw new Error("offline");
    };

    show();
    await settled();

    await pick("Trail", /Knalleleden/);
    expect(screen.getByLabelText("Trail")).toHaveTextContent("Knalleleden");
    expect(screen.queryByRole("alert")).toBeNull();

    await pick("Attach to", "Facility");
    expect(screen.getByRole("alert")).toHaveTextContent("The facilities could not be loaded.");
  });
});
