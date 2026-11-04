// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import type { AdminHikeSubmissionResponse, SimilarTrailResponse } from "@/api/generated/model";
import { renderWithProviders } from "@/testing/render";
import type { LngLat } from "@/utils/geometry-edit";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasts = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("sonner", () => toasts);

// keep-comment: MapLibre needs WebGL, which jsdom lacks, so each point is a button
vi.mock("@/features/hike-submissions/components/submission-map", () => ({
  SubmissionMap: ({
    path,
    onPointClick,
    onMapClick,
    onInsertPoint,
  }: {
    path: LngLat[];
    onPointClick: (index: number) => void;
    onMapClick: (at: LngLat) => void;
    onInsertPoint: (afterIndex: number, at: LngLat) => void;
  }) => (
    <div>
      {path.map((_, index) => (
        <button key={index} type="button" onClick={() => onPointClick(index)}>
          point {index}
        </button>
      ))}
      <button type="button" onClick={() => onMapClick([LIBRARY.longitude, LIBRARY.latitude])}>
        map at library
      </button>
      <button type="button" onClick={() => onInsertPoint(0, [LIBRARY.longitude, LIBRARY.latitude])}>
        drag first handle to library
      </button>
    </div>
  ),
}));

import HikeSubmissionReviewPage from "./hike-submission-review";

const LIBRARY = vi.hoisted(() => ({ latitude: 57.721, longitude: 12.939 }));
const A = { latitude: 57.72, longitude: 12.94 };
const B = { latitude: 57.7201, longitude: 12.94 };
const C = { latitude: 57.7202, longitude: 12.94 };
const D = { latitude: 57.7201, longitude: 12.9402 };

const SUBMISSION = "/api/v1/admin/hike-submissions/sub-1";
const SIMILAR = `${SUBMISSION}/similar-routes`;
const GEOMETRY = `${SUBMISSION}/geometry`;
const IMAGE = `${SUBMISSION}/images/img-1`;
const APPROVE = `${SUBMISSION}/approve`;
const REJECT = `${SUBMISSION}/reject`;

function detail(overrides: Partial<AdminHikeSubmissionResponse> = {}): AdminHikeSubmissionResponse {
  const coordinates = JSON.stringify([A, B, C, D, A]);
  return {
    identifier: "sub-1",
    name: "Kvällsrunda",
    description: "Runt sjön",
    classification: 2,
    gettingThere: "Buss 3",
    parking: "",
    publicTransport: "",
    accessibilityInfo: "",
    city: "Borås",
    showSubmitterName: true,
    submitterNickName: "Vandraren",
    transferAcceptedAt: "2026-10-20T09:00:00Z",
    status: "Pending",
    rejectionReason: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: "2026-10-20T09:00:00Z",
    lastUpdatedAt: "2026-10-20T09:00:00Z",
    trailLength: 0.4,
    coordinates,
    originalCoordinates: coordinates,
    publishedTrailIdentifier: null,
    images: [],
    ...overrides,
  };
}

let stored = detail();
let similar: SimilarTrailResponse[] = [];

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

function renderPage(loaded: AdminHikeSubmissionResponse = detail()) {
  stored = loaded;
  return renderWithProviders(
    <Routes>
      <Route path="/hike-submissions/:identifier" element={<HikeSubmissionReviewPage />} />
      <Route path="/hike-submissions" element={<p>The list</p>} />
    </Routes>,
    { initialEntries: ["/hike-submissions/sub-1"] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  similar = [];

  api.mock.on("GET", SUBMISSION, () => stored);
  api.mock.on("GET", SIMILAR, () => similar);
  api.mock.on("PUT", GEOMETRY, (body) => {
    stored = { ...stored, coordinates: (body as { coordinates: string }).coordinates };
    return stored;
  });
  api.mock.on("PUT", SUBMISSION, (body) => {
    stored = { ...stored, ...(body as Partial<AdminHikeSubmissionResponse>), lastUpdatedAt: "2026-10-23T10:00:00Z" };
    return stored;
  });
  api.mock.on("DELETE", IMAGE, () => undefined);
  api.mock.on("POST", APPROVE, () => ({ trailIdentifier: "trail-9" }));
  api.mock.on("POST", REJECT, () => undefined);
});

const savedCoordinates = () => (calls("PUT", GEOMETRY)[0]?.body as { coordinates: string } | undefined)?.coordinates;

it("says so, with a way to try again, when the submission cannot be loaded", async () => {
  const user = userEvent.setup();
  api.mock.on("GET", SUBMISSION, () => {
    throw new Error("down");
  });
  renderPage();

  expect(await screen.findByText("Could not load this submission.")).toBeInTheDocument();

  api.mock.on("GET", SUBMISSION, () => stored);
  await user.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByRole("heading", { name: "Kvällsrunda" })).toBeInTheDocument();
});

