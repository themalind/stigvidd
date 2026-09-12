// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import ReportContentForm from "@/components/report/report-content-form";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockCreate = jest.fn();
const mockReasons = jest.fn();

jest.mock("@/api/content-reports", () => ({
  createContentReport: (...args: unknown[]) => mockCreate(...args),
  getReportReasons: () => mockReasons(),
}));

const onDismiss = jest.fn();
const REASONS = ["Other", "Offensive", "Spam", "PersonalData", "Misinformation"];

function show(visible = true) {
  return renderWithProviders(
    <ReportContentForm
      visible={visible}
      contentType="Review"
      contentIdentifier="review-1"
      invalidateQueryKey={["reviews", "trail-1"]}
      onDismiss={onDismiss}
    />,
  );
}

// The reason list arrives from a query the modal only enables once it is open.
async function showLoaded() {
  const rendered = show();
  await flushUntil(() => mockReasons.mock.calls.length > 0);
  await settle();
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReasons.mockResolvedValue(REASONS);
  mockCreate.mockResolvedValue({ identifier: "cr1", hideOutcome: "Hidden" });
});

// The list is inside a modal that is always mounted next to the content it reports, so
// without the gate every rendered row would fetch it.
it("does not look up the reasons until it is opened", async () => {
  show(false);
  await settle();

  expect(mockReasons).not.toHaveBeenCalled();
});

it("looks up the reasons once it is opened", async () => {
  await showLoaded();

  expect(mockReasons).toHaveBeenCalled();
});

it("sends the reported content, the chosen reason and the note", async () => {
  await showLoaded();

  fireEvent.changeText(screen.getByTestId("report-note"), "Innehåller personuppgifter");
  fireEvent.press(screen.getByTestId("report-submit"));
  await settle();

  expect(mockCreate).toHaveBeenCalledWith({
    contentType: "Review",
    contentIdentifier: "review-1",
    reason: "Offensive",
    reporterNote: "Innehåller personuppgifter",
  });
});

// The note is optional, and an empty box must not travel as an empty string.
it("leaves the note out when nothing was typed", async () => {
  await showLoaded();

  fireEvent.press(screen.getByTestId("report-submit"));
  await settle();

  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ reporterNote: undefined }));
});

it("sends nothing when the note is longer than the limit", async () => {
  await showLoaded();

  fireEvent.changeText(screen.getByTestId("report-note"), "x".repeat(301));
  fireEvent.press(screen.getByTestId("report-submit"));
  await settle();

  expect(mockCreate).not.toHaveBeenCalled();
});

it("closes the modal once the report is accepted", async () => {
  await showLoaded();

  fireEvent.press(screen.getByTestId("report-submit"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
});

// Neutral wording on purpose: a reporter over the withholding threshold gets a queued
// report that hides nothing, and that must not read as a failure.
it("confirms in the snackbar that the report was sent", async () => {
  const { store } = await showLoaded();

  fireEvent.press(screen.getByTestId("report-submit"));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success" });
});

it("says so when this user has already reported the same content", async () => {
  mockCreate.mockRejectedValue(new ApiError("conflict", 409));
  const { store } = await showLoaded();

  fireEvent.press(screen.getByTestId("report-submit"));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({
    visible: true,
    type: "error",
    message: "Du har redan anmält det här innehållet.",
  });
  expect(onDismiss).not.toHaveBeenCalled();
});

it("says something different when the daily cap is reached", async () => {
  mockCreate.mockRejectedValue(new ApiError("too many", 429));
  const { store } = await showLoaded();

  fireEvent.press(screen.getByTestId("report-submit"));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({
    visible: true,
    type: "error",
    message: "Du har anmält för mycket idag. Försök igen imorgon.",
  });
});

it("falls back to a generic message on any other failure", async () => {
  mockCreate.mockRejectedValue(new ApiError("boom", 500));
  const { store } = await showLoaded();

  fireEvent.press(screen.getByTestId("report-submit"));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({
    visible: true,
    type: "error",
    message: "Anmälan kunde inte skickas. Försök igen.",
  });
});
