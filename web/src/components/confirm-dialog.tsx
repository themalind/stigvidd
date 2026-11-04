// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef, useState, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";

export interface ConfirmRequest {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}

type Confirm = (request: ConfirmRequest) => Promise<boolean>;

// keep-comment: render the returned dialog once; confirm() then resolves true on the action and false on cancel, Escape or a click outside
export function useConfirm(): [Confirm, ReactNode] {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolveRef = useRef<((answer: boolean) => void) | null>(null);

  const settle = (answer: boolean) => {
    resolveRef.current?.(answer);
    resolveRef.current = null;
    setRequest(null);
  };

  const confirm: Confirm = (next) => {
    resolveRef.current?.(false);
    setRequest(next);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  };

  const dialog = (
    <AlertDialog.Root open={request !== null} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-sm border bg-background p-6 shadow-lg">
          <AlertDialog.Title className="text-lg font-semibold">{request?.title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm whitespace-pre-line text-muted-foreground">
            {request?.description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={request?.destructive ? "destructive" : "default"}
                data-testid="confirm-action"
                onClick={() => settle(true)}
              >
                {request?.confirmLabel ?? "Continue"}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );

  return [confirm, dialog];
}
