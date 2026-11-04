// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxEmailSummaryResponse } from "@/api/generated/model";
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

import MailOutboxPage from "./mail-outbox";

const OUTBOX = "/api/v1/admin/mail-outbox";
const COUNTS = `${OUTBOX}/counts`;
const MAIL = `${OUTBOX}/mail-1`;
const BODY = `${MAIL}/body`;
const RETRY = `${MAIL}/retry`;
const CANCEL = `${MAIL}/cancel`;
const PURGE = `${OUTBOX}/purge`;

function summary(overrides: Partial<OutboxEmailSummaryResponse> = {}): OutboxEmailSummaryResponse {
  return {
    identifier: "mail-1",
    toAddress: "vandrare@example.com",
    toName: "Ralf",
    subject: "Hej",
    templateKey: "welcome",
    status: "Failed",
    attempts: 5,
    nextAttemptAt: "2026-09-18T12:00:00Z",
    sentAt: null,
    lastError: "Connection refused",
    settledAt: "2026-09-18T11:30:00Z",
    redactedAt: null,
    createdAt: "2026-09-18T11:00:00Z",
    lastUpdatedAt: "2026-09-18T11:30:00Z",
    ...overrides,
  };
}

let mail = summary();
let total = 1;

function lastQuery() {
  return new URL(api.mock.calls[api.mock.calls.length - 1].url, "http://x").searchParams;
}

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

function Location() {
  const { search } = useLocation();
  return <output data-testid="location">{search}</output>;
}

