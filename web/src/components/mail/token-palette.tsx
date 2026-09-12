// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AlertTriangle, Check, Circle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { tokenText } from "@/lib/mail-template";
import type { MailTemplateToken } from "@/types/types";

type Props = {
  tokens: MailTemplateToken[];
  /** Lower-cased names the draft uses right now, from reviewTokens. */
  used: Set<string>;
  /** Names in the draft that this template's caller does not supply. */
  unknown: string[];
  /** Inserts the placeholder wherever the operator was last typing. */
  onInsert: (name: string) => void;
  /** Null while no field has been focused yet, so the button can explain itself. */
  insertTarget: string | null;
};

/**
 * The available placeholders, spelled out rather than remembered.
 *
 * This is the part of the feature the whole thing is for. Before it, the only record of which
 * placeholders a template could use was a sentence in the Description column that nothing
 * validated, and a mistake in one stops the mail with no feedback to whoever made it.
 */
export default function TokenPalette({
  tokens,
  used,
  unknown,
  onInsert,
  insertTarget,
}: Props) {
  return (
    <div className="space-y-4">
      {unknown.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Not recognised
            </CardTitle>
            <CardDescription>
              This template does not supply{" "}
              {unknown.length === 1 ? "this placeholder" : "these placeholders"}. A mail using
              one fails to render, so it is never sent and nobody is told. Saving is blocked
              until {unknown.length === 1 ? "it is" : "they are"} removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {unknown.map((name) => (
              <Badge key={name} variant="destructive" className="font-mono">
                {tokenText(name)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Available placeholders</CardTitle>
          <CardDescription>
            {insertTarget
              ? `Click one to insert it into the ${insertTarget}.`
              : "Click into the subject or a body first, then click a placeholder to insert it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tokens.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No C# caller declares this template, so there is no list of placeholders it can
              use. Whatever is already in it is left alone.
            </p>
          )}

          {tokens.map((token) => {
            const isUsed = used.has(token.name.toLowerCase());

            return (
              <div
                key={token.name}
                className="rounded-xs border border-input p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{token.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {tokenText(token.name)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!insertTarget}
                    onClick={() => onInsert(token.name)}
                    aria-label={`Insert ${token.label}`}
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    Insert
                  </Button>
                </div>

                <p className="mt-2 text-muted-foreground">{token.description}</p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Preview uses:{" "}
                  <span className="font-mono break-all">{token.sampleValue}</span>
                </p>

                {isUsed ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3" aria-hidden="true" />
                    In use
                  </p>
                ) : (
                  // Not an error: the renderer ignores a model key the copy does not use. But
                  // it is exactly how a verification mail ends up with no link in it, so it is
                  // said out loud rather than left to be noticed.
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                    <Circle className="size-3" aria-hidden="true" />
                    Not used — this mail will not contain it
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
