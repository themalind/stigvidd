// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

// keep-comment: one meaning per colour across the admin: green is settled, amber wants a human, grey is untouched, red went wrong
const toneStyle = {
  ok: "bg-emerald-600 text-white",
  okSoft: "bg-emerald-600/70 text-white",
  busy: "bg-sky-600 text-white",
  warn: "bg-amber-500 text-black",
  bad: "bg-destructive text-white",
  muted: "bg-muted text-muted-foreground border-border",
  created: "bg-violet-600 text-white",
} as const;

export type Tone = keyof typeof toneStyle;

interface Props {
  tone: Tone | undefined;
  title?: string;
  children: ReactNode;
}

export function ToneBadge({ tone, title, children }: Props) {
  return (
    <Badge variant="outline" className={tone ? toneStyle[tone] : ""} title={title}>
      {children}
    </Badge>
  );
}