function renderPage(url = "/mail-outbox") {
  return renderWithProviders(
    <>
      <MailOutboxPage />
      <Location />
    </>,
    { initialEntries: [url] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  mail = summary();
  total = 1;

  api.mock.on("GET", OUTBOX, () => {
    const status = lastQuery().get("status");
    const items = !status || status === mail.status ? [mail] : [];
    return { items, page: Number(lastQuery().get("page")), hasMore: false, totalCount: total };
  });
  api.mock.on("GET", COUNTS, () => ({ pending: 1, sending: 0, sent: 4, failed: 2, cancelled: 0, total: 7 }));
  api.mock.on("GET", MAIL, () => ({ email: mail }));
  api.mock.on("GET", BODY, () => ({ identifier: "mail-1", bodyHtml: "<p>Hej Ralf</p>", bodyText: "Hej Ralf" }));
  api.mock.on("POST", RETRY, () => {
    mail = { ...mail, status: "Pending", attempts: 0 };
    return { email: mail };
  });
  api.mock.on("POST", CANCEL, () => {
    mail = { ...mail, status: "Cancelled" };
    return { email: mail };
  });
  api.mock.on("POST", PURGE, (body) => ({
    deleted: 3,
    olderThanDays: (body as { olderThanDays: number }).olderThanDays,
    cutoffUtc: "2026-09-11T00:00:00Z",
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

async function openMail() {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByTestId("open-mail-1"));
  return user;
}

describe("the outbox list", () => {
  it("lists the outbox with its counts and shows why a mail failed", async () => {
    renderPage();

    expect(await screen.findByText("vandrare@example.com")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
    expect(await screen.findByTestId("counts")).toHaveTextContent("Failed: 2");
  });

  // Filtering client-side would silently only filter the page you are on.
  it("sends the status filter to the API and keeps it in the address", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("vandrare@example.com");
    await user.click(screen.getByRole("button", { name: "Sent" }));

    expect(await screen.findByText("No mail matches these filters.")).toBeInTheDocument();
    expect(calls("GET", OUTBOX).at(-1)?.url).toContain("status=Sent");
    expect(screen.getByTestId("location")).toHaveTextContent("?status=Sent");
  });

  it("starts from the filter in the address, so the dashboard can link to failed mail", async () => {
    renderPage("/mail-outbox?status=Failed");

    expect(await screen.findByText("vandrare@example.com")).toBeInTheDocument();
    expect(calls("GET", OUTBOX)[0].url).toContain("status=Failed");
    expect(screen.getByRole("button", { name: "Failed" })).toHaveAttribute("aria-pressed", "true");
  });

  it("searches by recipient", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("vandrare@example.com");
    await user.type(screen.getByTestId("recipient-filter"), " vandrare ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(calls("GET", OUTBOX).at(-1)?.url).toContain("recipient=vandrare"));
  });

  it("goes back to the first page when the filter changes", async () => {
    const user = userEvent.setup();
    total = 60;
    api.mock.on("GET", OUTBOX, () => ({ items: [mail], page: 2, hasMore: true, totalCount: total }));
    renderPage("/mail-outbox?page=2");

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Failed" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("?status=Failed"));
    expect(screen.getByTestId("location")).not.toHaveTextContent("page");
  });

  it("shows a failed load with a way to try again", async () => {
    api.mock.on("GET", OUTBOX, () => {
      throw new Error("The outbox is down");
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("The outbox is down");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("one mail", () => {
  it("retries a failed mail, then closes and shows it queued", async () => {
    const user = await openMail();

    await user.click(await screen.findByTestId("retry"));

    await waitFor(() => expect(calls("POST", RETRY)).toHaveLength(1));
    expect(toasts.toast.success).toHaveBeenCalledWith("Mail queued again.");
    expect(await within(screen.getByTestId("row-mail-1")).findByText("Pending")).toBeInTheDocument();
    expect(screen.queryByTestId("retry")).toBeNull();
    expect(calls("GET", COUNTS).length).toBeGreaterThan(1);
  });

  it("cancels a mail still waiting", async () => {
    mail = summary({ status: "Pending", lastError: null });
    const user = await openMail();

    expect(await screen.findByTestId("cancel")).toBeInTheDocument();
    expect(screen.queryByTestId("retry")).toBeNull();

    await user.click(screen.getByTestId("cancel"));

    expect(await within(screen.getByTestId("row-mail-1")).findByText("Cancelled")).toBeInTheDocument();
    expect(toasts.toast.success).toHaveBeenCalledWith("Mail cancelled.");
  });

  it("offers neither retry nor cancel while a mail is being sent", async () => {
    mail = summary({ status: "Sending", lastError: null });
    await openMail();

    expect(await screen.findByText(/being sent right now/i)).toBeInTheDocument();
    expect(screen.queryByTestId("retry")).toBeNull();
    expect(screen.queryByTestId("cancel")).toBeNull();
  });

  it("reports the API's refusal and leaves the mail open", async () => {
    api.mock.on("POST", RETRY, () => {
      throw new Error("This mail is being sent right now.");
    });
    const user = await openMail();

    await user.click(await screen.findByTestId("retry"));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("This mail is being sent right now."));
    expect(screen.getByTestId("retry")).toBeEnabled();
  });

  // keep-comment: a suspense query treats data under 1 s old as fresh, so the clock has to move
  it("re-reads the mail each time it is opened", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = await openMail();
    await screen.findByTestId("retry");

    await user.keyboard("{Escape}");
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    await user.click(screen.getByTestId("open-mail-1"));
    await screen.findByTestId("retry");

    await waitFor(() => expect(calls("GET", MAIL)).toHaveLength(2));
  });
});

describe("the mail body", () => {
  it("is not fetched just because the mail was opened", async () => {
    await openMail();

    expect(await screen.findByTestId("reveal-body")).toBeInTheDocument();
    expect(calls("GET", BODY)).toHaveLength(0);
  });

  it("is fetched once when the operator asks for it", async () => {
    const user = await openMail();

    await user.click(await screen.findByTestId("reveal-body"));

    await waitFor(() => expect(screen.queryByTestId("reveal-body")).toBeNull());
    expect(calls("GET", BODY)).toHaveLength(1);
  });

  it("is not kept once the mail is closed", async () => {
    const user = await openMail();
    await user.click(await screen.findByTestId("reveal-body"));
    await waitFor(() => expect(screen.queryByTestId("reveal-body")).toBeNull());

    await user.keyboard("{Escape}");
    await user.click(screen.getByTestId("open-mail-1"));

    expect(await screen.findByTestId("reveal-body")).toBeInTheDocument();
    expect(calls("GET", BODY)).toHaveLength(1);
  });

  it("says why when it cannot be read", async () => {
    api.mock.on("GET", BODY, () => {
      throw new Error("The body has been cleared.");
    });
    const user = await openMail();

    await user.click(await screen.findByTestId("reveal-body"));

    expect(await screen.findByText("The body has been cleared.")).toBeInTheDocument();
  });

  it("is explained instead of offered once cleared", async () => {
    mail = summary({ status: "Sent", redactedAt: "2026-09-18T12:00:00Z" });
    await openMail();

    expect(await screen.findByTestId("body-redacted")).toBeInTheDocument();
    expect(screen.queryByTestId("reveal-body")).toBeNull();
  });

  it("being cleared rules out a retry", async () => {
    mail = summary({ status: "Failed", redactedAt: "2026-09-18T12:00:00Z" });
    await openMail();

    await screen.findByTestId("body-redacted");
    expect(screen.queryByTestId("retry")).toBeNull();
  });
});

describe("purging", () => {
  // 0 is what an empty input coerces to, and on the backend that would mean "everything".
  it("refuses without a usable cutoff", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("open-purge"));
    await user.clear(await screen.findByTestId("purge-days"));

    expect(screen.getByTestId("confirm-purge")).toBeDisabled();
  });

  it("purges with the cutoff the operator typed and says how many went", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("open-purge"));
    const days = await screen.findByTestId("purge-days");
    await user.clear(days);
    await user.type(days, "7");
    await user.click(screen.getByTestId("confirm-purge"));

    await waitFor(() =>
      expect(calls("POST", PURGE)).toEqual([expect.objectContaining({ body: { olderThanDays: 7, confirm: true } })]),
    );
    expect(toasts.toast.success).toHaveBeenCalledWith("3 sent mails deleted.");
    await waitFor(() => expect(screen.queryByTestId("purge-days")).toBeNull());
  });

  it("says what a purge spares before it happens", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("open-purge"));

    expect(await screen.findByText(/left alone by this action/i)).toHaveTextContent("4 sent mails in total");
    expect(screen.getByText(/retention period/i)).toBeInTheDocument();
  });

  it("starts from the default cutoff each time it opens", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("open-purge"));
    await user.clear(await screen.findByTestId("purge-days"));
    await user.click(screen.getByRole("button", { name: "Keep everything" }));
    await user.click(screen.getByTestId("open-purge"));

    expect(await screen.findByTestId("purge-days")).toHaveValue(3);
  });
});
