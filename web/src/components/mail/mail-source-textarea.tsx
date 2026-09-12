// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cn } from "@/lib/utils";

/**
 * A plain-text editing surface for a mail body — the HTML source view and the plain-text
 * body both use this.
 *
 * Deliberately NOT `@/components/ui/textarea`: that one auto-grows with `resize-none
 * overflow-hidden` and a JS height sync, so a body at the API's 50 000-character cap would
 * stretch the page to its full height with no scrollbar. This one has a fixed height, its own
 * scrollbar, and a resize handle.
 */
export default function MailSourceTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      spellCheck={false}
      className={cn(
        "h-[24rem] w-full resize-y overflow-auto rounded-xs border border-input bg-transparent p-3 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
