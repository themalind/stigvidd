// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  FacilityResponse,
  MediaItemResponse,
  TrailShortInfoResponse,
} from "@/types/types";
import { saveStagedFiles, saveStagedTarget } from "@/lib/staged-media";

// Real everywhere except the one read whose timing is the thing under test.
const staged = vi.hoisted(() => ({ loadStagedFiles: vi.fn() }));
vi.mock("@/lib/staged-media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/staged-media")>()),
  loadStagedFiles: staged.loadStagedFiles,
}));

const trailApi = vi.hoisted(() => ({
  getAllTrails: vi.fn(),
  addTrailImages: vi.fn(),
  deleteTrailImage: vi.fn(),
  setTrailSymbol: vi.fn(),
}));
vi.mock("@/api/trail", () => trailApi);

const facilityApi = vi.hoisted(() => ({
  getAllFacilities: vi.fn(),
  uploadFacilityImages: vi.fn(),
  deleteFacilityImage: vi.fn(),
}));
vi.mock("@/api/facility", () => facilityApi);

const mediaApi = vi.hoisted(() => ({ getAllMedia: vi.fn() }));
vi.mock("@/api/media", () => mediaApi);

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

// Its cropper is pointer maths over an image jsdom never loads.
vi.mock("./image-crop", () => ({ default: () => <div data-testid="cropper" /> }));

import MediaUpload from "./media-upload";

// fake-indexeddb clones through Node's structuredClone, which turns a jsdom Blob into {}
// and would filter every restored file out — see docs/notes/web-vitest-environment.md.
// Safe here because every upload call is mocked, so no FormData ever sees a Node File.
// Measured: the round trip works, and userEvent.upload still reaches the change handler.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;

const trail = (identifier: string, name: string): TrailShortInfoResponse =>
  ({ identifier, name, trailLength: 4, classification: 1 }) as TrailShortInfoResponse;

const facility = (identifier: string, name: string): FacilityResponse =>
  ({ identifier, name }) as FacilityResponse;

const item = (
  identifier: string,
  ownerIdentifier: string,
  ownerType: string,
): MediaItemResponse =>
  ({
    identifier,
    ownerIdentifier,
    ownerType,
    altText: `alt for ${identifier}`,
    imageUrl: `https://media.test/${identifier}.webp`,
    width: 800,
    height: 600,
    sizeBytes: 2048,
  }) as MediaItemResponse;

const image = (name: string, type = "image/jpeg") =>
  new File(["bytes"], name, { type });

const onMediaChanged = vi.fn();
const show = () => render(<MediaUpload onMediaChanged={onMediaChanged} />);

