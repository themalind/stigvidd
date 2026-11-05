// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

describe("useKeyboardShortcuts", () => {
  it("runs the action bound to the key", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts({ d: action }));

    await user.keyboard("d");

    expect(action).toHaveBeenCalledTimes(1);
  });

  it.each(["{Control>}d{/Control}", "{Meta>}d{/Meta}", "{Alt>}d{/Alt}"])(
    "leaves a key pressed with a modifier to the browser (%s)",
    async (keys) => {
      const user = userEvent.setup();
      const action = vi.fn();
      renderHook(() => useKeyboardShortcuts({ d: action }));

      await user.keyboard(keys);

      expect(action).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["an input", <input key="i" data-testid="field" />],
    ["a contenteditable", <div key="c" data-testid="field" contentEditable suppressContentEditableWarning />],
  ])("ignores keys typed into %s", async (_, field) => {
    const user = userEvent.setup();
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts({ d: action }));
    const { getByTestId } = render(field);

    await user.click(getByTestId("field"));
    await user.keyboard("d");

    expect(action).not.toHaveBeenCalled();
  });

  it("calls the latest action after a rerender", async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ action }) => useKeyboardShortcuts({ d: action }), {
      initialProps: { action: first },
    });

    rerender({ action: second });
    await user.keyboard("d");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