describe("duplicate check", () => {
  it("warns before approving a walk that matches an existing route", async () => {
    similar = [
      {
        identifier: "trail-3",
        name: "Sjörundan",
        kind: "Contribution",
        walkOnRoute: 0.97,
        routeOnWalk: 0.93,
        likelyDuplicate: true,
      },
    ];
    renderPage();

    expect(await screen.findByText("Sjörundan")).toBeInTheDocument();
    expect(screen.getByText(/97 % of this walk runs along it, 93 %/)).toBeInTheDocument();
    expect(screen.getByText(/looks like a route that already exists/)).toBeInTheDocument();
  });

  it("says so when nothing follows the route", async () => {
    renderPage();

    expect(await screen.findByText("No trail or other submission follows this route.")).toBeInTheDocument();
    expect(screen.queryByText(/looks like a route that already exists/)).not.toBeInTheDocument();
  });

  it("says so when the comparison fails, without hiding the rest of the page", async () => {
    api.mock.on("GET", SIMILAR, () => {
      throw new Error("down");
    });
    renderPage();

    expect(await screen.findByText("Could not compare with the existing trails.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve and publish" })).toBeInTheDocument();
  });

  it("checks again once a changed route is saved", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No trail or other submission follows this route.");

    await user.click(screen.getByRole("button", { name: "Reverse" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    await waitFor(() => expect(calls("GET", SIMILAR)).toHaveLength(2));
    expect(toasts.toast.success).toHaveBeenCalledWith("Route saved.");
  });
});

describe("an approved walk", () => {
  it("can still be edited while its trail exists", async () => {
    renderPage(detail({ status: "Approved", publishedTrailIdentifier: "trail-9" }));

    expect(await screen.findByLabelText("Name")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set start" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve and publish" })).not.toBeInTheDocument();
  });

  it("manages its photos on the published trail", async () => {
    renderPage(detail({ status: "Approved", publishedTrailIdentifier: "trail-9" }));

    expect(await screen.findByRole("button", { name: "Manage photos" })).toBeInTheDocument();
  });

  it("has no trail photos to manage while still pending", async () => {
    renderPage();

    await screen.findByLabelText("Name");
    expect(screen.queryByRole("button", { name: "Manage photos" })).not.toBeInTheDocument();
  });

  it("is read-only once its trail is gone", async () => {
    renderPage(detail({ status: "Approved", publishedTrailIdentifier: null }));

    expect(await screen.findByLabelText("Name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save details" })).not.toBeInTheDocument();
  });
});

it("leaves a rejected walk read-only and says why it was rejected", async () => {
  renderPage(detail({ status: "Rejected", rejectionReason: "Går genom en trädgård", decidedBy: "admin" }));

  expect(await screen.findByLabelText("Name")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Set start" })).not.toBeInTheDocument();
  expect(screen.getByText("Reason: Går genom en trädgård")).toBeInTheDocument();
});

describe("set start", () => {
  it("turns a loop to begin at the clicked point and saves it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Set start" }));
    await user.click(screen.getByRole("button", { name: "point 2" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    await waitFor(() => expect(savedCoordinates()).toBe(JSON.stringify([C, D, A, A, B, C])));
  });

  it("trims a walk that is not a loop to the clicked point", async () => {
    const user = userEvent.setup();
    const far = { latitude: 57.74, longitude: 12.94 };
    const coordinates = JSON.stringify([A, B, C, far]);
    renderPage(detail({ coordinates, originalCoordinates: coordinates }));

    await user.click(await screen.findByRole("button", { name: "Set start" }));
    await user.click(screen.getByRole("button", { name: "point 1" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    await waitFor(() => expect(savedCoordinates()).toBe(JSON.stringify([B, C, far])));
    expect(toasts.toast.info).toHaveBeenCalled();
  });
});

describe("drawing tools", () => {
  it("cuts away everything between two points", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Cut section" }));
    await user.click(screen.getByRole("button", { name: "point 1" }));
    await user.click(screen.getByRole("button", { name: "point 3" }));
    const apply = screen.getAllByRole("button", { name: "Cut section" }).at(-1);
    if (!apply) throw new Error("expected the apply button");
    await user.click(apply);
    await user.click(screen.getByRole("button", { name: "Save route" }));

    await waitFor(() => expect(savedCoordinates()).toBe(JSON.stringify([A, B, D, A])));
  });

  it("extends the start out to a new first point", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Extend" }));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "map at library" }));
    await user.click(screen.getByRole("button", { name: "Add to route" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    await waitFor(() => expect(savedCoordinates()).toBe(JSON.stringify([LIBRARY, A, B, C, D, A])));
  });

  it("adds a point where a handle between two points is dropped", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "drag first handle to library" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    await waitFor(() => expect(savedCoordinates()).toBe(JSON.stringify([A, LIBRARY, B, C, D, A])));
  });

  it("undoes a deleted point back to exactly the route before it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete point" }));
    await user.click(screen.getByRole("button", { name: "point 1" }));
    expect(screen.queryByRole("button", { name: "point 4" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "point 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save route" })).toBeDisabled();
  });
});

