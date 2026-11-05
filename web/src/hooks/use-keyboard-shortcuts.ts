// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef } from "react";

// keep-comment: asking what the target sits inside catches contenteditable and every Radix trigger
const EDITABLE_TARGETS =
  'input, textarea, select, [contenteditable="true"], [role="textbox"], ' +
  '[role="combobox"], [role="listbox"], [role="searchbox"]';

// keep-comment: single-letter shortcuts that never fire while typing or with a modifier held
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  const latest = useRef(shortcuts);

  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof Element && event.target.closest(EDITABLE_TARGETS)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const action = latest.current[event.key.toLowerCase()];
      if (!action) return;

      event.preventDefault();
      action();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
