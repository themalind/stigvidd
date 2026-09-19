// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A FULL module replacement -- every function the page imports from here must appear, or it
// arrives as undefined and every test that opens the sheet dies, not just the ones that use it.
const api = vi.hoisted(() => ({
  getOutboxMails: vi.fn(),
  getOutboxMail: vi.fn(),
  getOutboxMailBody: vi.fn(),
  getOutboxCounts: vi.fn(),
  retryOutboxMail: vi.fn(),
  cancelOutboxMail: vi.fn(),
  purgeOutbox: vi.fn(),
}));
vi.mock("@/api/mail-outbox", () => api);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

import MailOutboxPage from "./mail-outbox-page";

type Summary = {
  identifier: string;
  toAddress: string;
  toName: string | null;
  subject: string;
  templateKey: string | null;
  status: string;
  attempts: number;
  nextAttemptAt: string;
  sentAt: string | null;
  lastError: string | null;
  settledAt: string | null;
  redactedAt: string | null;
  createdAt: string;
  lastUpdatedAt: string;
};

function summary(overrides: Partial<Summary> = {}): Summary {
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

function detail(overrides: Partial<Summary> = {}) {
  return { email: summary(overrides) };
}

function body() {
  return { identifier: "mail-1", bodyHtml: "<p>Hej</p>", bodyText: "Hej" };
}

function counts(overrides: Partial<Record<string, number>> = {}) {
  return { pending: 1, sending: 0, sent: 4, failed: 2, cancelled: 0, total: 7, ...overrides };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MailOutboxPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getOutboxMails.mockResolvedValue({
    items: [summary()],
    page: 1,
    hasMore: false,
    totalCount: 1,
  });
  api.getOutboxCounts.mockResolvedValue(counts());
  api.getOutboxMail.mockResolvedValue(detail());
  api.getOutboxMailBody.mockResolvedValue(body());
});

describe("MailOutboxPage", () => {
  it("lists the outbox and shows why a mail failed", async () => {
    // The error is the whole reason an operator opens this page.
    renderPage();

    expect(await screen.findByText("vandrare@example.com")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("sends the status filter to the API rather than filtering in the browser", async () => {
    // Filtering client-side would silently only filter the page you are on.
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("vandrare@example.com");
    await user.click(screen.getByRole("button", { name: "Failed" }));

    await waitFor(() =>
      expect(api.getOutboxMails).toHaveBeenCalledWith(
        expect.objectContaining({ status: "Failed" }),
      ),
    );
  });

  it("offers a retry for a failed mail and reloads afterwards", async () => {
    const user = userEvent.setup();
    api.retryOutboxMail.mockResolvedValue(detail({ status: "Pending", attempts: 0 }));
    renderPage();

    await user.click(await screen.findByTestId("open-mail-1"));
    await user.click(await screen.findByTestId("retry"));

    await waitFor(() => expect(api.retryOutboxMail).toHaveBeenCalledWith("mail-1"));
    expect(api.getOutboxMails).toHaveBeenCalledTimes(2);
  });

  it("offers neither retry nor cancel while a mail is being sent", async () => {
    // The dispatcher holds that row. Both actions would be refused with a 409, so offering
    // them would just be a button that cannot work.
    const user = userEvent.setup();
    api.getOutboxMail.mockResolvedValue(detail({ status: "Sending", lastError: null }));
    renderPage();

    await user.click(await screen.findByTestId("open-mail-1"));

    expect(await screen.findByText(/being sent right now/i)).toBeInTheDocument();
    expect(screen.queryByTestId("retry")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel")).not.toBeInTheDocument();
  });

  it("offers cancel only for a mail still waiting", async () => {
    const user = userEvent.setup();
    api.getOutboxMail.mockResolvedValue(detail({ status: "Pending", lastError: null }));
    renderPage();

    await user.click(await screen.findByTestId("open-mail-1"));

    expect(await screen.findByTestId("cancel")).toBeInTheDocument();
    expect(screen.queryByTestId("retry")).not.toBeInTheDocument();
  });

  it("reports the API's refusal rather than claiming success", async () => {
    // A row can move on between rendering and clicking — most often the dispatcher claiming
    // it — and the operator has to be told which.
    const user = userEvent.setup();
    api.retryOutboxMail.mockRejectedValue(new Error("This mail is being sent right now."));
    renderPage();

    await user.click(await screen.findByTestId("open-mail-1"));
    await user.click(await screen.findByTestId("retry"));

    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith("This mail is being sent right now."),
    );
  });

  it("refuses to purge without a usable cutoff", async () => {
    // 0 is what an empty input coerces to, and on the backend that would mean "everything".
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("open-purge"));

    const days = await screen.findByTestId("purge-days");
    await user.clear(days);

    expect(await screen.findByTestId("confirm-purge")).toBeDisabled();
    expect(api.purgeOutbox).not.toHaveBeenCalled();
  });

  it("purges with the cutoff the operator typed", async () => {
    const user = userEvent.setup();
    api.purgeOutbox.mockResolvedValue({
      deleted: 3,
      olderThanDays: 7,
      cutoffUtc: "2026-09-11T00:00:00Z",
    });
    renderPage();

    await user.click(await screen.findByTestId("open-purge"));

    const days = await screen.findByTestId("purge-days");
    await user.clear(days);
    await user.type(days, "7");
    await user.click(screen.getByTestId("confirm-purge"));

    await waitFor(() => expect(api.purgeOutbox).toHaveBeenCalledWith(7));
  });

  it("says what a purge spares before it happens", async () => {
    // The question at this dialog is whether it will lose the failed mail.
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("open-purge"));

    expect(await screen.findByText(/left alone by this action/i)).toBeInTheDocument();
    // And that it says the sweep deletes settled mail regardless, so the dialog is not read
    // as a promise that failed mail is kept.
    expect(await screen.findByText(/retention period/i)).toBeInTheDocument();
  });

  it("does not fetch the mail body just because the mail was opened", async () => {
    // The body is where the recipient's name and, for a password reset, a live link are, and
    // the API logs every read of one. Opening a mail to see why it failed must not trigger that.
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("open-mail-1"));

    expect(await screen.findByTestId("reveal-body")).toBeInTheDocument();
    expect(api.getOutboxMailBody).not.toHaveBeenCalled();
  });

  it("fetches the body only when the operator asks for it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("open-mail-1"));
    await user.click(await screen.findByTestId("reveal-body"));

    await waitFor(() => expect(api.getOutboxMailBody).toHaveBeenCalledWith("mail-1"));
  });

  it("explains a cleared body instead of offering a reveal that would 404", async () => {
    const user = userEvent.setup();
    api.getOutboxMail.mockResolvedValue(
      detail({ status: "Sent", redactedAt: "2026-09-18T12:00:00Z" }),
    );
    renderPage();

    await user.click(await screen.findByTestId("open-mail-1"));

    expect(await screen.findByTestId("body-redacted")).toBeInTheDocument();
    expect(screen.queryByTestId("reveal-body")).not.toBeInTheDocument();
  });

  it("offers no retry for a mail whose body has been cleared", async () => {
    // Re-sending an empty body is worse than refusing, so the API returns 409. The page should
    // not offer a button that cannot work.
    const user = userEvent.setup();
    api.getOutboxMail.mockResolvedValue(
      detail({ status: "Failed", redactedAt: "2026-09-18T12:00:00Z" }),
    );
    renderPage();

    await user.click(await screen.findByTestId("open-mail-1"));

    await waitFor(() => expect(screen.queryByTestId("retry")).not.toBeInTheDocument());
  });
});
