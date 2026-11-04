// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { useConfirm } from "./confirm-dialog";

function Asker({ onAnswer }: { onAnswer: (answer: boolean) => void }) {
  const [confirm, dialog] = useConfirm();

  return (
    <>
      <button
        onClick={async () =>
          onAnswer(await confirm({ title: "Delete it?", confirmLabel: "Delete", destructive: true }))
        }
      >
        Ask
      </button>
      {dialog}
    </>
  );
}

it("answers yes only on the action", async () => {
  const user = userEvent.setup();
  const onAnswer = vi.fn();
  render(<Asker onAnswer={onAnswer} />);

  await user.click(screen.getByRole("button", { name: "Ask" }));
  expect(screen.getByRole("alertdialog", { name: "Delete it?" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Delete" }));

  expect(onAnswer).toHaveBeenCalledWith(true);
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it.each([
  ["Cancel", (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Cancel" }))],
  ["Escape", (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
])("answers no on %s", async (_, dismiss) => {
  const user = userEvent.setup();
  const onAnswer = vi.fn();
  render(<Asker onAnswer={onAnswer} />);

  await user.click(screen.getByRole("button", { name: "Ask" }));
  await dismiss(user);

  expect(onAnswer).toHaveBeenCalledWith(false);
  expect(onAnswer).toHaveBeenCalledTimes(1);
});
