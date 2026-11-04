// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export async function answerConfirm(answer: "yes" | "no"): Promise<string> {
  const dialog = await screen.findByRole("alertdialog");
  const asked = dialog.textContent ?? "";
  const button =
    answer === "yes"
      ? within(dialog).getByTestId("confirm-action")
      : within(dialog).getByRole("button", { name: "Cancel" });

  await userEvent.click(button);
  return asked;
}