/** Radix renders its listbox in a portal; the trigger has to be opened first. */
async function pick(label: RegExp | string, option: RegExp | string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

const dropzone = () => screen.getByText(/Drop image/).closest("div")!;
const fileInput = () =>
  dropzone().querySelector<HTMLInputElement>("input[type=file]")!;
const uploadButton = () => screen.getByRole("button", { name: /upload/i });

// The panel is quiet only once all three of its opening requests have landed.
const settled = () =>
  waitFor(() => expect(mediaApi.getAllMedia).toHaveBeenCalled());

const storedTarget = () =>
  JSON.parse(localStorage.getItem("stigvidd:media-upload-target") ?? "null");

// The real reader, for the tests that check what is actually in IndexedDB.
let readStore: typeof import("@/lib/staged-media").loadStagedFiles;

beforeEach(async () => {
  const real = await vi.importActual<typeof import("@/lib/staged-media")>(
    "@/lib/staged-media",
  );
  readStore = real.loadStagedFiles;
  staged.loadStagedFiles.mockImplementation(real.loadStagedFiles);
  trailApi.getAllTrails.mockResolvedValue([
    trail("t-1", "Knalleleden"),
    trail("t-2", "Sjuhäradsrundan"),
  ]);
  trailApi.addTrailImages.mockResolvedValue([{}]);
  trailApi.setTrailSymbol.mockResolvedValue({});
  trailApi.deleteTrailImage.mockResolvedValue(undefined);
  facilityApi.getAllFacilities.mockResolvedValue([facility("f-1", "Vindskydd")]);
  facilityApi.uploadFacilityImages.mockResolvedValue([{}]);
  facilityApi.deleteFacilityImage.mockResolvedValue(undefined);
  mediaApi.getAllMedia.mockResolvedValue([]);
});

describe("the target that was chosen last time", () => {
  it("is restored on the first render, without flashing the default", async () => {
    saveStagedTarget({ targetType: "facility", targetId: "f-1" });

    show();

    // Read before any effect could have corrected it.
    expect(screen.getByLabelText("Attach to")).toHaveTextContent("Facility");
    await settled();
  });

  it("falls back to the default for a stored type that is not one of the three", async () => {
    saveStagedTarget({ targetType: "trail-audio", targetId: "t-1" });

    show();
    await settled();

    expect(screen.getByLabelText("Attach to")).toHaveTextContent(
      "Trail — gallery",
    );
  });

  it("is remembered when it changes", async () => {
    show();
    await settled();

    await pick("Trail", /Sjuhäradsrundan/);

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("stigvidd:media-upload-target")!)).toEqual(
        { targetType: "trail-gallery", targetId: "t-2" },
      ),
    );
  });

  // A trail id left behind on a facility upload would attach the image to nothing —
  // and the trigger shows the placeholder either way, because a value matching no
  // option renders as empty. What is stored is what tells the two apart.
  it("is cleared when the kind of target changes", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await waitFor(() => expect(storedTarget().targetId).toBe("t-1"));

    await pick("Attach to", "Facility");

    await waitFor(() =>
      expect(storedTarget()).toEqual({
        targetType: "facility",
        targetId: "",
      }),
    );
    expect(screen.getByLabelText("Facility")).toHaveTextContent("Select…");
  });

  // The other effect drops a target the list does not contain, and usually gets there
  // first. It bows out on an empty list though — so with no facilities to check against,
  // clearing the id at the switch is the only thing standing between a trail's id and a
  // facility upload.
  it("is cleared even when there is no list to check it against", async () => {
    facilityApi.getAllFacilities.mockResolvedValue([]);
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await waitFor(() => expect(storedTarget().targetId).toBe("t-1"));

    await pick("Attach to", "Facility");
    await userEvent.upload(fileInput(), image("photo.jpg"));
    await userEvent.click(uploadButton());

    expect(toasted.error).toHaveBeenCalledWith(
      "Choose what to attach the image(s) to.",
    );
    expect(facilityApi.uploadFacilityImages).not.toHaveBeenCalled();
  });

  it("is dropped once the lists show it is gone", async () => {
    saveStagedTarget({ targetType: "trail-gallery", targetId: "deleted-trail" });

    show();

    await waitFor(() =>
      expect(screen.getByLabelText("Trail")).toHaveTextContent("Select…"),
    );
  });

  it("is kept when it is still there", async () => {
    saveStagedTarget({ targetType: "trail-gallery", targetId: "t-1" });

    show();
    await settled();

    await waitFor(() =>
      expect(screen.getByLabelText("Trail")).toHaveTextContent("Knalleleden"),
    );
  });

  // The guard that matters: an empty list means "not loaded yet", not "gone".
  it("is not dropped while the trails are still on their way", async () => {
    saveStagedTarget({ targetType: "trail-gallery", targetId: "t-1" });
    let arrive: (trails: TrailShortInfoResponse[]) => void = () => {};
    trailApi.getAllTrails.mockReturnValue(
      new Promise<TrailShortInfoResponse[]>((resolve) => {
        arrive = resolve;
      }),
    );

    show();
    await settled();

    expect(
      JSON.parse(localStorage.getItem("stigvidd:media-upload-target")!).targetId,
    ).toBe("t-1");

    arrive([trail("t-1", "Knalleleden")]);
    await waitFor(() =>
      expect(screen.getByLabelText("Trail")).toHaveTextContent("Knalleleden"),
    );
  });
});

