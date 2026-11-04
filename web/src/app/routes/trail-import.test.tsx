// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "@/features/trail-import/api/trail-import";
import { pollWhileAnalysing } from "@/features/trail-import/api/trail-import";
import { session } from "@/testing/fixtures/trail-import";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

import TrailImportPage from "./trail-import";

const SESSIONS = "/api/v1/admin/trail-import/sessions";
const ANALYZE = `${SESSIONS}/1/analyze`;
const SESSION = `${SESSIONS}/1`;
const REFUSAL = "Analysing again would discard 12 decisions.";

let sessions: Session[] = [];

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

function renderPage(list: Session[]) {
  sessions = list;
  renderWithProviders(<TrailImportPage />, { initialEntries: ["/trail-import"] });
}

const card = async () => (await screen.findAllByTestId("session-card"))[0];
const analyseButton = async () => within(await card()).getByRole("button", { name: /Analyse/ });

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  api.mock.reset();

  api.mock.on("GET", SESSIONS, () => sessions);
  api.mock.on("POST", ANALYZE, () => ({ ...sessions[0], status: "Analyzing" }));
  api.mock.on("DELETE", SESSION, () => {
    sessions = [];
    return undefined;
  });
});

describe("the session list", () => {
  it("lists each session with what it is and how far it got", async () => {
    renderPage([session()]);

    const shown = await card();
    expect(within(shown).getByText("boras-2026.geojson")).toBeInTheDocument();
    expect(within(shown).getByText("boras-stad")).toBeInTheDocument();
    expect(within(shown).getByText(/by admin · analysed .* · 203 features/)).toBeInTheDocument();
  });

  it("says so when there is nothing yet", async () => {
    renderPage([]);

    expect(await screen.findByText("No sessions yet. Upload an export to start one.")).toBeInTheDocument();
  });

  it("links to the review only once the analysis is done", async () => {
    renderPage([session(), session({ id: 2, status: "Uploaded", analyzedAt: null })]);

    const [ready, uploaded] = await screen.findAllByTestId("session-card");
    expect(within(ready).getByRole("link", { name: "Review" })).toHaveAttribute("href", "/trail-import/1");
    expect(within(uploaded).queryByRole("link", { name: "Review" })).toBeNull();
  });

  it("shows why a session failed", async () => {
    renderPage([session({ status: "Failed", errorMessage: "Not a FeatureCollection." })]);

    expect(await screen.findByText("Not a FeatureCollection.")).toBeInTheDocument();
  });

  it("refreshes on demand", async () => {
    renderPage([session()]);
    await card();

    await userEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() => expect(calls("GET", SESSIONS)).toHaveLength(2));
  });
});

describe("polling", () => {
  it("polls while a session is being analysed", () => {
    expect(pollWhileAnalysing([session(), session({ status: "Analyzing" })])).toBe(4000);
  });

  it("stops once nothing is in flight", () => {
    expect(pollWhileAnalysing([session(), session({ status: "Failed" })])).toBe(false);
    expect(pollWhileAnalysing(undefined)).toBe(false);
  });
});

describe("uploading", () => {
  const file = () => new File(['{"type":"FeatureCollection"}'], "boras-2027.geojson", { type: "application/json" });

  it("sends the file and the source, then lists the new session", async () => {
    renderPage([]);
    api.mock.on("POST", SESSIONS, () => {
      sessions = [session({ fileName: "boras-2027.geojson" })];
      return sessions[0];
    });
    await screen.findByText(/No sessions yet/);

    await userEvent.upload(screen.getByLabelText(/Export/), file());
    await userEvent.type(screen.getByLabelText("Source"), " ulricehamn ");
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(calls("POST", SESSIONS)).toHaveLength(1));
    const body = calls("POST", SESSIONS)[0].body;
    if (!(body instanceof FormData)) throw new Error("expected a multipart body");
    expect((body.get("file") as File).name).toBe("boras-2027.geojson");
    expect(body.get("source")).toBe("ulricehamn");
    expect(await screen.findByText("boras-2027.geojson")).toBeInTheDocument();
    expect(toasts.success).toHaveBeenCalledWith("boras-2027.geojson uploaded.");
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });

  it("leaves the source out when none is given", async () => {
    renderPage([]);
    api.mock.on("POST", SESSIONS, () => session());
    await screen.findByText(/No sessions yet/);

    await userEvent.upload(screen.getByLabelText(/Export/), file());
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(calls("POST", SESSIONS)).toHaveLength(1));
    const body = calls("POST", SESSIONS)[0].body;
    if (!(body instanceof FormData)) throw new Error("expected a multipart body");
    expect(body.has("source")).toBe(false);
  });

  it("warns, without refusing, when the same file was uploaded before", async () => {
    renderPage([]);
    api.mock.on("POST", SESSIONS, () => session({ duplicateOf: ["session-0"] }));
    await screen.findByText(/No sessions yet/);

    await userEvent.upload(screen.getByLabelText(/Export/), file());
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(toasts.warning).toHaveBeenCalledWith(expect.stringContaining("1 earlier session"), expect.anything()),
    );
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("is not offered before a file is picked", async () => {
    renderPage([]);
    await screen.findByText(/No sessions yet/);

    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });
});

