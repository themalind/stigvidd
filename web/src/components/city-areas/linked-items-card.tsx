// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  onLink: (identifier: string) => Promise<void>;
  onUnlink: (identifier: string) => Promise<void>;
}

const MAX_SUGGESTIONS = 8;

function fold(text: string): string {
  return text.toLocaleLowerCase("sv");
}

export default function LinkedItemsCard({
  title,
  description,
  searchLabel,
  linked,
  available,
  onLink,
  onUnlink,
}: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const term = fold(query.trim());
    if (term === "") return [];
    const linkedIds = new Set(linked.map((item) => item.identifier));
    return available
      .filter((item) => !linkedIds.has(item.identifier))
      .filter((item) => fold(`${item.label} ${item.detail ?? ""}`).includes(term))
      .slice(0, MAX_SUGGESTIONS);
  }, [query, linked, available]);

  async function run(identifier: string, action: (identifier: string) => Promise<void>) {
    setBusy(identifier);
    try {
      await action(identifier);
    } finally {
      setBusy(null);
    }
  }

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
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Unlink ${item.label}`}
                  disabled={busy !== null}
                  onClick={() => void run(item.identifier, onUnlink)}
                >
                  <X />
                </Button>
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
          {query.trim() !== "" && suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">No unlinked matches.</p>
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
                    disabled={busy !== null}
                    onClick={() => void run(item.identifier, onLink)}
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
