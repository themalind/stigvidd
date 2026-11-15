// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WIDTHS = { md: "max-w-2xl", lg: "max-w-4xl" } as const;

interface Props {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  // keep-comment: controls beside the title, such as a map's satellite toggle
  actions?: ReactNode;
  width?: keyof typeof WIDTHS;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function DialogFrame({ trigger, title, description, actions, width = "md", onOpenChange, children }: Props) {
  return (
    <Dialog.Root onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xs border p-6 shadow-lg",
            WIDTHS[width],
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-foreground mb-1 font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">{description}</Dialog.Description>
            </div>
            {actions}
          </div>

          {children}

          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline">Close</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
