// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "react-router";
import { AlertTriangle, ChevronRight, Circle } from "lucide-react";
import type { MailTemplateListItemResponse } from "@/api/generated/model";
import { paths } from "@/config/paths";
import { Badge } from "@/components/ui/badge";

export function TemplateRow({ template }: { template: MailTemplateListItemResponse }) {
  return (
    <Link
      to={paths.mailTemplate(template.identifier)}
      className="block rounded-xs border border-input p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium">{template.key}</span>
            <Badge variant="outline">{template.language}</Badge>
            {!template.isKnown && <Badge variant="secondary">Not sent by any code</Badge>}
          </div>

          <p className="truncate text-sm text-muted-foreground">{template.subject}</p>

          {template.unknownTokenCount > 0 && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Uses {template.unknownTokenCount} placeholder
              {template.unknownTokenCount === 1 ? "" : "s"} this template does not supply — this mail cannot be sent
            </p>
          )}

          {template.missingTokenCount > 0 && (
            <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <Circle className="size-3" aria-hidden="true" />
              {template.missingTokenCount} available placeholder
              {template.missingTokenCount === 1 ? " is" : "s are"} unused
            </p>
          )}
        </div>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </Link>
  );
}
