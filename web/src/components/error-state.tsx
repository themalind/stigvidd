// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