describe("saving the details", () => {
  it("sends back the version it loaded, so a newer edit elsewhere is refused instead of overwritten", async () => {
    const user = userEvent.setup();
    renderPage(detail({ lastUpdatedAt: "2026-10-23T09:00:00.123456Z" }));

    await user.type(await screen.findByLabelText("Name"), "!");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() =>
      expect(calls("PUT", SUBMISSION)[0]?.body).toEqual(
        expect.objectContaining({ name: "Kvällsrunda!", lastUpdatedAt: "2026-10-23T09:00:00.123456Z" }),
      ),
    );
    expect(await screen.findByRole("heading", { name: "Kvällsrunda!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save details" })).toBeDisabled();
  });

  it("explains a refused save", async () => {
    const user = userEvent.setup();
    api.mock.on("PUT", SUBMISSION, () => {
      throw new Error("409");
    });
    renderPage();

    await user.type(await screen.findByLabelText("Name"), "!");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith(expect.stringContaining("reload the page")));
    expect(screen.getByRole("button", { name: "Save details" })).toBeEnabled();
  });
});

describe("photos", () => {
  it("removes a photo from a pending submission", async () => {
    const user = userEvent.setup();
    renderPage(detail({ images: [{ identifier: "img-1", imageUrl: "https://media/x.jpg", width: 10, height: 10 }] }));

    await user.click(await screen.findByRole("button", { name: "Remove photo" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull());
    expect(calls("DELETE", IMAGE)).toHaveLength(1);
    expect(screen.getByText(/No photos/)).toBeInTheDocument();
  });
});

describe("deciding", () => {
  it("publishes the walk and goes back to the list", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Approve and publish" }));

    expect(await screen.findByText("The list")).toBeInTheDocument();
    expect(calls("POST", APPROVE)).toHaveLength(1);
    expect(toasts.toast.success).toHaveBeenCalledWith("Published as a user walk.");
  });

  it("will not approve with unsaved changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Name"), "!");

    expect(screen.getByText("Save your changes before approving.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve and publish" })).toBeDisabled();
  });

  it("will not approve without a city", async () => {
    renderPage(detail({ city: " " }));

    expect(await screen.findByText("Add a city before approving.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve and publish" })).toBeDisabled();
  });

  it("rejects only with a reason, and sends that reason", async () => {
    const user = userEvent.setup();
    renderPage();

    const reject = await screen.findByRole("button", { name: "Reject" });
    expect(reject).toBeDisabled();

    await user.type(screen.getByLabelText("Reason the user will see"), "  Går genom en trädgård ");
    await user.click(reject);

    expect(await screen.findByText("The list")).toBeInTheDocument();
    expect(calls("POST", REJECT)[0]?.body).toEqual({ reason: "Går genom en trädgård" });
  });

  it("stays on the page and says so when approving fails", async () => {
    const user = userEvent.setup();
    api.mock.on("POST", APPROVE, () => {
      throw new Error("down");
    });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Approve and publish" }));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("Could not approve the submission."));
    expect(screen.queryByText("The list")).toBeNull();
  });
});
