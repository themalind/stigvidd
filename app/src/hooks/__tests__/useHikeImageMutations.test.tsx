// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { Hike, HikeImage } from "@/data/types";
import { useHikeImageMutations } from "@/hooks/hike/useHikeImageMutations";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockUpload = jest.fn();
const mockDelete = jest.fn();

jest.mock("@/api/hikes", () => ({
  uploadHikeImage: (...args: unknown[]) => mockUpload(...args),
  deleteHikeImage: (...args: unknown[]) => mockDelete(...args),
}));

const mockTrack = jest.fn();
jest.mock("@/services/analytics", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me" } }) };
});

const LIST = ["hikes", "me"];

function image(n: number): HikeImage {
  return { identifier: `img-${n}`, imageUrl: `https://media.stigvidd.se/hikes/${n}.jpg` };
}

function hike(identifier: string, images: HikeImage[] = []): Hike {
  return {
    identifier,
    name: identifier,
    hikeLength: 1,
    duration: 1,
    createdBy: "me",
    createdAt: "2026-05-04T18:00:00Z",
    images,
  };
}

type Mutations = ReturnType<typeof useHikeImageMutations>;

function render(hikes: Hike[] = [hike("h1"), hike("h2")]) {
  const hook: { current?: Mutations } = {};
  function Probe() {
    hook.current = useHikeImageMutations("h1");
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  rendered.queryClient.setQueryDefaults(LIST, { gcTime: Infinity });
  rendered.queryClient.setQueryData(LIST, hikes);

  const current = () => {
    if (!hook.current) throw new Error("expected the hook to have rendered");
    return hook.current;
  };
  const imagesOf = (identifier: string) =>
    rendered.queryClient.getQueryData<Hike[]>(LIST)?.find((h) => h.identifier === identifier)?.images;

  const uploadAll = async (uris: string[]) => {
    act(() => current().upload(uris));
    await flushUntil(() => current().isUploading);
    await flushUntil(() => !current().isUploading);
  };

  return { ...rendered, current, imagesOf, uploadAll };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue({ success: true });
});

describe("uploading", () => {
  it("uploads the picked images one at a time, in order", async () => {
    const first = deferred<HikeImage>();
    mockUpload.mockReturnValueOnce(first.promise).mockResolvedValueOnce(image(2));
    const { current } = render();

    act(() => current().upload(["file:///1.jpg", "file:///2.jpg"]));
    await settle();

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith("h1", "file:///1.jpg");

    await act(async () => first.resolve(image(1)));
    await flushUntil(() => current().isUploading === false);

    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockUpload).toHaveBeenLastCalledWith("h1", "file:///2.jpg");
  });

  it("shows each image on the hike as soon as it is stored, before the rest are done", async () => {
    const second = deferred<HikeImage>();
    mockUpload.mockResolvedValueOnce(image(1)).mockReturnValueOnce(second.promise);
    const { current, imagesOf } = render();

    act(() => current().upload(["file:///1.jpg", "file:///2.jpg"]));
    await flushUntil(() => imagesOf("h1")?.length === 1);

    expect(imagesOf("h1")).toEqual([image(1)]);
    expect(current().uploadingCount).toBe(1);

    await act(async () => second.resolve(image(2)));
    await flushUntil(() => current().isUploading === false);

    expect(imagesOf("h1")).toEqual([image(1), image(2)]);
    expect(current().uploadingCount).toBe(0);
  });

  it("leaves the other hikes in the list alone", async () => {
    mockUpload.mockResolvedValue(image(1));
    const { uploadAll, imagesOf } = render([hike("h1"), hike("h2", [image(9)])]);

    await uploadAll(["file:///1.jpg"]);

    expect(imagesOf("h2")).toEqual([image(9)]);
  });

  it("refreshes the list afterwards", async () => {
    mockUpload.mockResolvedValue(image(1));
    const { uploadAll, queryClient } = render();

    await uploadAll(["file:///1.jpg"]);

    expect(queryClient.getQueryState(LIST)?.isInvalidated).toBe(true);
  });

  it("keeps what was stored and reports the failure when a later upload fails", async () => {
    mockUpload.mockResolvedValueOnce(image(1)).mockRejectedValueOnce(new ApiError("500", 500));
    const { current, uploadAll, imagesOf, store } = render();

    await uploadAll(["file:///1.jpg", "file:///2.jpg", "file:///3.jpg"]);

    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(imagesOf("h1")).toEqual([image(1)]);
    expect(current().uploadingCount).toBe(0);
    expect(store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "error",
      message: "Bilden kunde inte laddas upp, försök igen.",
    });
    expect(mockTrack).toHaveBeenCalledWith("hike.images_added", { requested: 3, uploaded: 1 });
  });

  it("counts a batch that went through whole as one event", async () => {
    mockUpload.mockResolvedValueOnce(image(1)).mockResolvedValueOnce(image(2));
    const { uploadAll } = render();

    await uploadAll(["file:///1.jpg", "file:///2.jpg"]);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("hike.images_added", { requested: 2, uploaded: 2 });
  });

  it("says the hike is full when the server refuses one more", async () => {
    mockUpload.mockRejectedValue(new ApiError("409", 409));
    const { uploadAll, store } = render();

    await uploadAll(["file:///1.jpg"]);

    expect(store.get(snackbarAtom)).toMatchObject({
      type: "error",
      message: "En promenad kan ha högst 10 bilder.",
    });
  });
});

describe("deleting", () => {
  it("removes the image from the hike once the server confirms", async () => {
    const { current, imagesOf } = render([hike("h1", [image(1), image(2)])]);

    await act(async () => {
      await current().deleteImage("img-1");
    });

    expect(mockDelete).toHaveBeenCalledWith("h1", "img-1");
    expect(imagesOf("h1")).toEqual([image(2)]);
    expect(mockTrack).toHaveBeenCalledWith("hike.image_removed", {});
  });

  it("keeps the image and reports the failure when the server refuses", async () => {
    mockDelete.mockRejectedValue(new ApiError("500", 500));
    const { current, imagesOf, store } = render([hike("h1", [image(1)])]);

    await act(async () => {
      await current()
        .deleteImage("img-1")
        .catch(() => {});
    });

    expect(imagesOf("h1")).toEqual([image(1)]);
    expect(store.get(snackbarAtom)).toMatchObject({
      type: "error",
      message: "Bilden kunde inte tas bort, försök igen.",
    });
    expect(mockTrack).not.toHaveBeenCalled();
  });
});
