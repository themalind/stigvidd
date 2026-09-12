// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMailTemplates } from "@/api/mail-templates";
import type { MailTemplateListItem } from "@/types/types";

export default function MailTemplatesPage() {
  const [templates, setTemplates] = useState<MailTemplateListItem[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setTemplates(await getMailTemplates());
      } catch (err) {
        setTemplates([]);
        toast.error(err instanceof Error ? err.message : "Could not load the mail templates.");
      }
    }

    void load();
  }, []);

  return (
    <main className="container mx-auto max-w-4xl space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Mail templates</CardTitle>
          <CardDescription>
            The copy the API mails out. It lives in the database rather than in the code so
            wording can be corrected without a deploy — an edit here takes effect on the next
            mail sent.
          </CardDescription>
        </CardHeader>
      </Card>

      {templates === null && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {templates?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No mail templates exist yet.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {templates?.map((template) => (
          <Link
            key={template.identifier}
            to={`/mail-templates/${template.identifier}`}
            className="block rounded-xs border border-input p-4 transition-colors hover:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium">{template.key}</span>
                  <Badge variant="outline">{template.language}</Badge>

                  {!template.isKnown && (
                    // Not an error, but worth saying: no C# caller declares this key, so
                    // nothing sends it.
                    <Badge variant="secondary">Not sent by any code</Badge>
                  )}
                </div>

                <p className="truncate text-sm text-muted-foreground">{template.subject}</p>

                {template.unknownTokenCount > 0 && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    Uses {template.unknownTokenCount} placeholder
                    {template.unknownTokenCount === 1 ? "" : "s"} this template does not supply —
                    this mail cannot be sent
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
        ))}
      </div>
    </main>
  );
}