describe("files staged before a refresh", () => {
  it("come back", async () => {
    await saveStagedFiles([image("beforehand.jpg")]);

    show();

    expect(await screen.findByText(/Staged for upload/)).toBeVisible();
    await waitFor(() => expect(screen.getAllByAltText("")).toHaveLength(1));
  });

  // The empty initial state must not be written over what is stored.
  it("are not wiped by the render that happens before the read finishes", async () => {
    await saveStagedFiles([image("beforehand.jpg")]);

    show();
    await settled();

    await waitFor(() => expect(screen.getAllByAltText("")).toHaveLength(1));
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
    await waitFor(() => expect(screen.getAllByAltText("")).toHaveLength(1));

    finishRead([image("beforehand.jpg")]);
    await settled();

    await pick("Trail", /Knalleleden/);
    await userEvent.click(uploadButton());

    await waitFor(() => expect(trailApi.addTrailImages).toHaveBeenCalledOnce());
    expect(
      trailApi.addTrailImages.mock.calls[0][1].map((f: File) => f.name),
    ).toEqual(["just-picked.jpg"]);
  });

  it("are kept in step with what is staged now", async () => {
    show();
    await settled();

    await userEvent.upload(fileInput(), image("photo.jpg"));

    await waitFor(() => expect(screen.getAllByAltText("")).toHaveLength(1));
    await waitFor(async () =>
      expect((await readStore()).map((f) => f.name)).toEqual(["photo.jpg"]),
    );
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
    await waitFor(() => expect(screen.getAllByAltText("")).toHaveLength(2));

    await pick("Attach to", /Trail — symbol/);

    await waitFor(() => expect(screen.getAllByAltText("")).toHaveLength(1));
  });

  it("goes to the symbol endpoint, one file, not the gallery", async () => {
    show();
    await settled();
    await pick("Attach to", /Trail — symbol/);
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), image("symbol.png", "image/png"));

    await userEvent.click(uploadButton());

    await waitFor(() => expect(trailApi.setTrailSymbol).toHaveBeenCalledOnce());
    expect(trailApi.setTrailSymbol.mock.calls[0][0]).toBe("t-1");
    expect(trailApi.setTrailSymbol.mock.calls[0][1]).toBeInstanceOf(File);
    expect(trailApi.addTrailImages).not.toHaveBeenCalled();
  });
});

describe("the images already attached", () => {
  beforeEach(() => {
    mediaApi.getAllMedia.mockResolvedValue([
      item("m1", "t-1", "Trail"),
      item("m2", "t-1", "TrailSymbol"),
      item("m3", "f-1", "Facility"),
    ]);
  });

  it("shows the gallery images, not the trail's symbol", async () => {
    show();
    await settled();

    await pick("Trail", /Knalleleden/);

    await waitFor(() =>
      expect(screen.getByAltText("alt for m1")).toHaveAttribute(
        "src",
        "https://media.test/m1.webp",
      ),
    );
  });

  it("shows the symbol, and offers no way to delete it", async () => {
    show();
    await settled();
    await pick("Attach to", /Trail — symbol/);
    await pick("Trail", /Knalleleden/);

    await waitFor(() =>
      expect(screen.getByAltText("alt for m2")).toHaveAttribute(
        "src",
        "https://media.test/m2.webp",
      ),
    );
    expect(screen.queryByTitle("Delete image")).toBeNull();
  });

  it("asks before deleting one", async () => {
    const confirmed = vi.spyOn(window, "confirm").mockReturnValue(true);
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await waitFor(() => expect(screen.getByTitle("Delete image")).toBeVisible());

    await userEvent.click(screen.getByTitle("Delete image"));

    expect(confirmed).toHaveBeenCalled();
    await waitFor(() =>
      expect(trailApi.deleteTrailImage).toHaveBeenCalledWith("m1"),
    );
    expect(onMediaChanged).toHaveBeenCalled();
  });

  it("does nothing when the question is answered no", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await waitFor(() => expect(screen.getByTitle("Delete image")).toBeVisible());

    await userEvent.click(screen.getByTitle("Delete image"));

    expect(trailApi.deleteTrailImage).not.toHaveBeenCalled();
  });

  it("sends a facility's image to the facility endpoint", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    show();
    await settled();
    await pick("Attach to", "Facility");
    await pick("Facility", "Vindskydd");
    await waitFor(() => expect(screen.getByTitle("Delete image")).toBeVisible());

    await userEvent.click(screen.getByTitle("Delete image"));

    await waitFor(() =>
      expect(facilityApi.deleteFacilityImage).toHaveBeenCalledWith("m3"),
    );
    expect(trailApi.deleteTrailImage).not.toHaveBeenCalled();
  });
});

