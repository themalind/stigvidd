// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import type { SubmissionDetail } from "@/api/hike-submissions";
import type { LngLat } from "@/lib/geometry-edit";
import HikeSubmissionReviewPage from "./hike-submission-review-page";

const api = vi.hoisted(() => ({
  getSubmission: vi.fn(),
  getSimilarRoutes: vi.fn(),
  updateSubmission: vi.fn(),
  updateSubmissionGeometry: vi.fn(),
  deleteSubmissionImage: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
}));
vi.mock("@/api/hike-submissions", () => api);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

// keep-comment: MapLibre needs WebGL, which jsdom lacks, so each point is a button
vi.mock("@/components/hike-submissions/submission-map", () => ({
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

const LIBRARY = vi.hoisted(() => ({ latitude: 57.721, longitude: 12.939 }));
const A = { latitude: 57.72, longitude: 12.94 };
const B = { latitude: 57.7201, longitude: 12.94 };
const C = { latitude: 57.7202, longitude: 12.94 };
const D = { latitude: 57.7201, longitude: 12.9402 };

function detail(overrides: Partial<SubmissionDetail> = {}): SubmissionDetail {
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
    status: "Pending",
    coordinates,
    originalCoordinates: coordinates,
    images: [],
    ...overrides,
  } as SubmissionDetail;
}

function renderPage(loaded: SubmissionDetail) {
  api.getSubmission.mockResolvedValue(loaded);
  api.updateSubmissionGeometry.mockImplementation((_id: string, coordinates: string) =>
    Promise.resolve({ ...loaded, coordinates }),
  );
  render(
    <MemoryRouter initialEntries={["/hike-submissions/sub-1"]}>
      <Routes>
        <Route path="/hike-submissions/:identifier" element={<HikeSubmissionReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getSimilarRoutes.mockResolvedValue([]);
});

describe("duplicate check", () => {
  it("warns before approving a walk that matches an existing route", async () => {
    api.getSimilarRoutes.mockResolvedValue([
      {
        identifier: "trail-3",
        name: "Sjörundan",
        kind: "Contribution",
        walkOnRoute: 0.97,
        routeOnWalk: 0.93,
        likelyDuplicate: true,
      },
    ]);
    renderPage(detail());

    expect(await screen.findByText("Sjörundan")).toBeInTheDocument();
    expect(screen.getByText(/97 % of this walk runs along it, 93 %/)).toBeInTheDocument();
    expect(screen.getByText(/looks like a route that already exists/)).toBeInTheDocument();
  });

  it("says so when nothing follows the route", async () => {
    renderPage(detail());

    expect(await screen.findByText("No trail or other submission follows this route.")).toBeInTheDocument();
    expect(screen.queryByText(/looks like a route that already exists/)).not.toBeInTheDocument();
  });

  it("checks again once a changed route is saved", async () => {
    const user = userEvent.setup();
    renderPage(detail());
    await screen.findByText("No trail or other submission follows this route.");

    await user.click(screen.getByRole("button", { name: "Reverse" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    await vi.waitFor(() => expect(api.getSimilarRoutes).toHaveBeenCalledTimes(2));
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
    renderPage(detail());

    await screen.findByLabelText("Name");
    expect(screen.queryByRole("button", { name: "Manage photos" })).not.toBeInTheDocument();
  });

  it("is read-only once its trail is gone", async () => {
    renderPage(detail({ status: "Approved", publishedTrailIdentifier: null }));

    expect(await screen.findByLabelText("Name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save details" })).not.toBeInTheDocument();
  });
});

it("leaves a rejected walk read-only", async () => {
  renderPage(detail({ status: "Rejected" }));

  expect(await screen.findByLabelText("Name")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Set start" })).not.toBeInTheDocument();
});

describe("set start", () => {
  it("turns a loop to begin at the clicked point and saves it", async () => {
    const user = userEvent.setup();
    renderPage(detail());

    await user.click(await screen.findByRole("button", { name: "Set start" }));
    await user.click(screen.getByRole("button", { name: "point 2" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    expect(api.updateSubmissionGeometry).toHaveBeenCalledWith("sub-1", JSON.stringify([C, D, A, A, B, C]));
  });

  it("trims a walk that is not a loop to the clicked point", async () => {
    const user = userEvent.setup();
    const far = { latitude: 57.74, longitude: 12.94 };
    const coordinates = JSON.stringify([A, B, C, far]);
    renderPage(detail({ coordinates, originalCoordinates: coordinates }));

    await user.click(await screen.findByRole("button", { name: "Set start" }));
    await user.click(screen.getByRole("button", { name: "point 1" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    expect(api.updateSubmissionGeometry).toHaveBeenCalledWith("sub-1", JSON.stringify([B, C, far]));
    expect(toasts.info).toHaveBeenCalled();
  });
});

describe("drawing tools", () => {
  it("cuts away everything between two points", async () => {
    const user = userEvent.setup();
    renderPage(detail());

    await user.click(await screen.findByRole("button", { name: "Cut section" }));
    await user.click(screen.getByRole("button", { name: "point 1" }));
    await user.click(screen.getByRole("button", { name: "point 3" }));
    const apply = screen.getAllByRole("button", { name: "Cut section" }).at(-1);
    if (!apply) throw new Error("expected the apply button");
    await user.click(apply);
    await user.click(screen.getByRole("button", { name: "Save route" }));

    expect(api.updateSubmissionGeometry).toHaveBeenCalledWith("sub-1", JSON.stringify([A, B, D, A]));
  });

  it("extends the start out to a new first point", async () => {
    const user = userEvent.setup();
    renderPage(detail());

    await user.click(await screen.findByRole("button", { name: "Extend" }));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "map at library" }));
    await user.click(screen.getByRole("button", { name: "Add to route" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    expect(api.updateSubmissionGeometry).toHaveBeenCalledWith("sub-1", JSON.stringify([LIBRARY, A, B, C, D, A]));
  });

  it("adds a point where a handle between two points is dropped", async () => {
    const user = userEvent.setup();
    renderPage(detail());

    await user.click(await screen.findByRole("button", { name: "drag first handle to library" }));
    await user.click(screen.getByRole("button", { name: "Save route" }));

    expect(api.updateSubmissionGeometry).toHaveBeenCalledWith("sub-1", JSON.stringify([A, LIBRARY, B, C, D, A]));
  });
});

describe("saving the details", () => {
  it("sends back the version it loaded, so a newer edit elsewhere is refused instead of overwritten", async () => {
    const user = userEvent.setup();
    const loaded = detail({ lastUpdatedAt: "2026-10-23T09:00:00.123456Z" });
    api.updateSubmission.mockResolvedValue(loaded);
    renderPage(loaded);

    const name = await screen.findByLabelText("Name");
    await user.type(name, "!");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await vi.waitFor(() =>
      expect(api.updateSubmission).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({ name: "Kvällsrunda!", lastUpdatedAt: "2026-10-23T09:00:00.123456Z" }),
      ),
    );
  });
});
