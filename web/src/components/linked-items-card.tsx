// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { matchesAll, searchTerms } from "@/utils/search";

export interface LinkItem {
  identifier: string;
  label: string;
  detail?: string;
}

interface Props {
  title: string;
  description: string;
  searchLabel: string;
  linked: LinkItem[];
  available: LinkItem[];
  onLink: (identifier: string) => void;
  onUnlink: (identifier: string) => void;
  actions?: (item: LinkItem) => ReactNode;
}

const MAX_SUGGESTIONS = 8;

export default function LinkedItemsCard({
  title,
  description,
  searchLabel,
  linked,
  available,
  onLink,
  onUnlink,
  actions,
}: Props) {
  const [query, setQuery] = useState("");

  const { suggestions, alreadyLinked } = useMemo(() => {
    const terms = searchTerms(query);
    if (terms.length === 0) return { suggestions: [], alreadyLinked: [] };
    const matches = (item: LinkItem) => matchesAll(`${item.label} ${item.detail ?? ""}`, terms);
    const linkedIds = new Set(linked.map((item) => item.identifier));
    return {
      suggestions: available
        .filter((item) => !linkedIds.has(item.identifier))
        .filter(matches)
        .slice(0, MAX_SUGGESTIONS),
      alreadyLinked: linked.filter(matches),
    };
  }, [query, linked, available]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing linked yet.</p>
        ) : (
          <ul className="divide-y rounded-xs border border-input">
            {linked.map((item) => (
              <li key={item.identifier} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {actions?.(item)}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Unlink ${item.label}`}
                    onClick={() => onUnlink(item.identifier)}
                  >
                    <X />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Input
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {alreadyLinked.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Already linked here: {alreadyLinked.map((item) => item.label.trim()).join(", ")}
            </p>
          )}
          {query.trim() !== "" && suggestions.length === 0 && alreadyLinked.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches.</p>
          )}
          {suggestions.length > 0 && (
            <ul className="divide-y rounded-xs border border-input">
              {suggestions.map((item) => (
                <li key={item.identifier} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.label}</p>
                    {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Link ${item.label}`}
                    onClick={() => onLink(item.identifier)}
                  >
                    <Plus />
                    Link
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