describe("analysing", () => {
  it("queues the analysis and refreshes the list", async () => {
    renderPage([session()]);

    await userEvent.click(await analyseButton());

    await waitFor(() => expect(calls("POST", ANALYZE)).toHaveLength(1));
    expect(calls("POST", ANALYZE)[0].url).toContain("force=false");
    expect(toasts.success).toHaveBeenCalledWith("Analysis queued. This page updates itself while it runs.");
    await waitFor(() => expect(calls("GET", SESSIONS).length).toBeGreaterThan(1));
  });

  it("asks before discarding decisions, and forces it on a yes", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    api.mock.on("POST", ANALYZE, () => {
      if (calls("POST", ANALYZE).length === 1) throw new Error(REFUSAL);
      return session({ status: "Analyzing" });
    });
    renderPage([session()]);

    await userEvent.click(await analyseButton());

    await waitFor(() => expect(calls("POST", ANALYZE)).toHaveLength(2));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(REFUSAL));
    expect(calls("POST", ANALYZE)[1].url).toContain("force=true");
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it("leaves the decisions alone on a no, without calling it an error", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    api.mock.on("POST", ANALYZE, () => {
      throw new Error(REFUSAL);
    });
    renderPage([session()]);

    await userEvent.click(await analyseButton());

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(calls("POST", ANALYZE)).toHaveLength(1);
    expect(toasts.error).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("says why when the analysis could not be queued", async () => {
    const confirm = vi.spyOn(window, "confirm");
    api.mock.on("POST", ANALYZE, () => {
      throw new Error("The file is gone.");
    });
    renderPage([session()]);

    await userEvent.click(await analyseButton());

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("The file is gone."));
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(["Analyzing", "Applying", "Applied"])("is not offered while the session is %s", async (status) => {
    renderPage([session({ status })]);

    expect(await analyseButton()).toBeDisabled();
  });

  it("names a second run for what it is", async () => {
    renderPage([session({ status: "Uploaded", analyzedAt: null }), session({ id: 2 })]);

    const [fresh, analysed] = await screen.findAllByTestId("session-card");
    expect(within(fresh).getByRole("button", { name: "Analyse" })).toBeInTheDocument();
    expect(within(analysed).getByRole("button", { name: "Analyse again" })).toBeInTheDocument();
  });
});

describe("deleting", () => {
  it("does nothing until the moderator confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage([session()]);

    await userEvent.click(within(await card()).getByRole("button", { name: /Delete/ }));

    expect(window.confirm).toHaveBeenCalledWith("Delete boras-2026.geojson and everything proposed from it?");
    expect(calls("DELETE", SESSION)).toHaveLength(0);
  });

  it("deletes on a yes and drops it from the list", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage([session()]);

    await userEvent.click(within(await card()).getByRole("button", { name: /Delete/ }));

    await waitFor(() => expect(calls("DELETE", SESSION)).toHaveLength(1));
    expect(toasts.success).toHaveBeenCalledWith("Session deleted.");
    expect(await screen.findByText(/No sessions yet/)).toBeInTheDocument();
  });
});