describe("uploading", () => {
  it("refuses without a target rather than guessing one", async () => {
    show();
    await settled();
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    expect(toasted.error).toHaveBeenCalledWith(
      "Choose what to attach the image(s) to.",
    );
    expect(trailApi.addTrailImages).not.toHaveBeenCalled();
  });

  it("refuses without a file", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);

    await userEvent.click(uploadButton());

    expect(toasted.error).toHaveBeenCalledWith("Add at least one image.");
    expect(trailApi.addTrailImages).not.toHaveBeenCalled();
  });

  it("sends the files and the processing options together", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), [image("a.jpg"), image("b.jpg")]);

    await userEvent.click(uploadButton());

    await waitFor(() => expect(trailApi.addTrailImages).toHaveBeenCalledOnce());
    const [identifier, files, options] = trailApi.addTrailImages.mock.calls[0];
    expect(identifier).toBe("t-1");
    expect(files).toHaveLength(2);
    expect(options).toMatchObject({
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 82,
      format: "webp",
    });
  });

  it("clears what was staged once the upload has landed", async () => {
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    await waitFor(() => expect(screen.queryByAltText("")).toBeNull());
    expect(onMediaChanged).toHaveBeenCalled();
  });

  // The bytes are the one thing the reviewer cannot get back by pressing again.
  it("keeps the files staged when the upload failed", async () => {
    trailApi.addTrailImages.mockRejectedValue(new Error("413"));
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    await waitFor(() =>
      expect(toasted.error).toHaveBeenCalledWith("Upload failed."),
    );
    expect(screen.getAllByAltText("")).toHaveLength(1);
    expect(onMediaChanged).not.toHaveBeenCalled();
  });

  it("lets go of the button again after a failure", async () => {
    trailApi.addTrailImages.mockRejectedValue(new Error("413"));
    show();
    await settled();
    await pick("Trail", /Knalleleden/);
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    await waitFor(() => expect(uploadButton()).toBeEnabled());
  });

  it("goes to the facility endpoint for a facility", async () => {
    show();
    await settled();
    await pick("Attach to", "Facility");
    await pick("Facility", "Vindskydd");
    await userEvent.upload(fileInput(), image("photo.jpg"));

    await userEvent.click(uploadButton());

    await waitFor(() =>
      expect(facilityApi.uploadFacilityImages).toHaveBeenCalledOnce(),
    );
    expect(facilityApi.uploadFacilityImages.mock.calls[0][0]).toBe("f-1");
    expect(trailApi.addTrailImages).not.toHaveBeenCalled();
  });
});

describe("when a list cannot be loaded", () => {
  it("says which one, and still lets the others be used", async () => {
    facilityApi.getAllFacilities.mockRejectedValue(new Error("offline"));

    show();
    await settled();

    await waitFor(() =>
      expect(toasted.error).toHaveBeenCalledWith("Failed to load facilities."),
    );
    await pick("Trail", /Knalleleden/);
    expect(screen.getByLabelText("Trail")).toHaveTextContent("Knalleleden");
  });
});
